/**
 * Digital Write-Off Scheduler
 *
 * Automatically detects digital loans past 180 days overdue and creates
 * write-off requests. Digital loans are unsecured, so they follow a
 * different write-off policy than smartphone loans (which have device
 * collateral).
 *
 * Rules:
 *   - Only loans with product_category = 'digital'
 *   - Must be >= 180 days past due
 *   - No existing pending/approved write-off
 *   - Amount < $100: auto-create as pending (auto-approved path)
 *   - Amount >= $100: create as pending for manager approval
 *
 * Designed to run as a scheduled Lambda via EventBridge (e.g. daily).
 */

import { query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import { requestWriteOff } from './write-off-processor';
import type { WriteOffRequest } from './write-off-types';

/** Minimum days past due before digital loan auto-write-off */
const DIGITAL_WRITE_OFF_DPD_THRESHOLD = 180;

/** Amounts below this threshold are auto-created (pending auto-approval) */
const AUTO_APPROVAL_AMOUNT_THRESHOLD = 100;

/** GL account reference prefix for digital loan write-offs */
const DIGITAL_WRITEOFF_GL_REF = 'GL-DIGITAL-WRITEOFF';

/** System user ID for automated write-off requests */
const SYSTEM_USER = 'system:digital-write-off-scheduler';

interface DigitalLoanRow {
  id: string;
  loan_number: string;
  customer_id: string;
  outstanding_balance_usd: number;
  days_past_due: number;
  product_category: 'digital';
}

interface SchedulerResult {
  totalEligible: number;
  requestsCreated: number;
  autoApprovalEligible: number;
  managerApprovalRequired: number;
  errors: number;
  durationMs: number;
  timestamp: string;
}

/**
 * Scan for digital loans eligible for write-off and create requests.
 */
export async function runDigitalWriteOffScheduler(): Promise<SchedulerResult> {
  const startTime = Date.now();
  const result: SchedulerResult = {
    totalEligible: 0,
    requestsCreated: 0,
    autoApprovalEligible: 0,
    managerApprovalRequired: 0,
    errors: 0,
    durationMs: 0,
    timestamp: new Date().toISOString(),
  };

  logger.info('Starting digital write-off scheduler', {
    action: 'digital_writeoff.scan',
    status: 'started',
  });

  try {
    // Query digital loans that are past due and have no existing write-off
    const { data: eligibleLoans } = await query<DigitalLoanRow>(
      `SELECT l.id, l.loan_number, l.customer_id,
              l.outstanding_balance_usd, l.days_past_due, l.product_category
       FROM loans l
       WHERE l.product_category = 'digital'
         AND l.days_past_due >= $1
         AND l.outstanding_balance_usd > 0
         AND l.status IN ('active', 'defaulted', 'disbursed')
         AND NOT EXISTS (
           SELECT 1 FROM loan_write_offs wo
           WHERE wo.loan_id = l.id
             AND wo.status IN ('pending', 'approved')
         )
       ORDER BY l.days_past_due DESC`,
      [DIGITAL_WRITE_OFF_DPD_THRESHOLD]
    );

    if (!eligibleLoans || eligibleLoans.length === 0) {
      logger.info('No digital loans eligible for write-off', {
        action: 'digital_writeoff.scan',
        status: 'completed',
        metadata: { totalEligible: 0 },
      });
      result.durationMs = Date.now() - startTime;
      return result;
    }

    result.totalEligible = eligibleLoans.length;
    logger.info('Found digital loans eligible for write-off', {
      action: 'digital_writeoff.scan',
      status: 'completed',
      metadata: { totalEligible: eligibleLoans.length },
    });

    for (const loan of eligibleLoans) {
      try {
        const outstandingAmount = loan.outstanding_balance_usd;
        const isAutoApproval = outstandingAmount < AUTO_APPROVAL_AMOUNT_THRESHOLD;

        if (isAutoApproval) {
          result.autoApprovalEligible++;
        } else {
          result.managerApprovalRequired++;
        }

        const writeOffRequest: WriteOffRequest = {
          loan_id: loan.id,
          write_off_type: 'full',
          write_off_reason: 'default_180',
          reason_details: `Auto-detected: digital loan ${loan.days_past_due} days past due. ` +
            `GL ref: ${DIGITAL_WRITEOFF_GL_REF}. ` +
            (isAutoApproval
              ? `Amount $${outstandingAmount.toFixed(2)} < $${AUTO_APPROVAL_AMOUNT_THRESHOLD} — auto-approval eligible.`
              : `Amount $${outstandingAmount.toFixed(2)} >= $${AUTO_APPROVAL_AMOUNT_THRESHOLD} — requires manager approval.`),
          principal_written_off: outstandingAmount,
          interest_written_off: 0,
          penalties_written_off: 0,
          recovery_expected: false,
          staff_notes: `Automated digital loan write-off. GL: ${DIGITAL_WRITEOFF_GL_REF}`,
        };

        await requestWriteOff(writeOffRequest, SYSTEM_USER);
        result.requestsCreated++;

        logger.info('Digital write-off request created', {
          action: 'digital_writeoff.request_created',
          status: 'completed',
          metadata: {
            loanId: loan.id,
            daysPastDue: loan.days_past_due,
            amount: outstandingAmount,
            autoApprovalEligible: isAutoApproval,
          },
        });
      } catch (loanError) {
        result.errors++;
        logger.error('Failed to create digital write-off request', {
          action: 'digital_writeoff.request_failed',
          status: 'failed',
          metadata: {
            loanId: loan.id,
            error: loanError instanceof Error ? loanError.message : String(loanError),
          },
        });
      }
    }
  } catch (scanError) {
    logger.error('Digital write-off scan failed', {
      action: 'digital_writeoff.scan',
      status: 'failed',
      metadata: {
        error: scanError instanceof Error ? scanError.message : String(scanError),
      },
    });
  }

  result.durationMs = Date.now() - startTime;

  logger.info('Digital write-off scheduler complete', {
    action: 'digital_writeoff.scan',
    status: 'completed',
    duration: result.durationMs,
    metadata: {
      totalEligible: result.totalEligible,
      requestsCreated: result.requestsCreated,
      autoApprovalEligible: result.autoApprovalEligible,
      managerApprovalRequired: result.managerApprovalRequired,
      errors: result.errors,
    },
  });

  return result;
}

// ===================================================================
// LAMBDA HANDLER (for EventBridge scheduled invocation)
// ===================================================================

/**
 * Lambda handler for the digital write-off scheduler.
 * Triggered by EventBridge rule (e.g. daily at 02:00 UTC).
 */
export async function digitalWriteOffHandler(): Promise<{
  statusCode: number;
  body: string;
}> {
  try {
    const result = await runDigitalWriteOffScheduler();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        digitalWriteOff: {
          totalEligible: result.totalEligible,
          requestsCreated: result.requestsCreated,
          autoApprovalEligible: result.autoApprovalEligible,
          managerApprovalRequired: result.managerApprovalRequired,
          errors: result.errors,
          durationMs: result.durationMs,
        },
      }),
    };
  } catch (error) {
    logger.error('Digital write-off handler error', {
      action: 'digital_writeoff.handler',
      status: 'failed',
      metadata: {
        error: error instanceof Error ? error.message : 'Digital write-off scheduler failed',
      },
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Digital write-off scheduler failed',
      }),
    };
  }
}
