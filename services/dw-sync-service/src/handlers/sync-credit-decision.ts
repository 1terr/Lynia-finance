/**
 * Sync Credit Decision to Data Warehouse
 *
 * When a credit score is calculated, upsert into dw.fact_credit_decision.
 */

import { query } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';

export async function syncCreditDecision(scoreId: string): Promise<void> {
  const { error } = await query(
    `INSERT INTO dw.fact_credit_decision (
      score_id,
      customer_key, loan_key, scoring_date_key, tier_key,
      total_score, scaled_score,
      affordability_score, repayment_willingness_score,
      mobile_money_score, external_credit_score, kyc_verification_score,
      decision, credit_tier, recommended_limit_usd,
      model_version, scoring_date,
      etl_loaded_at
    )
    SELECT
      cs.id,
      dc.customer_key,
      fl.loan_key,
      TO_CHAR(cs.calculated_at, 'YYYYMMDD')::INTEGER,
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
      cs.calculated_at::DATE,
      NOW()
    FROM credit_scores cs
    LEFT JOIN dw.dim_customer dc ON dc.customer_id = cs.customer_id AND dc.is_current = TRUE
    LEFT JOIN dw.fact_loan fl ON fl.loan_id = cs.loan_id
    LEFT JOIN dw.dim_credit_tier ct ON ct.tier_code = LOWER(REPLACE(COALESCE(cs.credit_tier, ''), ' ', '_'))
    WHERE cs.id = $1
    ON CONFLICT (score_id) DO UPDATE SET
      total_score = EXCLUDED.total_score,
      scaled_score = EXCLUDED.scaled_score,
      decision = EXCLUDED.decision,
      credit_tier = EXCLUDED.credit_tier,
      recommended_limit_usd = EXCLUDED.recommended_limit_usd,
      etl_loaded_at = NOW()`,
    [scoreId]
  );

  if (error) {
    logger.error('Failed to upsert fact_credit_decision', {
      action: 'dw-sync.credit.fact_credit_decision',
      status: 'failed',
      metadata: { scoreId, error: String(error) },
    });
    throw error;
  }

  logger.info('Credit decision synced to DW', {
    action: 'dw-sync.credit',
    status: 'completed',
    metadata: { scoreId },
  });
}
