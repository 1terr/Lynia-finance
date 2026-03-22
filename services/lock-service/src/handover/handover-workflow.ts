/**
 * Handover Workflow Module
 *
 * Initiate, complete, and status tracking for the device handover process.
 */

import { db, withTransaction } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import type { InitiateHandoverRequest, HandoverRecord } from './handover-types';
import { checkHandoverReadiness } from './handover-validation';
import { calculateDistributorCommission } from './commission-calculator';

/**
 * Initiate device handover workflow
 */
export async function initiateHandover(request: InitiateHandoverRequest): Promise<HandoverRecord> {
  try {
    logger.info('Initiating handover', { action: 'lock.handover.initiate', loanId: request.loan_id, deviceId: request.device_id });

    // Check if handover is ready
    const readiness = await checkHandoverReadiness(request.loan_id);
    if (!readiness.ready) {
      throw new Error(`Handover not ready: ${readiness.blockers.join(', ')}`);
    }

    // Create handover record
    const { data: handover, error: handoverError } = await db
      .from('device_handovers')
      .insert({
        loan_id: request.loan_id,
        device_id: request.device_id,
        customer_id: request.customer_id,
        distributor_id: request.distributor_id,
        handover_location: request.handover_location,
        handed_over_by: request.handed_over_by,
        status: 'initiated',
        identity_verified: false,
        deposit_verified: false,
        device_condition_verified: false,
        app_installed: false,
        app_configured: false,
        lock_test_passed: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
      .execute();

    if (handoverError || !handover) {
      logger.error('Error creating handover record', { action: 'lock.handover.initiate', loanId: request.loan_id, errorMessage: handoverError instanceof Error ? handoverError.message : 'Unknown error' });
      throw new Error('Failed to create handover record');
    }

    logger.info('Handover initiated', { action: 'lock.handover.initiate', handoverId: handover.id, loanId: request.loan_id });
    return handover as HandoverRecord;

  } catch (error) {
    logger.error('Error initiating handover', { action: 'lock.handover.initiate', loanId: request.loan_id, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Complete handover and activate loan
 */
export async function completeHandover(handoverId: string): Promise<{
  success: boolean;
  loan_id: string;
  commission: {
    amount: number;
    percentage: number;
  };
}> {
  try {
    logger.info('Completing handover', { action: 'lock.handover.complete', handoverId });

    // Get handover record
    const { data: handover } = await db
      .from('device_handovers')
      .select('*')
      .eq('id', handoverId)
      .single()
      .execute();

    if (!handover) {
      throw new Error('Handover not found');
    }

    // Verify all required steps completed
    if (!handover.identity_verified) {
      throw new Error('Identity not verified');
    }

    if (!handover.deposit_verified) {
      throw new Error('Deposit not verified - HANDOVER CANNOT PROCEED');
    }

    if (!handover.device_condition_verified) {
      throw new Error('Device condition not verified');
    }

    // Calculate first payment date (30 days from now)
    const handoverDate = new Date();
    const firstPaymentDate = new Date(handoverDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Calculate distributor commission before the transaction (reads only)
    const commission = await calculateDistributorCommission(
      handover.loan_id,
      handover.device_id,
      handover.distributor_id
    );

    // Wrap all database mutations in a transaction for atomicity.
    // If any step fails, ALL changes are rolled back.
    await withTransaction(async (tx) => {
      // Update loan status to 'active'
      await tx(
        `UPDATE loans SET status = 'active', disbursed_at = $2, next_payment_date = $3, updated_at = $4
         WHERE id = $1`,
        [handover.loan_id, handoverDate.toISOString(), firstPaymentDate.toISOString(), new Date().toISOString()]
      );

      // Update device status to 'sold' (handed over to customer)
      await tx(
        `UPDATE devices SET status = 'sold', customer_id = $2, loan_id = $3, assigned_at = $4, updated_at = $5
         WHERE id = $1`,
        [handover.device_id, handover.customer_id, handover.loan_id, handoverDate.toISOString(), new Date().toISOString()]
      );

      // Record distributor commission (based on loan amount)
      await tx(
        `INSERT INTO distributor_commissions
          (distributor_id, loan_id, device_id, commission_amount_usd, commission_percentage,
           loan_amount_usd, device_retail_price_usd, calculation_date, payment_status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          handover.distributor_id, handover.loan_id, handover.device_id,
          commission.amount, commission.percentage, commission.loan_amount,
          commission.device_price, handoverDate.toISOString(), 'pending',
          `Commission for device handover - ${commission.device_model}`,
          handoverDate.toISOString(),
        ]
      );

      // Update handover record
      await tx(
        `UPDATE device_handovers SET status = 'completed', handed_over_at = $2, updated_at = $3
         WHERE id = $1`,
        [handoverId, handoverDate.toISOString(), new Date().toISOString()]
      );

      // Request device lock (stub — Trustonic not yet integrated)
      // Records the lock intent in DB; actual Trustonic API call is a no-op until integration.
      // Inside the transaction so the lock record is consistent with the handover state.
      await tx(
        `INSERT INTO device_locks (device_id, loan_id, customer_id, action, reason, execution_status, executed_at, created_at)
         VALUES ($1, $2, $3, 'lock', 'handover_activation', 'pending', $4, $5)`,
        [handover.device_id, handover.loan_id, handover.customer_id, new Date().toISOString(), new Date().toISOString()]
      );

      // Cancel any pending return transfers for this device (sold devices cannot be returned)
      await tx(
        `UPDATE stock_transfers
         SET status = 'cancelled',
             cancelled_at = $2,
             cancellation_reason = 'Device sold before return processed',
             updated_at = $2
         WHERE device_id = $1
           AND transfer_type = 'return'
           AND status IN ('return_requested', 'return_approved')`,
        [handover.device_id, new Date().toISOString()]
      );
    });

    // NOTE: Fineract disbursement is called by the caller (handleSubmitHandover)
    // AFTER this function returns, ensuring external API calls happen after COMMIT.

    logger.info('Device lock requested (Trustonic stub)', {
      action: 'lock.handover.lock-request',
      handoverId,
      deviceId: handover.device_id,
      loanId: handover.loan_id,
    });

    logger.info('Handover completed successfully', { action: 'lock.handover.complete', handoverId, loanId: handover.loan_id, commissionAmount: commission.amount, commissionPercentage: commission.percentage });

    return {
      success: true,
      loan_id: handover.loan_id,
      commission: {
        amount: commission.amount,
        percentage: commission.percentage
      }
    };

  } catch (error) {
    logger.error('Error completing handover', { action: 'lock.handover.complete', handoverId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });

    // Mark handover as failed (outside transaction — best-effort status update)
    try {
      await db
        .from('device_handovers')
        .update({
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', handoverId)
        .execute();
    } catch (statusError) {
      logger.error('Failed to mark handover as failed', {
        action: 'lock.handover.complete',
        handoverId,
        errorMessage: statusError instanceof Error ? statusError.message : String(statusError),
      });
    }

    throw error;
  }
}

/**
 * Get handover status
 */
export async function getHandoverStatus(handoverId: string): Promise<HandoverRecord> {
  try {
    const { data: handover, error } = await db
      .from('device_handovers')
      .select('*')
      .eq('id', handoverId)
      .single()
      .execute();

    if (error || !handover) {
      throw new Error('Handover not found');
    }

    return handover as HandoverRecord;

  } catch (error) {
    logger.error('Error getting handover status', { action: 'lock.handover.getStatus', handoverId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Generate handover confirmation message for WhatsApp
 */
export function generateHandoverConfirmation(
  customerName: string,
  deviceModel: string,
  loanAmount: number,
  monthlyPayment: number,
  firstPaymentDate: Date
): string {
  return `
\uD83C\uDF89 *Device Handover Complete!*

You've received your ${deviceModel}

*Loan Details*:
Amount Financed: $${loanAmount.toFixed(2)}
Monthly Payment: $${monthlyPayment.toFixed(2)}
First Payment Due: ${firstPaymentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

*Payment Instructions*:
You'll receive payment reminders 3 days before your due date.

*Need Help?*
Reply HELP or contact +263 771 234 567

Welcome to Lynia Finance! \uD83D\uDC9A
  `.trim();
}
