/**
 * Sync KYC Verification to Data Warehouse
 *
 * When a KYC verification completes:
 * 1. Upsert into dw.fact_kyc
 * 2. Update dw.dim_customer if KYC status changed (SCD Type 2)
 */

import { query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';

export async function syncKYC(kycId: string): Promise<void> {
  // Step 1: Upsert into dw.fact_kyc
  const { error: kycError } = await query(
    `INSERT INTO dw.fact_kyc (
      kyc_id,
      customer_key, submission_date_key, geo_key,
      attempt_number, confidence_score, face_match_score, liveness_passed,
      processing_time_seconds,
      id_document_type, verification_status, rejection_reason, kyc_provider,
      submission_date, verification_date,
      etl_loaded_at
    )
    SELECT
      ks.id,
      dc.customer_key,
      TO_CHAR(ks.created_at, 'YYYYMMDD')::INTEGER,
      dg.geo_key,
      ks.attempt_number,
      ks.confidence_score,
      ks.face_match_score,
      ks.liveness_passed,
      EXTRACT(EPOCH FROM (COALESCE(ks.verified_at, NOW()) - ks.created_at)),
      ks.document_type,
      ks.status,
      ks.rejection_reason,
      COALESCE(ks.provider, 'smile_identity'),
      ks.created_at::DATE,
      ks.verified_at::DATE,
      NOW()
    FROM kyc_submissions ks
    LEFT JOIN dw.dim_customer dc ON dc.customer_id = ks.customer_id AND dc.is_current = TRUE
    LEFT JOIN customers c ON c.id = ks.customer_id
    LEFT JOIN dw.dim_geography dg ON dg.province = c.province AND dg.city = c.city
    WHERE ks.id = $1
    ON CONFLICT (kyc_id) DO UPDATE SET
      verification_status = EXCLUDED.verification_status,
      rejection_reason = EXCLUDED.rejection_reason,
      confidence_score = EXCLUDED.confidence_score,
      face_match_score = EXCLUDED.face_match_score,
      liveness_passed = EXCLUDED.liveness_passed,
      processing_time_seconds = EXCLUDED.processing_time_seconds,
      verification_date = EXCLUDED.verification_date,
      etl_loaded_at = NOW()`,
    [kycId]
  );

  if (kycError) {
    logger.error('Failed to upsert fact_kyc', {
      action: 'dw-sync.kyc.fact_kyc',
      status: 'failed',
      metadata: { kycId, error: String(kycError) },
    });
    throw kycError;
  }

  // Step 2: Update dim_customer if KYC status changed (SCD Type 2)
  // Expire old record and insert new current record
  await query(
    `UPDATE dw.dim_customer dc SET
      effective_to = CURRENT_DATE - 1,
      is_current = FALSE
    FROM kyc_submissions ks
    JOIN customers c ON c.id = ks.customer_id
    WHERE ks.id = $1
      AND dc.customer_id = c.id
      AND dc.is_current = TRUE
      AND dc.kyc_status IS DISTINCT FROM c.kyc_status`,
    [kycId]
  );

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
      c.id, c.first_name, c.last_name,
      LEFT(c.phone_number, 4) || '****' || RIGHT(c.phone_number, 3),
      c.province, c.city,
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
      c.monthly_income_usd, c.household_size,
      c.kyc_status, c.credit_tier, c.credit_score,
      'whatsapp', c.created_at::DATE,
      c.fineract_client_id,
      CURRENT_DATE, '9999-12-31'::DATE, TRUE
    FROM kyc_submissions ks
    JOIN customers c ON c.id = ks.customer_id
    WHERE ks.id = $1
      AND NOT EXISTS (
        SELECT 1 FROM dw.dim_customer dc
        WHERE dc.customer_id = c.id AND dc.is_current = TRUE
      )`,
    [kycId]
  );

  logger.info('KYC synced to DW', {
    action: 'dw-sync.kyc',
    status: 'completed',
    metadata: { kycId },
  });
}
