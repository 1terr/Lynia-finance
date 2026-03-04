/**
 * POST /scoring/calculate
 *
 * Calculate credit score for a customer. Stores the result in the
 * database and optionally syncs approved customers to Fineract.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import { getSecurityHeaders } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';
import { syncCustomerToFineract } from '../../../shared/clients/fineract-sync';
import { calculateRuleBasedScore } from '../scoring/scoring-engine';
import { CreditScoreInput } from '../scoring/types';

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

  // Check if customer already has an active loan (by national ID to catch re-registrations)
  try {
    const { data: customer } = await db
      .from('customers')
      .select('national_id')
      .eq('id', body.customer_id)
      .single()
      .execute();

    if (customer?.national_id) {
      const { data: existingLoans } = await query<{ id: string }>(
        `SELECT l.id FROM loans l
         JOIN customers c ON c.id = l.customer_id
         WHERE c.national_id = $1
           AND l.status IN ('approved', 'paid_deposit', 'active')
         LIMIT 1`,
        [customer.national_id]
      );

      if (existingLoans && existingLoans.length > 0) {
        return {
          statusCode: 409,
          body: JSON.stringify({
            error: 'You already have an active loan. Please complete your current loan before applying for a new one.',
            code: 'LOAN_DUP_001',
            existing_loan_id: existingLoans[0].id,
          }),
          headers: getSecurityHeaders(event)
        };
      }
    }
  } catch (dupCheckError) {
    logger.error('Duplicate loan check failed', {
      action: 'scoring.duplicate-check',
      status: 'failed',
      errorMessage: dupCheckError instanceof Error ? dupCheckError.message : String(dupCheckError),
    });
    // Continue scoring — don't block on check failure
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
        scoring_data: { ...scoreResult.components, employment_type: body.employment_type || null },
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

  // Non-blocking: Sync approved customer to Fineract core banking.
  // Loan sync is deferred to post-terms-acceptance (when device + term are selected).
  if (scoreResult.decision === 'approve' && process.env.FINERACT_SECRET_NAME) {
    syncApprovedCustomerToFineract(scoreResult.customer_id).catch((err) => {
      logger.error('Fineract customer sync failed', {
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

// NOTE: Loan sync to Fineract is now deferred to post-terms-acceptance
// (when device selection + term selection are finalized in the WhatsApp flow).
// The reconciliation job handles any missed syncs.
// See: services/whatsapp-service/src/onboarding/states/loan-offer.ts (handleTermsAcceptance)
