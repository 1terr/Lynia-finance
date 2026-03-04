/**
 * WhatsApp Onboarding - Credit Scoring State Handler
 *
 * Calls the scoring service and presents results to the customer.
 */

import { db } from '../../../../shared/clients/database';
import axios from 'axios';
import { logger } from '../../../../shared/utils/logger';
import { t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle CREDIT_SCORING state
 */
export async function handleCreditScoring(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  // Call credit scoring service
  try {
    // Fetch real KYC data from the latest submission
    const { data: kycSubmission } = await db
      .from('kyc_submissions')
      .select('verification_confidence, face_match_score, liveness_score, verification_decision')
      .eq('customer_id', session.customer_id || `temp_${context.from}`)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    const scoringPayload = {
      customer_id: session.customer_id || `temp_${context.from}`,
      monthly_income_usd: session.state_data.monthly_income_usd || 200,
      existing_debt_obligations_usd: session.state_data.existing_debt_obligations_usd || 0,
      household_size: session.state_data.household_size || 1,
      dependents: session.state_data.dependents || 0,
      requested_loan_amount: session.state_data.requested_loan_amount || 250,
      kyc_result: kycSubmission ? {
        id_verification: {
          status: (kycSubmission.verification_decision ?? 'APPROVED') === 'APPROVED' ? 'verified' as const
            : (kycSubmission.verification_decision === 'MANUAL_REVIEW' ? 'review' as const : 'failed' as const)
        },
        face_match_score: kycSubmission.face_match_score ?? 96,
        liveness_passed: (kycSubmission.liveness_score ?? 0) >= 50,
      } : {
        id_verification: { status: 'verified' as const },
        face_match_score: 96,
        liveness_passed: true,
      }
    };

    // Call scoring service (when deployed)
    const SCORING_API_URL = process.env.SCORING_API_URL!;
    const response = await axios.post(SCORING_API_URL, scoringPayload);
    const scoreResult = response.data;

    await updateSession(context.from, {
      current_state: 'loan_offer',
      state_data: {
        ...session.state_data,
        credit_score: scoreResult.scaled_score,
        credit_tier: scoreResult.tier,
        credit_limit_usd: scoreResult.credit_limit_usd,
        down_payment_percentage: scoreResult.down_payment_percentage,
        interest_rate_apr: scoreResult.interest_rate_apr,
        decision: scoreResult.decision
      }
    });

    if (scoreResult.decision === 'approve') {
      return `\uD83C\uDF89 *Congratulations! You're Approved!*

Your Loan Details:
\uD83D\uDCB0 *Loan Limit:* $${scoreResult.credit_limit_usd}
\uD83C\uDFC6 *Credit Tier:* ${scoreResult.tier}
\uD83D\uDCCA *Credit Score:* ${scoreResult.scaled_score}/850

You can now choose a smartphone up to $${scoreResult.credit_limit_usd}.

\uD83D\uDCF1 *Available Devices:*
\u2022 Samsung A15 - $180
\u2022 Tecno Spark 20 - $150
\u2022 Infinix Note 30 - $195

*Payment Plan:*
\u2022 6 months installments
\u2022 ${scoreResult.down_payment_percentage}% down payment
\u2022 ${scoreResult.interest_rate_apr}% APR

Ready to continue?
Reply *Yes* to see loan terms`;
    }

    if (scoreResult.decision === 'review') {
      return `\u23F8\uFE0F *Manual Review Required*

We need to manually review your application. This takes up to 24 hours.

You'll receive a WhatsApp message when ready.

Our team will review:
\u2022 Income information
\u2022 Identity verification
\u2022 Eligibility criteria

Usually takes 2-12 hours.`;
    }

    return `\u274C *Application Not Approved*

Unfortunately, we cannot approve your application at this time.

Possible reasons:
\u2022 Income below minimum threshold
\u2022 Debt-to-income ratio too high
\u2022 Incomplete information

You can try again in 30 days or contact support: support@lynia.finance`;

  } catch (error) {
    logger.error('Credit scoring failed', { action: 'scoring.calculate', meta: { error: error instanceof Error ? error.message : 'Unknown' } });

    // Do NOT auto-approve when scoring service is unavailable.
    // Keep session in credit_scoring state so customer can retry.
    const lang: SupportedLanguage = session.state_data.preferred_language || 'en';
    return t('scoring_unavailable', lang) + `\nReference: SCORE-${Date.now()}`;
  }
}
