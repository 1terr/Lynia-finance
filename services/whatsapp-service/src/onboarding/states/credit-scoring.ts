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
 * If a loan product has linked device models (via product_device_models),
 * only those models are returned. Otherwise, all eligible models are shown.
 */
async function fetchAvailableDevices(creditLimitUsd: number, productId?: string): Promise<DeviceRow[]> {
  // If a product ID is given, check if it has linked device models
  let useProductFilter = false;
  if (productId) {
    const { data: linkCount } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM product_device_models WHERE product_id = $1`,
      [productId]
    );
    useProductFilter = parseInt(linkCount?.[0]?.count || '0') > 0;
  }

  const sql = useProductFilter
    ? `SELECT dm.id, dm.brand, dm.model_name, dm.retail_price_usd
       FROM device_models dm
       JOIN product_device_models pdm ON pdm.device_model_id = dm.id
       WHERE pdm.product_id = $2
         AND dm.retail_price_usd <= $1
         AND dm.is_active = true
         AND dm.deleted_at IS NULL
         AND dm.available_stock > 0
       ORDER BY dm.retail_price_usd ASC`
    : `SELECT id, brand, model_name, retail_price_usd
       FROM device_models
       WHERE retail_price_usd <= $1
         AND is_active = true
         AND deleted_at IS NULL
         AND available_stock > 0
       ORDER BY retail_price_usd ASC`;

  const params: unknown[] = useProductFilter ? [creditLimitUsd, productId] : [creditLimitUsd];

  const { data, error } = await query<DeviceRow>(sql, params);

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
 * Resolve the best matching loan product for a smartphone financing request.
 * Picks the active smartphone product whose amount range covers the credit limit.
 */
async function resolveSmartphoneProduct(creditLimitUsd: number): Promise<string | undefined> {
  const { data } = await query<{ id: string }>(
    `SELECT id FROM loan_products
     WHERE product_category = 'smartphone'
       AND status = 'active'
       AND deleted_at IS NULL
       AND min_amount_usd <= $1
       AND max_amount_usd >= $1
     ORDER BY display_order ASC
     LIMIT 1`,
    [creditLimitUsd]
  );
  return data?.[0]?.id;
}

/**
 * Fetch repayment history for repeat customers.
 * Returns metrics from past loans/payments for the scoring engine.
 */
async function fetchRepaymentHistory(customerId: string) {
  try {
    const { data: loanStats } = await query<{
      loan_count: string;
      total_missed: string;
    }>(
      `SELECT COUNT(*) as loan_count, COALESCE(SUM(missed_payments_count), 0) as total_missed
       FROM loans
       WHERE customer_id = $1
         AND status IN ('active', 'paid_off', 'defaulted', 'disbursed')`,
      [customerId]
    );

    const { data: paymentStats } = await query<{
      confirmed_payments: string;
    }>(
      `SELECT COUNT(*) as confirmed_payments
       FROM payments
       WHERE customer_id = $1
         AND payment_type = 'installment'
         AND status = 'confirmed'`,
      [customerId]
    );

    const loanCount = parseInt(loanStats?.[0]?.loan_count || '0', 10);
    const totalMissed = parseInt(loanStats?.[0]?.total_missed || '0', 10);
    const confirmedPayments = parseInt(paymentStats?.[0]?.confirmed_payments || '0', 10);

    const totalPayments = confirmedPayments + totalMissed;
    const onTimeRate = totalPayments > 0
      ? Math.min(confirmedPayments / totalPayments, 1)
      : 0;

    return {
      previous_loans_count: loanCount,
      on_time_payment_rate: onTimeRate,
      bill_payment_consistency: onTimeRate, // Best available proxy
      communication_response_rate: 0.75,    // Neutral — no WhatsApp response tracking yet
    };
  } catch (error) {
    logger.error('Failed to fetch repayment history', {
      action: 'scoring.repayment-history',
      status: 'failed',
      meta: { error: error instanceof Error ? error.message : 'Unknown' },
    });
    return { previous_loans_count: 0, on_time_payment_rate: 0, bill_payment_consistency: 0, communication_response_rate: 0.75 };
  }
}

/**
 * Handle CREDIT_SCORING state
 */
export async function handleCreditScoring(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  try {
    // ── Gap 5: Fail fast if required fields are missing ──────────────
    const requiredFields = {
      monthly_income_usd: session.state_data.monthly_income_usd,
      requested_loan_amount: session.state_data.requested_loan_amount,
      household_size: session.state_data.household_size,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => value === undefined || value === null)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      logger.error('Missing required fields for scoring', {
        action: 'scoring.validation-failed',
        status: 'failed',
        meta: { missingFields, customer_id: session.customer_id },
      });
      return `We're missing some information needed to assess your application. Please type *RESTART* to begin again and ensure all questions are answered.`;
    }

    // ── Gap 2: KYC safety — reject if no verified submission found ───
    const { data: kycSubmission } = await db
      .from('kyc_submissions')
      .select('verification_confidence, face_match_score, liveness_score, verification_decision, status')
      .eq('customer_id', session.customer_id || `temp_${context.from}`)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    if (!kycSubmission) {
      logger.error('No KYC submission found for scoring', {
        action: 'scoring.kyc-missing',
        status: 'failed',
        meta: { customer_id: session.customer_id || `temp_${context.from}` },
      });
      return `Your identity verification is incomplete. Please complete the KYC process before we can assess your application.\n\nType *RESTART* to begin again or *SUPPORT* for help.`;
    }

    // Block scoring if KYC is not verified — prevents unverified customers from being approved
    if (kycSubmission.status !== 'verified' && kycSubmission.verification_decision !== 'APPROVED') {
      logger.warn('KYC not verified, blocking credit scoring', {
        action: 'scoring.kyc-not-verified',
        status: 'failed',
        meta: {
          customer_id: session.customer_id || `temp_${context.from}`,
          kyc_status: kycSubmission.status,
          verification_decision: kycSubmission.verification_decision,
        },
      });
      return `Your identity verification is still being processed. We'll notify you via WhatsApp once it's complete.\n\nYou cannot proceed to loan assessment until your identity is verified.\n\nType *SUPPORT* for help.`;
    }

    // ── Gap 1: Fetch repayment history for repeat customers ──────────
    const repaymentHistory = await fetchRepaymentHistory(session.customer_id);

    // ── Build scoring payload (Gaps 2, 3, 4, 5 applied) ─────────────
    const scoringPayload = {
      customer_id: session.customer_id || `temp_${context.from}`,

      // Gap 5: Use validated values — no dangerous defaults
      monthly_income_usd: session.state_data.monthly_income_usd!,
      existing_debt_obligations_usd: session.state_data.existing_debt_obligations_usd ?? 0,
      household_size: session.state_data.household_size!,
      dependents: session.state_data.dependents ?? 0,
      requested_loan_amount: session.state_data.requested_loan_amount!,

      // Gap 3: Product category passthrough (map digital_credit → digital)
      product_category: session.state_data.selected_product === 'digital_credit' ? 'digital' as const : 'smartphone' as const,

      // Gap 4: Employment type passthrough (stored in scoring_data for future use)
      employment_type: session.state_data.employment_type,

      // Gap 2: Real KYC data only — no fake defaults
      kyc_result: {
        id_verification: {
          status: kycSubmission.verification_decision === 'APPROVED' ? 'verified' as const
            : kycSubmission.verification_decision === 'MANUAL_REVIEW' ? 'review' as const
            : 'failed' as const,
        },
        face_match_score: kycSubmission.face_match_score ?? 0,
        liveness_passed: (kycSubmission.liveness_score ?? 0) >= 50,
      },

      // Gap 1: Repeat customer repayment data
      ...(repaymentHistory.previous_loans_count > 0 ? {
        previous_loans_count: repaymentHistory.previous_loans_count,
        on_time_payment_rate: repaymentHistory.on_time_payment_rate,
        bill_payment_consistency: repaymentHistory.bill_payment_consistency,
        communication_response_rate: repaymentHistory.communication_response_rate,
      } : {}),
    };

    // Call scoring service
    const SCORING_API_URL = process.env.SCORING_API_URL!;
    const response = await axios.post(SCORING_API_URL, scoringPayload, {
      validateStatus: (status) => status < 500, // Don't throw on 4xx
    });

    // Handle duplicate loan rejection (409)
    if (response.status === 409) {
      await updateSession(context.from, {
        current_state: 'rejected',
        state_data: {
          ...session.state_data,
          decision: 'reject',
          rejection_reason: 'existing_loan',
        }
      });

      return `You already have an active loan with Lynia Finance.

Please complete your current loan before applying for a new one.

Type *BALANCE* to check your loan balance or *SUPPORT* for help.`;
    }

    if (response.status !== 200) {
      throw new Error(`Scoring service returned status ${response.status}`);
    }

    const scoreResult = response.data;

    // Handle rejection — score below minimum threshold
    if (scoreResult.decision === 'reject') {
      await updateSession(context.from, {
        current_state: 'rejected',
        state_data: {
          ...session.state_data,
          credit_score: scoreResult.scaled_score,
          credit_tier: scoreResult.tier,
          decision: scoreResult.decision,
          matched_product_id: scoreResult.matched_product_id,
          matched_product_code: scoreResult.matched_product_code,
        }
      });

      return `We've assessed your application and unfortunately we're unable to approve a loan at this time.

Your Credit Score: ${scoreResult.scaled_score}/850

*How to improve your chances:*
1. Build a consistent payment history (airtime, bills)
2. Reduce existing debt obligations
3. Increase your income documentation
4. Try again after 3 months

Type *SUPPORT* if you have questions or need help.`;
    }

    // ── Digital credit: skip device selection, go to amount selection ──
    if (session.state_data.selected_product === 'digital_credit') {
      // Cap credit limit to org-specific lending limits
      const orgLimits = session.state_data.org_lending_limits;
      const effectiveLimit = orgLimits
        ? Math.min(scoreResult.credit_limit_usd, orgLimits.max_loan_amount)
        : scoreResult.credit_limit_usd;

      const minAmount = orgLimits?.min_loan_amount ?? 20;

      await updateSession(context.from, {
        current_state: 'amount_selection',
        state_data: {
          ...session.state_data,
          credit_score: scoreResult.scaled_score,
          credit_tier: scoreResult.tier,
          credit_limit_usd: effectiveLimit,
          down_payment_percentage: 0,
          interest_rate_apr: orgLimits?.interest_rate_apr ?? scoreResult.interest_rate_apr,
          decision: scoreResult.decision,
          matched_product_id: scoreResult.matched_product_id,
          matched_product_code: scoreResult.matched_product_code,
          matched_product_min_term: orgLimits?.min_term_months ?? 1,
          matched_product_max_term: orgLimits?.max_term_months ?? 6,
        }
      });

      return `*Congratulations! You're Approved!*

Your Credit Details:
Credit Limit: *$${effectiveLimit.toFixed(2)}*
Credit Score: ${scoreResult.scaled_score}/850

How much would you like to borrow?
Enter an amount between $${minAmount} and $${effectiveLimit.toFixed(2)}`;
    }

    // ── Smartphone financing: device selection flow (existing) ──
    const resolvedProductId = await resolveSmartphoneProduct(scoreResult.credit_limit_usd);
    const devices = await fetchAvailableDevices(scoreResult.credit_limit_usd, resolvedProductId);

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
          matched_product_id: scoreResult.matched_product_id,
          matched_product_code: scoreResult.matched_product_code,
        }
      });

      return `*Congratulations! You're Approved!*

Credit Limit: $${scoreResult.credit_limit_usd}
Credit Score: ${scoreResult.scaled_score}/850

However, there are no devices currently available in your price range. Please check back later or contact support@lynia.finance for assistance.`;
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
        resolved_product_id: resolvedProductId,
        matched_product_id: scoreResult.matched_product_id,
        matched_product_code: scoreResult.matched_product_code,
        matched_product_min_term: 6,
        matched_product_max_term: 18,
      }
    });

    const deviceList = devices
      .map((d, i) => `${i + 1}. ${d.brand} ${d.model_name} - $${d.retail_price_usd}`)
      .join('\n');

    return `*Congratulations! You're Approved!*

Your Credit Details:
Loan Limit: $${scoreResult.credit_limit_usd}
Credit Score: ${scoreResult.scaled_score}/850

Choose your smartphone:

${deviceList}

Reply with the number of your choice (e.g. *1*)`;

  } catch (error) {
    logger.error('Credit scoring failed', { action: 'scoring.calculate', meta: { error: error instanceof Error ? error.message : 'Unknown' } });

    // Do NOT auto-approve when scoring service is unavailable.
    // Keep session in credit_scoring state so customer can retry.
    const lang: SupportedLanguage = session.state_data.preferred_language || 'en';
    return t('scoring_unavailable', lang) + `\nReference: SCORE-${Date.now()}`;
  }
}
