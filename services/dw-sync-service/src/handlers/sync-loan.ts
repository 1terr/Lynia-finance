/**
 * Sync Loan to Data Warehouse
 *
 * When a loan event occurs (created, disbursed, status changed, written off):
 * 1. Ensure dimension records exist (customer, device, geography)
 * 2. Upsert the loan into dw.fact_loan
 */

import { query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';

/**
 * Ensure required dimension records exist for the loan.
 * Inserts missing dim_customer, dim_device, and dim_geography rows.
 */
async function ensureDimensions(loanId: string): Promise<void> {
  // Ensure dim_customer exists
  await query(
    `INSERT INTO dw.dim_customer (
      customer_id, first_name, last_name, phone_masked,
      province, city, location_type, employment_status,
      income_band, monthly_income_usd, household_size,
      kyc_status, credit_tier, credit_score,
      onboarding_channel, customer_since,
      fineract_client_id,
      effective_from, effective_to, is_current
    )
    SELECT
      c.id,
      c.first_name,
      c.last_name,
      LEFT(c.phone_number, 4) || '****' || RIGHT(c.phone_number, 3),
      c.province,
      c.city,
      CASE
        WHEN c.city IN ('Harare', 'Bulawayo', 'Chitungwiza', 'Mutare', 'Gweru', 'Kwekwe', 'Masvingo') THEN 'urban'
        WHEN c.city IS NOT NULL THEN 'peri_urban'
        ELSE 'rural'
      END,
      c.employment_status,
      CASE
        WHEN c.monthly_income_usd >= 500 THEN '500+'
        WHEN c.monthly_income_usd >= 300 THEN '300-500'
        WHEN c.monthly_income_usd >= 100 THEN '100-300'
        ELSE '<100'
      END,
      c.monthly_income_usd,
      c.household_size,
      c.kyc_status,
      c.credit_tier,
      c.credit_score,
      'whatsapp',
      c.created_at::DATE,
      c.fineract_client_id,
      CURRENT_DATE,
      '9999-12-31'::DATE,
      TRUE
    FROM loans l
    JOIN customers c ON c.id = l.customer_id
    WHERE l.id = $1
      AND NOT EXISTS (
        SELECT 1 FROM dw.dim_customer dc
        WHERE dc.customer_id = c.id AND dc.is_current = TRUE
      )`,
    [loanId]
  );

  // Ensure dim_device exists
  await query(
    `INSERT INTO dw.dim_device (
      device_id, imei, manufacturer, model, device_type,
      storage_gb, condition, purchase_price_usd, retail_price_usd,
      lock_status, inventory_status,
      effective_from, is_current
    )
    SELECT
      d.id, d.imei, d.manufacturer, d.model, d.device_type,
      d.storage_gb, d.condition, d.purchase_price_usd, d.retail_price_usd,
      d.lock_status, d.status,
      CURRENT_DATE, TRUE
    FROM devices d
    WHERE d.loan_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM dw.dim_device dd WHERE dd.device_id = d.id
      )
      AND d.deleted_at IS NULL`,
    [loanId]
  );

  // Ensure dim_geography exists
  await query(
    `INSERT INTO dw.dim_geography (province, city, location_type, country)
    SELECT DISTINCT
      c.province,
      c.city,
      CASE
        WHEN c.city IN ('Harare', 'Bulawayo', 'Chitungwiza', 'Mutare', 'Gweru', 'Kwekwe', 'Masvingo') THEN 'urban'
        WHEN c.city IS NOT NULL THEN 'peri_urban'
        ELSE 'rural'
      END,
      'Zimbabwe'
    FROM loans l
    JOIN customers c ON c.id = l.customer_id
    WHERE l.id = $1 AND c.province IS NOT NULL
    ON CONFLICT (province, city, location_type) DO NOTHING`,
    [loanId]
  );
}

export async function syncLoan(loanId: string): Promise<void> {
  // Step 1: Ensure dimensions exist
  await ensureDimensions(loanId);

  // Step 2: Upsert into dw.fact_loan
  const { error } = await query(
    `INSERT INTO dw.fact_loan (
      loan_id, loan_number,
      customer_key, product_key, device_key, geo_key, tier_key,
      origination_date_key, maturity_date_key, disbursement_date_key,
      original_principal, deposit_amount, disbursed_amount,
      total_interest, total_amount_due, interest_rate_annual,
      loan_term_months, currency,
      outstanding_balance, total_paid,
      total_penalties, total_penalties_paid, total_written_off,
      days_past_due, missed_payments_count,
      device_value_usd, ltv_ratio,
      credit_score_at_origination,
      affordability_score, repayment_willingness_score,
      mobile_money_score, external_credit_score, kyc_verification_score,
      loan_status, approval_status, deposit_paid,
      is_restructured, reschedule_count,
      application_date, approval_date, disbursement_date,
      maturity_date, close_date, write_off_date,
      last_payment_date, next_payment_date, next_payment_amount,
      fineract_loan_id,
      etl_loaded_at, etl_updated_at
    )
    SELECT
      l.id AS loan_id,
      l.loan_number,
      dc.customer_key,
      dp.product_key,
      dd.device_key,
      dg.geo_key,
      ct.tier_key,
      TO_CHAR(l.created_at, 'YYYYMMDD')::INTEGER AS origination_date_key,
      CASE WHEN l.next_payment_date IS NOT NULL
           THEN TO_CHAR(l.next_payment_date + (l.loan_term_months || ' months')::INTERVAL, 'YYYYMMDD')::INTEGER
           ELSE NULL END AS maturity_date_key,
      CASE WHEN l.disbursed_at IS NOT NULL
           THEN TO_CHAR(l.disbursed_at, 'YYYYMMDD')::INTEGER
           ELSE NULL END AS disbursement_date_key,
      l.loan_amount_usd,
      l.deposit_amount_usd,
      l.disbursed_amount_usd,
      COALESCE(l.total_amount_due_usd - l.loan_amount_usd, 0),
      l.total_amount_due_usd,
      l.interest_rate,
      l.loan_term_months,
      COALESCE(l.currency, 'USD'),
      l.outstanding_balance_usd,
      COALESCE(l.total_paid_usd, 0),
      COALESCE(l.total_penalties_usd, 0),
      COALESCE(l.total_penalties_paid_usd, 0),
      COALESCE(l.written_off_amount_usd, 0),
      COALESCE(l.days_past_due, 0),
      COALESCE(l.missed_payments_count, 0),
      dev.retail_price_usd,
      CASE WHEN dev.retail_price_usd > 0
           THEN l.loan_amount_usd / dev.retail_price_usd
           ELSE NULL END,
      cs.scaled_score,
      cs.affordability_score,
      cs.repayment_willingness_score,
      cs.mobile_money_score,
      cs.external_credit_score,
      cs.kyc_verification_score,
      l.status,
      l.approval_status,
      l.deposit_paid,
      COALESCE(l.reschedule_count, 0) > 0,
      COALESCE(l.reschedule_count, 0),
      l.created_at::DATE,
      l.approved_at::DATE,
      l.disbursed_at::DATE,
      CASE WHEN l.disbursed_at IS NOT NULL
           THEN (l.disbursed_at + (l.loan_term_months || ' months')::INTERVAL)::DATE
           ELSE NULL END,
      l.closed_at::DATE,
      l.write_off_date::DATE,
      l.last_payment_date,
      l.next_payment_date,
      l.next_payment_amount_usd,
      l.fineract_loan_id,
      NOW(),
      NOW()
    FROM loans l
    LEFT JOIN dw.dim_customer dc ON dc.customer_id = l.customer_id AND dc.is_current = TRUE
    LEFT JOIN dw.dim_loan_product dp ON dp.product_id = l.product_id AND dp.is_current = TRUE
    LEFT JOIN devices dev ON dev.loan_id = l.id
    LEFT JOIN dw.dim_device dd ON dd.device_id = dev.id AND dd.is_current = TRUE
    LEFT JOIN customers cust ON cust.id = l.customer_id
    LEFT JOIN dw.dim_geography dg ON dg.province = cust.province AND dg.city = cust.city
    LEFT JOIN dw.dim_credit_tier ct ON ct.tier_code = LOWER(REPLACE(COALESCE(l.approval_status, ''), ' ', '_'))
    LEFT JOIN LATERAL (
      SELECT scaled_score, affordability_score, repayment_willingness_score,
             mobile_money_score, external_credit_score, kyc_verification_score
      FROM credit_scores
      WHERE loan_id = l.id OR (customer_id = l.customer_id AND loan_id IS NULL)
      ORDER BY calculated_at DESC
      LIMIT 1
    ) cs ON TRUE
    WHERE l.id = $1
    ON CONFLICT (loan_id) DO UPDATE SET
      outstanding_balance = EXCLUDED.outstanding_balance,
      total_paid = EXCLUDED.total_paid,
      total_penalties = EXCLUDED.total_penalties,
      total_penalties_paid = EXCLUDED.total_penalties_paid,
      total_written_off = EXCLUDED.total_written_off,
      days_past_due = EXCLUDED.days_past_due,
      missed_payments_count = EXCLUDED.missed_payments_count,
      loan_status = EXCLUDED.loan_status,
      approval_status = EXCLUDED.approval_status,
      deposit_paid = EXCLUDED.deposit_paid,
      disbursement_date_key = EXCLUDED.disbursement_date_key,
      disbursement_date = EXCLUDED.disbursement_date,
      disbursed_amount = EXCLUDED.disbursed_amount,
      maturity_date = EXCLUDED.maturity_date,
      close_date = EXCLUDED.close_date,
      write_off_date = EXCLUDED.write_off_date,
      last_payment_date = EXCLUDED.last_payment_date,
      next_payment_date = EXCLUDED.next_payment_date,
      next_payment_amount = EXCLUDED.next_payment_amount,
      is_restructured = EXCLUDED.is_restructured,
      reschedule_count = EXCLUDED.reschedule_count,
      device_key = EXCLUDED.device_key,
      etl_updated_at = NOW()`,
    [loanId]
  );

  if (error) {
    logger.error('Failed to upsert fact_loan', {
      action: 'dw-sync.loan.fact_loan',
      status: 'failed',
      metadata: { loanId, error: String(error) },
    });
    throw error;
  }

  logger.info('Loan synced to DW', {
    action: 'dw-sync.loan',
    status: 'completed',
    metadata: { loanId },
  });
}
