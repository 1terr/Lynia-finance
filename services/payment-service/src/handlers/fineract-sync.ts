/**
 * Fineract Sync Helper
 *
 * Syncs completed payments to Fineract core banking as loan repayments.
 * Non-blocking: errors are logged but never propagate to the caller.
 * If Fineract is down, the reconciliation job will retry later.
 */

import { syncRepaymentToFineract, disburseLoanInFineract } from '../../../shared/clients/fineract-sync';
import { db } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';

export async function syncPaymentToFineract(paymentId: string): Promise<void> {
  try {
    const { data: payment } = await db
      .from('payments')
      .select('id, loan_id, amount, completed_at, fineract_transaction_id, payment_type')
      .eq('id', paymentId)
      .single()
      .execute();

    if (!payment || payment.fineract_transaction_id) return;

    const { data: loan } = await db
      .from('loans')
      .select('id, fineract_loan_id')
      .eq('id', payment.loan_id)
      .single()
      .execute();

    if (!loan?.fineract_loan_id) return;

    await syncRepaymentToFineract({
      paymentId: payment.id,
      loanId: payment.loan_id,
      fineractLoanId: loan.fineract_loan_id,
      amount: payment.amount,
      transactionDate: new Date(payment.completed_at),
    });

    // If this is a deposit (down payment), disburse the loan in Fineract
    if (payment.payment_type === 'deposit') {
      disburseLoanInFineract({
        loanId: payment.loan_id,
        fineractLoanId: loan.fineract_loan_id,
        disbursementDate: new Date(payment.completed_at),
      }).catch((err) => {
        logger.error(`[fineract-sync] Background disbursement sync failed for loan ${payment.loan_id}`, { action: 'fineract.disburse', meta: { error: err instanceof Error ? err.message : String(err) } });
      });
    }
  } catch (error) {
    logger.error(`[fineract-sync] Failed to sync payment ${paymentId}`, { action: 'fineract.sync', meta: { error: error instanceof Error ? error.message : String(error) } });
  }
}
