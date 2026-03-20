/**
 * WhatsApp Onboarding - Organization Verification State Handler
 *
 * Verifies that a digital credit applicant is a member of a registered
 * organization. Runs BEFORE KYC to fail fast and avoid unnecessary
 * verification costs on ineligible applicants.
 *
 * Also fetches per-org lending overrides and resolves the lending limits
 * for the specific org+product+member combination.
 */

import { db, query } from '../../../../shared/clients/database';
import { logger } from '../../../../shared/utils/logger';
import { hashNationalId } from '../../../../shared/utils/crypto';
import { resolveOrgLendingLimits } from '../../../../shared/utils/org-lending-resolver';
import { t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/** Zimbabwe National ID format: XX-XXXXXXX-X-XX (e.g. 63-2345678-B-08) */
const NATIONAL_ID_REGEX = /^\d{2}-\d{7}-[A-Z]-\d{2}$/;

/**
 * Handle ORG_VERIFICATION state
 */
export async function handleOrgVerification(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();
  const lang: SupportedLanguage = session.state_data.preferred_language || 'en';

  // Handle BACK command — return to product selection
  if (message.toLowerCase() === 'back') {
    await updateSession(context.from, {
      current_state: 'product_selection',
      state_data: {
        ...session.state_data,
        selected_product: undefined,
        organization_id: undefined,
        org_name: undefined,
        org_type: undefined,
        tenure_months: undefined,
        salary_verified: undefined,
        monthly_salary_usd: undefined,
        org_lending_limits: undefined,
      }
    });

    return t('product_selection', lang);
  }

  // Normalize input: strip spaces around hyphens
  const normalizedId = message.replace(/\s*-\s*/g, '-').toUpperCase();

  if (!NATIONAL_ID_REGEX.test(normalizedId)) {
    return t('org_verification_prompt', lang);
  }

  try {
    const idHash = hashNationalId(normalizedId);

    // Look up member by national ID hash
    const { data: member } = await db
      .from('organization_members')
      .select('organization_id, employment_status, employment_start_date, salary_verified, monthly_salary_usd')
      .eq('national_id_hash', idHash)
      .eq('employment_status', 'active')
      .limit(1)
      .single()
      .execute();

    if (!member) {
      return t('org_not_found', lang);
    }

    // Fetch the organization
    const { data: org } = await db
      .from('organizations')
      .select('id, org_name, org_type, scoring_trust_level')
      .eq('id', member.organization_id)
      .eq('is_active', true)
      .single()
      .execute();

    if (!org) {
      return t('org_not_found', lang);
    }

    // Resolve the digital loan product
    const { data: productRows } = await query<{
      id: string;
      min_amount_usd: number;
      max_amount_usd: number;
      interest_rate_monthly: number;
      min_term_months: number;
      max_term_months: number;
      deposit_percentage: number;
      max_active_loans: number;
    }>(
      `SELECT id, min_amount_usd, max_amount_usd, interest_rate_monthly,
              min_term_months, max_term_months, deposit_percentage, max_active_loans
       FROM loan_products
       WHERE product_category = 'digital' AND status = 'active' AND deleted_at IS NULL
       ORDER BY display_order ASC LIMIT 1`,
      []
    );

    const product = productRows?.[0];
    if (!product) {
      logger.error('No active digital loan product found', {
        action: 'org-verification.product-lookup',
        status: 'failed',
      });
      return t('org_verification_error', lang);
    }

    // Check if org is linked to this product (if product has explicit links)
    const { data: productOrgRow } = await query<{
      organization_id: string;
      max_loan_amount_usd: number | null;
      min_loan_amount_usd: number | null;
      interest_rate_monthly_override: number | null;
      max_term_months_override: number | null;
      min_term_months_override: number | null;
      deposit_percentage_override: number | null;
      max_active_loans_override: number | null;
      salary_multiplier: number | null;
      is_active: boolean;
    }>(
      `SELECT * FROM product_organizations
       WHERE product_id = $1 AND organization_id = $2`,
      [product.id, org.id]
    );

    // Check if product has ANY linked orgs (if so, this org must be one of them)
    const { data: linkCount } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM product_organizations WHERE product_id = $1`,
      [product.id]
    );

    const hasExplicitLinks = parseInt(linkCount?.[0]?.count || '0') > 0;
    if (hasExplicitLinks && !productOrgRow?.[0]) {
      return t('org_not_eligible', lang, { org_name: org.org_name });
    }

    // Check if the link is active
    const orgLink = productOrgRow?.[0] ?? null;
    if (orgLink && orgLink.is_active === false) {
      return t('org_not_eligible', lang, { org_name: org.org_name });
    }

    // Resolve per-org lending limits
    const limits = resolveOrgLendingLimits(
      {
        min_amount_usd: product.min_amount_usd,
        max_amount_usd: product.max_amount_usd,
        interest_rate_monthly: product.interest_rate_monthly,
        min_term_months: product.min_term_months,
        max_term_months: product.max_term_months,
        deposit_percentage: product.deposit_percentage,
        max_active_loans: product.max_active_loans,
      },
      orgLink,
      {
        salary_verified: member.salary_verified ?? false,
        monthly_salary_usd: member.monthly_salary_usd ?? 0,
      }
    );

    // Calculate tenure
    let tenureMonths = 0;
    if (member.employment_start_date) {
      const start = new Date(member.employment_start_date);
      const now = new Date();
      tenureMonths = (now.getFullYear() - start.getFullYear()) * 12
        + (now.getMonth() - start.getMonth());
    }

    // Store org data and national ID, transition to KYC
    await updateSession(context.from, {
      current_state: 'kyc_id_upload',
      state_data: {
        ...session.state_data,
        id_number: normalizedId,
        organization_id: org.id,
        org_name: org.org_name,
        org_type: org.org_type,
        tenure_months: tenureMonths,
        salary_verified: member.salary_verified ?? false,
        monthly_salary_usd: member.monthly_salary_usd ?? 0,
        org_lending_limits: {
          max_loan_amount: limits.max_loan_amount,
          min_loan_amount: limits.min_loan_amount,
          interest_rate_monthly: limits.interest_rate_monthly,
          interest_rate_apr: limits.interest_rate_apr,
          min_term_months: limits.min_term_months,
          max_term_months: limits.max_term_months,
        },
        // Pre-set interest rate from org config (used by scoring/term-selection)
        interest_rate_apr: limits.interest_rate_apr,
        down_payment_percentage: 0, // Digital loans have no deposit
      }
    });

    const verifiedMsg = t('org_verified', lang, {
      org_name: org.org_name,
      tenure: String(tenureMonths),
    });

    return verifiedMsg + '\n\n' + t('kyc_id_upload', lang);

  } catch (error) {
    logger.error('Organization verification failed', {
      action: 'org-verification.lookup',
      status: 'failed',
      meta: { error: error instanceof Error ? error.message : String(error) },
    });
    return t('org_verification_error', lang);
  }
}
