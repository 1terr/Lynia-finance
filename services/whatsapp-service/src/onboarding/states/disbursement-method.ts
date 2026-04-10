/**
 * WhatsApp Onboarding - Disbursement Method Selection State Handler
 *
 * Digital credit only: customer chooses how to receive their funds
 * (EcoCash, OneMoney, InnBucks) and confirms the receiving phone number.
 */

import { query } from '../../../../shared/clients/database';
import { logger } from '../../../../shared/utils/logger';
import { t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext, WhatsAppResponse, ButtonsResponse } from '../types';

const METHODS = ['ecocash', 'onemoney', 'innbucks'] as const;
type DisbursementMethod = typeof METHODS[number];

/**
 * Resolve allowed disbursement methods from the loan product config.
 * Falls back to all methods if product config is unavailable.
 */
async function getAllowedDisbursementMethods(session: OnboardingSession): Promise<DisbursementMethod[]> {
  try {
    const productCategory = session.state_data.selected_product === 'digital_credit' ? 'digital' : 'smartphone';
    const { data } = await query<{ allowed_disbursement_methods: string[] | null }>(
      `SELECT allowed_disbursement_methods FROM loan_products
       WHERE product_category = $1 AND status = 'active' AND deleted_at IS NULL
       ORDER BY display_order ASC LIMIT 1`,
      [productCategory]
    );
    const allowed = data?.[0]?.allowed_disbursement_methods;
    if (allowed && Array.isArray(allowed) && allowed.length > 0) {
      return allowed.filter((m): m is DisbursementMethod => METHODS.includes(m as DisbursementMethod));
    }
  } catch (err) {
    logger.warn('Failed to lookup product disbursement config', { action: 'disbursement.product_config_lookup_failed', error: (err as Error).message });
  }
  return [...METHODS];
}

/** Zimbabwe phone number: +263 7X XXX XXXX or 07X XXX XXXX */
const ZW_PHONE_REGEX = /^(?:\+?263|0)7[1-9]\d{7}$/;

/**
 * Handle DISBURSEMENT_METHOD_SELECTION state
 */
export async function handleDisbursementMethodSelection(
  session: OnboardingSession,
  context: MessageContext
): Promise<WhatsAppResponse> {
  const message = context.message.trim();
  const lang: SupportedLanguage = session.state_data.preferred_language || 'en';

  // Sub-state: if method already chosen, we're confirming phone number
  if (session.state_data.disbursement_method && !session.state_data.disbursement_phone) {
    return handlePhoneConfirmation(session, context, lang);
  }

  // Handle BACK command — return to loan summary
  if (message.toLowerCase() === 'back') {
    await updateSession(context.from, {
      current_state: 'loan_summary',
      state_data: {
        ...session.state_data,
        disbursement_method: undefined,
        disbursement_phone: undefined,
      }
    });

    return reShowLoanSummary(session);
  }

  // Resolve allowed methods from product config
  const allowedMethods = await getAllowedDisbursementMethods(session);

  // Parse method selection (button IDs, numbered choices, and text matches)
  const choice = message.toLowerCase();
  let method: DisbursementMethod | undefined;

  if (choice === '1' || choice === 'method_ecocash' || choice.includes('ecocash')) {
    method = 'ecocash';
  } else if (choice === '2' || choice === 'method_onemoney' || choice.includes('onemoney') || choice.includes('one money')) {
    method = 'onemoney';
  } else if (choice === '3' || choice === 'method_innbucks' || choice.includes('innbucks')) {
    method = 'innbucks';
  }

  // Validate selected method is allowed by product config
  if (method && !allowedMethods.includes(method)) {
    const allowedNames = allowedMethods.map(m => formatMethodName(m)).join(', ');
    const unavailableMsg = `${formatMethodName(method)} is not available for this loan product. Available methods: ${allowedNames}`;
    const buttons = buildMethodButtons(allowedMethods, lang);
    return typeof buttons === 'string'
      ? unavailableMsg + '\n\n' + buttons
      : { ...buttons, body: unavailableMsg + '\n\n' + buttons.body };
  }

  if (!method) {
    return buildMethodButtons(allowedMethods, lang);
  }

  // Store method, ask for phone confirmation
  await updateSession(context.from, {
    state_data: {
      ...session.state_data,
      disbursement_method: method,
    }
  });

  const methodName = formatMethodName(method);
  const defaultPhone = session.phone_number;

  return t('disbursement_confirm_phone', lang, { phone: defaultPhone })
    + `\n\n(${methodName} account)`;
}

/**
 * Handle phone number confirmation sub-step
 */
async function handlePhoneConfirmation(
  session: OnboardingSession,
  context: MessageContext,
  lang: SupportedLanguage
): Promise<WhatsAppResponse> {
  const message = context.message.trim().toLowerCase();

  // Accept default phone
  if (message === 'yes' || message === 'hongu' || message === 'yebo' || message === 'confirm') {
    await updateSession(context.from, {
      current_state: 'terms_acceptance',
      state_data: {
        ...session.state_data,
        disbursement_phone: session.phone_number,
      }
    });

    return showDigitalTerms(session, lang);
  }

  // Check if user entered a different phone number
  const cleanedPhone = message.replace(/[\s-]/g, '');
  if (ZW_PHONE_REGEX.test(cleanedPhone)) {
    await updateSession(context.from, {
      current_state: 'terms_acceptance',
      state_data: {
        ...session.state_data,
        disbursement_phone: cleanedPhone,
      }
    });

    return showDigitalTerms(session, lang);
  }

  // If 'back', let them re-choose method with buttons
  if (message === 'back') {
    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        disbursement_method: undefined,
      },
    });

    const allMethods: DisbursementMethod[] = ['ecocash', 'onemoney', 'innbucks'];
    return buildMethodButtons(allMethods, lang);
  }

  return t('disbursement_confirm_phone', lang, { phone: session.phone_number });
}

/**
 * Show digital loan terms for acceptance
 */
function showDigitalTerms(session: OnboardingSession, lang: SupportedLanguage): string {
  const method = formatMethodName(session.state_data.disbursement_method || 'ecocash');
  const amount = (session.state_data.financed_amount || 0).toFixed(2);
  const term = String(session.state_data.selected_term_months || 6);
  const payment = (session.state_data.monthly_payment || 0).toFixed(2);
  const rate = String(session.state_data.interest_rate_apr || 24);

  return t('digital_terms', lang, { amount, method, term, payment, rate });
}

/**
 * Re-show the loan summary when going back
 */
function reShowLoanSummary(session: OnboardingSession): string {
  const amount = (session.state_data.financed_amount || 0).toFixed(2);
  const term = session.state_data.selected_term_months || 6;
  const payment = (session.state_data.monthly_payment || 0).toFixed(2);
  const total = (session.state_data.total_repayment || 0).toFixed(2);
  const rate = session.state_data.interest_rate_apr || 24;

  return `*Your Loan Summary*

Cash Loan: $${amount}
Term: ${term} months
Interest: ${rate}% APR

Monthly Payment: *$${payment}*
Total Repayment: $${total}

Reply *Yes* to accept or *Back* to change.`;
}

function formatMethodName(method: string): string {
  switch (method) {
    case 'ecocash': return 'EcoCash';
    case 'onemoney': return 'OneMoney';
    case 'innbucks': return 'InnBucks';
    default: return method;
  }
}

/**
 * Build interactive buttons for mobile money method selection.
 * WhatsApp allows max 3 buttons; we have exactly 3 methods so this fits perfectly.
 */
function buildMethodButtons(allowedMethods: DisbursementMethod[], lang: SupportedLanguage): ButtonsResponse {
  const bodyText = lang === 'sn'
    ? 'Sarudza nzira yekugamuchira mari yako:'
    : lang === 'nd'
    ? 'Khetha indlela yokuthola imali yakho:'
    : 'How would you like to receive your loan?';

  // Map each allowed method to a button (max 3)
  const methodButtons: Array<{ id: string; title: string }> = allowedMethods.slice(0, 3).map(m => ({
    id: `method_${m}`,
    title: formatMethodName(m),
  }));

  return {
    type: 'buttons',
    body: bodyText,
    buttons: methodButtons,
  };
}
