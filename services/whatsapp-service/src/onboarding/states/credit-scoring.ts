/**
 * WhatsApp Onboarding - Credit Scoring State Handler
 *
 * Calls the scoring service and presents results to the customer.
 * On approval, fetches available devices from DB and transitions to device_selection.
 */

import { db, query } from '../../../../shared/clients/database';
import axios from 'axios';
import { logger } from '../../../../shared/utils/logger';
import { t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

interface DeviceRow {
  id: string;
  brand: string;
  model_name: string;
  retail_price_usd: number;
}

/**
 * Fetch active devices with stock, within the customer's credit limit.
 */
async function fetchAvailableDevices(creditLimitUsd: number): Promise<DeviceRow[]> {
  const { data, error } = await query<DeviceRow>(
    `SELECT id, brand, model_name, retail_price_usd
     FROM device_models
     WHERE retail_price_usd <= $1
       AND is_active = true
       AND deleted_at IS NULL
       AND available_stock > 0
     ORDER BY retail_price_usd ASC`,
    [creditLimitUsd]
  );

  if (error) {
    logger.error('Failed to fetch device models', {
      action: 'devices.fetch',
      status: 'failed',
      meta: { error: error.message },
    });
    return [];
  }

  return data;
}

/**
 * Handle CREDIT_SCORING state
 */
export async function handleCreditScoring(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
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

    // Call scoring service
    const SCORING_API_URL = process.env.SCORING_API_URL!;
    const response = await axios.post(SCORING_API_URL, scoringPayload);
    const scoreResult = response.data;

    if (scoreResult.decision === 'approve') {
      // Fetch available devices within credit limit
      const devices = await fetchAvailableDevices(scoreResult.credit_limit_usd);

      if (devices.length === 0) {
        // Store scoring result but keep in credit_scoring state
        await updateSession(context.from, {
          state_data: {
            ...session.state_data,
            credit_score: scoreResult.scaled_score,
            credit_tier: scoreResult.tier,
            credit_limit_usd: scoreResult.credit_limit_usd,
            down_payment_percentage: scoreResult.down_payment_percentage,
            interest_rate_apr: scoreResult.interest_rate_apr,
            decision: scoreResult.decision,
          }
        });

        return `*Congratulations! You're Approved!*

Credit Limit: $${scoreResult.credit_limit_usd}
Credit Score: ${scoreResult.scaled_score}/850

However, there are no devices currently available in your price range. We will notify you when new stock arrives.

Contact support@lynia.finance for more information.`;
      }

      // Store scoring result + devices, transition to device_selection
      await updateSession(context.from, {
        current_state: 'device_selection',
        state_data: {
          ...session.state_data,
          credit_score: scoreResult.scaled_score,
          credit_tier: scoreResult.tier,
          credit_limit_usd: scoreResult.credit_limit_usd,
          down_payment_percentage: scoreResult.down_payment_percentage,
          interest_rate_apr: scoreResult.interest_rate_apr,
          decision: scoreResult.decision,
          available_devices: devices,
        }
      });

      const deviceList = devices
        .map((d, i) => `${i + 1}. ${d.brand} ${d.model_name} - $${d.retail_price_usd}`)
        .join('\n');

      return `*Congratulations! You're Approved!*

Your Credit Details:
Loan Limit: $${scoreResult.credit_limit_usd}
Credit Tier: ${scoreResult.tier}
Credit Score: ${scoreResult.scaled_score}/850

Choose your smartphone:

${deviceList}

Reply with the number of your choice (e.g. *1*)`;
    }

    // Store result for non-approval decisions
    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        credit_score: scoreResult.scaled_score,
        credit_tier: scoreResult.tier,
        credit_limit_usd: scoreResult.credit_limit_usd,
        decision: scoreResult.decision,
      }
    });

    if (scoreResult.decision === 'review') {
      return `*Manual Review Required*

We need to manually review your application. This takes up to 24 hours.

You'll receive a WhatsApp message when ready.

Our team will review:
- Income information
- Identity verification
- Eligibility criteria

Usually takes 2-12 hours.`;
    }

    return `*Application Not Approved*

Unfortunately, we cannot approve your application at this time.

Possible reasons:
- Income below minimum threshold
- Debt-to-income ratio too high
- Incomplete information

You can try again in 30 days or contact support: support@lynia.finance`;

  } catch (error) {
    logger.error('Credit scoring failed', { action: 'scoring.calculate', meta: { error: error instanceof Error ? error.message : 'Unknown' } });

    // Do NOT auto-approve when scoring service is unavailable.
    // Keep session in credit_scoring state so customer can retry.
    const lang: SupportedLanguage = session.state_data.preferred_language || 'en';
    return t('scoring_unavailable', lang) + `\nReference: SCORE-${Date.now()}`;
  }
}
