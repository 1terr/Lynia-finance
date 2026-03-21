/**
 * Loan Admin Handlers
 *
 * Admin operations for managing loans (cancel, etc.).
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse, notFoundResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';
import { SQSQueues } from '../../../shared/utils/sqs-publisher';

// ─── POST /api/v1/loans/:id/cancel ───

/**
 * Cancel a loan before disbursement.
 * Only loans with status 'approved' or 'paid_deposit' can be cancelled.
 * Requires admin auth with admin/manager role.
 */
export const handleCancelLoan: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, { requestId: event.requestContext?.requestId }, event);
  }

  const loanId = params?.id;
  if (!loanId) {
    return errorResponse('Missing loan ID', 400, { requestId: event.requestContext?.requestId }, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const cancellationReason = body.reason || 'Cancelled by admin';

    // Fetch loan and validate status
    const { data: loan, error: loanError } = await queryOne<{
      id: string;
      loan_number: string;
      status: string;
      customer_id: string;
      product_category: string;
      device_id: string | null;
      deposit_paid: boolean;
      deposit_amount_usd: number | null;
    }>(
      `SELECT id, loan_number, status, customer_id, product_category,
              device_id, deposit_paid, deposit_amount_usd
       FROM loans WHERE id = $1 AND deleted_at IS NULL`,
      [loanId]
    );

    if (loanError || !loan) {
      return notFoundResponse('Loan not found', event);
    }

    // Only approved or paid_deposit loans can be cancelled
    const cancellableStatuses = ['approved', 'paid_deposit'];
    if (!cancellableStatuses.includes(loan.status)) {
      return errorResponse(
        `Loan with status "${loan.status}" cannot be cancelled. Only loans with status "approved" or "paid_deposit" can be cancelled.`,
        400,
        { requestId: event.requestContext?.requestId, currentStatus: loan.status },
        event
      );
    }

    // Update loan status to cancelled
    await db
      .from('loans')
      .update({
        status: 'cancelled',
        cancellation_reason: cancellationReason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId)
      .execute();

    logger.info('Loan cancelled by admin', {
      action: 'loan.cancel',
      loanId,
      loanNumber: loan.loan_number,
      previousStatus: loan.status,
      cancelledBy: auth.userId,
    });

    // If deposit was paid, create pending refund record + queue notification
    if (loan.deposit_paid && loan.deposit_amount_usd && loan.deposit_amount_usd > 0) {
      try {
        // Create pending refund payment record for admin visibility and processing
        db.from('payments').insert({
          loan_id: loanId,
          customer_id: loan.customer_id,
          amount: loan.deposit_amount_usd,
          currency: 'USD',
          payment_type: 'refund',
          status: 'pending',
          description: `Deposit refund for cancelled loan ${loan.loan_number}`,
          created_at: new Date().toISOString(),
        }).execute().catch(() => {});

        // Queue loan status update for downstream processing
        SQSQueues.processLoanUpdate({
          loanId,
          action: 'status_change',
          metadata: {
            type: 'refund',
            refund_amount: loan.deposit_amount_usd,
            reason: 'loan_cancellation_deposit_refund',
          },
        }).catch(() => {});

        // Notify customer via WhatsApp
        SQSQueues.sendNotification({
          customerId: loan.customer_id,
          channel: 'whatsapp',
          templateName: 'deposit_refund_initiated',
          templateParams: {
            amount: String(loan.deposit_amount_usd),
            loan_number: loan.loan_number,
          },
        }).catch(() => {});

        logger.info('Deposit refund queued', {
          action: 'loan.cancel.refund',
          loanId,
          refundAmount: loan.deposit_amount_usd,
        });
      } catch (refundError) {
        logger.error('Failed to queue deposit refund', {
          action: 'loan.cancel.refund',
          loanId,
          errorMessage: refundError instanceof Error ? refundError.message : String(refundError),
        });
      }
    }

    // If smartphone loan, release device reservation
    if (loan.product_category === 'smartphone' && loan.device_id) {
      try {
        await db
          .from('devices')
          .update({
            reservation_status: 'available',
            reserved_for_loan_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', loan.device_id)
          .execute();

        logger.info('Device reservation released', {
          action: 'loan.cancel.device-release',
          loanId,
          deviceId: loan.device_id,
        });
      } catch (deviceError) {
        logger.error('Failed to release device reservation', {
          action: 'loan.cancel.device-release',
          loanId,
          deviceId: loan.device_id,
          errorMessage: deviceError instanceof Error ? deviceError.message : String(deviceError),
        });
      }
    }

    // Create audit log entry
    await auditLog(
      auth,
      'loan.cancelled',
      'loan',
      loanId,
      `Loan ${loan.loan_number} cancelled: ${cancellationReason}`,
      {
        previous_status: loan.status,
        cancellation_reason: cancellationReason,
        deposit_refund_required: loan.deposit_paid,
        device_released: loan.product_category === 'smartphone' && !!loan.device_id,
      }
    );

    return successResponse({
      id: loanId,
      loan_number: loan.loan_number,
      status: 'cancelled',
      previous_status: loan.status,
      cancellation_reason: cancellationReason,
      deposit_refund_required: loan.deposit_paid && (loan.deposit_amount_usd || 0) > 0,
    }, 200, event);

  } catch (error) {
    logger.error('Error cancelling loan', {
      action: 'loan.cancel',
      status: 'failed',
      loanId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Failed to cancel loan', 500, { requestId: event.requestContext?.requestId }, event);
  }
};
