/**
 * POST /scoring/calculate
 *
 * Calculate credit score for a customer. Stores the result in the
 * database and optionally syncs approved customers to Fineract.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import { getSecurityHeaders } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';
import { syncCustomerToFineract, syncLoanToFineract, approveLoanInFineract } from '../../../shared/clients/fineract-sync';
import { calculateRuleBasedScore } from '../scoring/scoring-engine';
import { CreditScoreInput, CreditScoreResult } from '../scoring/types';

export const handleCalculateScore: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');

  // Validate required fields
  if (!body.customer_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'customer_id is required' }),
      headers: getSecurityHeaders(event)
    };
  }

  if (!body.monthly_income_usd || !body.requested_loan_amount || !body.kyc_result) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required fields: monthly_income_usd, requested_loan_amount, kyc_result'
      }),
      headers: getSecurityHeaders(event)
    };
  }

  // Calculate credit score
  const scoreResult = await calculateRuleBasedScore(body as CreditScoreInput);

  // Store score in database
  try {
    const { error: dbError } = await db
      .from('credit_scores')
      .insert({
        customer_id: scoreResult.customer_id,
        total_score: scoreResult.total_raw_score,
        scaled_score: scoreResult.scaled_score,
        affordability_score: scoreResult.components.affordability,
        repayment_willingness_score: scoreResult.components.repayment_willingness,
        mobile_money_score: scoreResult.components.mobile_money,
        external_credit_score: scoreResult.components.external_credit,
        kyc_verification_score: scoreResult.components.kyc_verification,
        scoring_data: scoreResult.components,
        decision: scoreResult.decision,
        credit_tier: scoreResult.tier,
        recommended_limit_usd: scoreResult.credit_limit_usd
      })
      .execute();

    if (dbError) {
      logger.error('Database error storing score', {
        action: 'scoring.calculate',
        status: 'failed',
        errorMessage: String(dbError),
      });
      // Continue even if database storage fails
    }
  } catch (dbError) {
    logger.error('Failed to store score in database', {
      action: 'scoring.calculate',
      status: 'failed',
      errorMessage: dbError instanceof Error ? dbError.message : String(dbError),
    });
    // Continue even if database storage fails
  }

  // Non-blocking: Sync approved customer and loan to Fineract core banking
  if (scoreResult.decision === 'approve' && process.env.FINERACT_SECRET_NAME) {
    syncApprovedCustomerToFineract(scoreResult.customer_id).catch((err) => {
      logger.error('Fineract customer sync failed', {
        action: 'scoring.fineract-sync',
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
    syncApprovedLoanToFineract(scoreResult.customer_id, scoreResult).catch((err) => {
      logger.error('Fineract loan sync failed', {
        action: 'scoring.fineract-sync',
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify(scoreResult),
    headers: getSecurityHeaders(event)
  };
};

// ===================================================================
// FINERACT SYNC (NON-BLOCKING)
// ===================================================================

/**
 * Sync an approved customer to Fineract core banking.
 * Non-blocking: errors are logged but never propagate to the caller.
 * If Fineract is down, the reconciliation job will retry later.
 */
async function syncApprovedCustomerToFineract(customerId: string): Promise<void> {
  try {
    const { data: customer } = await db
      .from('customers')
      .select('id, first_name, last_name, phone_number, date_of_birth, fineract_client_id')
      .eq('id', customerId)
      .single()
      .execute();

    if (!customer || customer.fineract_client_id) return;

    await syncCustomerToFineract({
      customerId: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      mobileNo: customer.phone_number,
    });
  } catch (error) {
    logger.error('Fineract customer sync failed', {
      action: 'scoring.fineract-sync',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      customerId,
    });
  }
}

/**
 * Sync an approved loan to Fineract core banking.
 * Non-blocking: errors are logged but never propagate to the caller.
 * If Fineract is down or the loan doesn't exist yet, the reconciliation job will retry.
 */
async function syncApprovedLoanToFineract(customerId: string, scoreResult: CreditScoreResult): Promise<void> {
  try {
    const { data: customer } = await db
      .from('customers')
      .select('id, fineract_client_id')
      .eq('id', customerId)
      .single()
      .execute();

    if (!customer?.fineract_client_id) return;

    const { data: loan } = await db
      .from('loans')
      .select('id, fineract_loan_id, loan_amount_usd, term_months, product_id')
      .eq('customer_id', customerId)
      .is('fineract_loan_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    if (!loan) return;

    // Database-driven Fineract product mapping
    // Look up fineract_product_id from loan_products table when product_id is available
    let fineractProductId: number;
    if (loan.product_id) {
      try {
        const { data: loanProduct } = await db
          .from('loan_products')
          .select('fineract_product_id, product_category')
          .eq('id', loan.product_id)
          .single()
          .execute();

        if (loanProduct?.fineract_product_id) {
          fineractProductId = loanProduct.fineract_product_id;
        } else {
          // Fallback to tier mapping when fineract_product_id is not set
          const tierToProductId: Record<string, number> = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
          fineractProductId = tierToProductId[scoreResult.tier] || 1;
        }
      } catch {
        // Database query failed — fall back to tier mapping for resilience
        const tierToProductId: Record<string, number> = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
        fineractProductId = tierToProductId[scoreResult.tier] || 1;
      }
    } else {
      // Backward-compatible fallback for existing loans without product_id
      // Tier 1 Entry (LT1E) = 1, Tier 2 Standard (LT2S) = 2, Tier 3 Premium (LT3P) = 3
      const tierToProductId: Record<string, number> = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
      fineractProductId = tierToProductId[scoreResult.tier] || 1;
    }

    const fineractLoanId = await syncLoanToFineract({
      loanId: loan.id,
      customerId,
      fineractClientId: customer.fineract_client_id,
      fineractProductId,
      principal: loan.loan_amount_usd || scoreResult.credit_limit_usd,
      numberOfRepayments: loan.term_months || 6,
      repaymentEveryMonths: 1,
      interestRatePerMonth: scoreResult.interest_rate_apr / 12,
      expectedDisbursementDate: new Date(),
    });

    if (fineractLoanId) {
      await approveLoanInFineract({
        loanId: loan.id,
        fineractLoanId,
      });
    }
  } catch (error) {
    logger.error('Fineract loan sync failed', {
      action: 'scoring.fineract-sync',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      customerId,
    });
  }
}
