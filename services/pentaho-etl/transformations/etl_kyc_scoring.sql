-- =====================================================
-- Pentaho ETL: KYC & Credit Decision Facts
-- Called by PDI job 07_load_kyc_and_scoring.kjb
-- Loads KYC submissions and credit scoring events
-- =====================================================

-- =====================================================
-- 1. FACT_KYC: Load new KYC submissions
-- =====================================================
INSERT INTO dw.fact_kyc (
  kyc_id, customer_key, submission_date_key, geo_key,
  attempt_number, confidence_score, face_match_score,
  liveness_passed, processing_time_seconds,
  id_document_type, verification_status, rejection_reason,
  kyc_provider,
  submission_date, verification_date,
  etl_loaded_at
)
SELECT
  ks.id AS kyc_id,
  dc.customer_key,
  TO_CHAR(ks.submitted_at, 'YYYYMMDD')::INTEGER AS submission_date_key,
  dg.geo_key,
  ks.attempt_number,
  ks.confidence_score,
  ks.face_match_score,
  ks.liveness_passed,
  CASE WHEN ks.verified_at IS NOT NULL AND ks.submitted_at IS NOT NULL
       THEN EXTRACT(EPOCH FROM (ks.verified_at - ks.submitted_at))
       ELSE NULL END AS processing_time_seconds,
  ks.id_document_type,
  ks.status AS verification_status,
  ks.rejection_reason,
  COALESCE(ks.kyc_provider, 'didit') AS kyc_provider,
  ks.submitted_at::DATE AS submission_date,
  ks.verified_at::DATE AS verification_date,
  NOW() AS etl_loaded_at
FROM kyc_submissions ks
LEFT JOIN dw.dim_customer dc ON dc.customer_id = ks.customer_id AND dc.is_current = TRUE
LEFT JOIN customers c ON c.id = ks.customer_id
LEFT JOIN dw.dim_geography dg ON dg.province = c.province AND dg.city = c.city
WHERE NOT EXISTS (
  SELECT 1 FROM dw.fact_kyc fk WHERE fk.kyc_id = ks.id
);

-- =====================================================
-- 2. FACT_CREDIT_DECISION: Load new scoring events
-- =====================================================
INSERT INTO dw.fact_credit_decision (
  score_id, customer_key, loan_key, scoring_date_key, tier_key,
  total_score, scaled_score,
  affordability_score, repayment_willingness_score,
  mobile_money_score, external_credit_score, kyc_verification_score,
  decision, credit_tier, recommended_limit_usd,
  model_version, scoring_date,
  etl_loaded_at
)
SELECT
  cs.id AS score_id,
  dc.customer_key,
  fl.loan_key,
  TO_CHAR(cs.calculated_at, 'YYYYMMDD')::INTEGER AS scoring_date_key,
  ct.tier_key,
  cs.total_score,
  cs.scaled_score,
  cs.affordability_score,
  cs.repayment_willingness_score,
  cs.mobile_money_score,
  cs.external_credit_score,
  cs.kyc_verification_score,
  cs.decision,
  cs.credit_tier,
  cs.recommended_limit_usd,
  cs.model_version,
  cs.calculated_at::DATE AS scoring_date,
  NOW() AS etl_loaded_at
FROM credit_scores cs
LEFT JOIN dw.dim_customer dc ON dc.customer_id = cs.customer_id AND dc.is_current = TRUE
LEFT JOIN dw.fact_loan fl ON fl.loan_id = cs.loan_id
LEFT JOIN dw.dim_credit_tier ct ON ct.tier_code = LOWER(REPLACE(COALESCE(cs.credit_tier, ''), ' ', '_'))
WHERE NOT EXISTS (
  SELECT 1 FROM dw.fact_credit_decision fcd WHERE fcd.score_id = cs.id
);
