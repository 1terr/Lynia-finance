/**
 * WhatsApp Onboarding - Amount Selection State Handler
 *
 * Digital credit only: customer chooses how much to borrow
 * within their approved credit limit (capped by org lending limits).
 */

import { t, type SupportedLanguage } from '../../i18n';
import { getAllowedTermsForProduct } from '../../../../shared/utils/loan-calculator';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle AMOUNT_SELECTION state
 */
export async function handleAmountSelection(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();
  const lang: SupportedLanguage = session.state_data.preferred_language || 'en';

  const orgLimits = session.state_data.org_lending_limits;
  const maxAmount = session.state_data.credit_limit_usd || orgLimits?.max_loan_amount || 500;
  const minAmount = orgLimits?.min_loan_amount ?? 20;

  // Handle BACK command — re-show approval message
  if (message.toLowerCase() === 'back') {
    await updateSession(context.from, {
      current_state: 'credit_scoring',
      state_data: {
        ...session.state_data,
        requested_loan_amount: undefined,
      }
    });

    return `Your credit limit is *$${maxAmount.toFixed(2)}*. Reply with any message to see your options again.`;
  }

  // Parse amount — strip $ and commas
  const cleaned = message.replace(/[$,\s]/g, '');
  const amount = Number.parseFloat(cleaned);

  if (Number.isNaN(amount) || amount <= 0) {
    return t('amount_selection_prompt', lang, {
      max_amount: maxAmount.toFixed(2),
      min_amount: minAmount.toFixed(2),
    });
  }

  if (amount < minAmount) {
    return t('amount_too_low', lang, { min_amount: minAmount.toFixed(2) });
  }

  if (amount > maxAmount) {
    return t('amount_too_high', lang, { max_amount: maxAmount.toFixed(2) });
  }

  // Round to 2 decimal places
  const roundedAmount = Math.round(amount * 100) / 100;

  // Determine allowed terms from product config or org overrides
  const minTerm = orgLimits?.min_term_months ?? session.state_data.matched_product_min_term ?? 1;
  const maxTerm = orgLimits?.max_term_months ?? session.state_data.matched_product_max_term ?? 6;

  // Build allowed terms from product's term range
  const finalTerms = getAllowedTermsForProduct(minTerm, maxTerm);

  await updateSession(context.from, {
    current_state: 'term_selection',
    state_data: {
      ...session.state_data,
      requested_loan_amount: roundedAmount,
      allowed_terms: finalTerms,
    }
  });

  const termList = finalTerms
    .map((months, i) => `${i + 1}. ${months} month${months > 1 ? 's' : ''}`)
    .join('\n');

  return `Cash Loan: *$${roundedAmount.toFixed(2)}*

How long would you like to pay?

${termList}

Reply with the number of your choice, or *Back* to change amount.`;
}
