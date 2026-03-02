/**
 * Trigger Fineract Disbursement
 *
 * After a handover is completed, trigger loan disbursement in Fineract.
 * This is async and non-blocking — if Fineract fails, the handover still
 * succeeds and the sync is retried via the SQS retry queue.
 */

import { db } from '../../../shared/clients/database';
import { disburseLoanInFineract } from '../../../shared/clients/fineract-sync/sync-executor';
import logger from '../../../shared/utils/logger';

/**
 * Trigger Fineract disbursement for a completed handover.
 *
 * Looks up the loan's fineract_loan_id and calls the shared disbursement
 * executor. If Fineract is unreachable or the loan isn't synced, the error
 * is logged but the handover is NOT rolled back.
 *
 * @param loanId - Lynia loan UUID
 * @returns true if disbursement succeeded, false otherwise
 */
export async function triggerDisbursement(loanId: string): Promise<boolean> {
  try {
    // Look up the Fineract loan ID
    const { data: loan } = await db
      .from('loans')
      .select('id, fineract_loan_id, status')
      .eq('id', loanId)
      .single()
      .execute();

    if (!loan) {
      logger.warn('triggerDisbursement: loan not found', {
        action: 'distributor.disbursement.trigger',
        loanId,
      });
      return false;
    }

    if (!loan.fineract_loan_id) {
      logger.warn('triggerDisbursement: loan has no fineract_loan_id — skipping disbursement', {
        action: 'distributor.disbursement.trigger',
        loanId,
      });
      return false;
    }

    logger.info('Triggering Fineract disbursement', {
      action: 'distributor.disbursement.trigger',
      loanId,
      fineractLoanId: loan.fineract_loan_id,
    });

    const success = await disburseLoanInFineract({
      loanId,
      fineractLoanId: loan.fineract_loan_id,
      disbursementDate: new Date(),
    });

    if (success) {
      // Update loan disbursement timestamp
      await db
        .from('loans')
        .update({ disbursed_at: new Date().toISOString() })
        .eq('id', loanId)
        .execute();

      logger.info('Fineract disbursement succeeded', {
        action: 'distributor.disbursement.trigger',
        loanId,
        fineractLoanId: loan.fineract_loan_id,
      });
    } else {
      logger.warn('Fineract disbursement failed — will retry via SQS', {
        action: 'distributor.disbursement.trigger',
        loanId,
        fineractLoanId: loan.fineract_loan_id,
      });
    }

    return success;
  } catch (error) {
    // Non-fatal: handover is already complete, disbursement retries via SQS
    logger.error('triggerDisbursement error — will retry via SQS', {
      action: 'distributor.disbursement.trigger',
      loanId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
