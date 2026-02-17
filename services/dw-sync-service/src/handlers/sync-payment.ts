/**
 * Sync Payment to Data Warehouse
 *
 * When a payment is confirmed (webhook success), this handler:
 * 1. Upserts the payment into dw.fact_payment
 * 2. Updates the associated loan in dw.fact_loan (totals, DPD, last_payment_date)
 */

import { query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';

export async function syncPayment(paymentId: string): Promise<void> {
  // Step 1: Upsert into dw.fact_payment
  const { error: paymentError } = await query(
    `INSERT INTO dw.fact_payment (
      payment_id,
      loan_key, customer_key, provider_key, payment_date_key,
      amount, currency, amount_usd,
      payment_type, payment_method, payment_status,
      payment_date, confirmed_date,
      fineract_transaction_id,
      etl_loaded_at
    )
    SELECT
      p.id AS payment_id,
      fl.loan_key,
      dc.customer_key,
      pp.provider_key,
      TO_CHAR(COALESCE(p.payment_date, p.created_at), 'YYYYMMDD')::INTEGER AS payment_date_key,
      p.amount_usd AS amount,
      COALESCE(p.currency, 'USD') AS currency,
      p.amount_usd AS amount_usd,
      p.payment_type,
      p.payment_method,
      p.status AS payment_status,
      COALESCE(p.payment_date, p.created_at)::DATE AS payment_date,
      p.confirmed_at::DATE AS confirmed_date,
      p.fineract_transaction_id,
      NOW() AS etl_loaded_at
    FROM payments p
    LEFT JOIN dw.fact_loan fl ON fl.loan_id = p.loan_id
    LEFT JOIN dw.dim_customer dc ON dc.customer_id = p.customer_id AND dc.is_current = TRUE
    LEFT JOIN dw.dim_payment_provider pp ON pp.provider_code = COALESCE(p.payment_provider, p.payment_method)
    WHERE p.id = $1
    ON CONFLICT (payment_id) DO UPDATE SET
      payment_status = EXCLUDED.payment_status,
      confirmed_date = EXCLUDED.confirmed_date,
      fineract_transaction_id = EXCLUDED.fineract_transaction_id,
      etl_loaded_at = NOW()`,
    [paymentId]
  );

  if (paymentError) {
    logger.error('Failed to upsert fact_payment', {
      action: 'dw-sync.payment.fact_payment',
      status: 'failed',
      metadata: { paymentId, error: String(paymentError) },
    });
    throw paymentError;
  }

  // Step 2: Update the associated loan's running totals
  const { error: loanError } = await query(
    `UPDATE dw.fact_loan fl SET
      total_paid = COALESCE((
        SELECT SUM(p.amount_usd)
        FROM payments p
        WHERE p.loan_id = fl.loan_id AND p.status = 'confirmed'
      ), 0),
      outstanding_balance = l.outstanding_balance_usd,
      days_past_due = COALESCE(l.days_past_due, 0),
      last_payment_date = l.last_payment_date,
      next_payment_date = l.next_payment_date,
      next_payment_amount = l.next_payment_amount_usd,
      loan_status = l.status,
      etl_updated_at = NOW()
    FROM payments p
    JOIN loans l ON l.id = p.loan_id
    WHERE p.id = $1
      AND fl.loan_id = p.loan_id`,
    [paymentId]
  );

  if (loanError) {
    logger.error('Failed to update fact_loan after payment', {
      action: 'dw-sync.payment.fact_loan',
      status: 'failed',
      metadata: { paymentId, error: String(loanError) },
    });
    throw loanError;
  }

  logger.info('Payment synced to DW', {
    action: 'dw-sync.payment',
    status: 'completed',
    metadata: { paymentId },
  });
}
