/**
 * WhatsApp Onboarding - Employment Info State Handler
 *
 * Collects employment information: employment type and household size.
 * Income and debt fields are no longer collected here — the scoring service
 * derives affordability from organization verification and device pricing data.
 *
 * Type fields for monthly_income_usd and existing_debt_obligations_usd are
 * retained in OnboardingSession for backward compatibility with in-flight sessions.
 */

import { t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle COLLECTING_EMPLOYMENT state
 */
export async function handleEmployment(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();
  const lang: SupportedLanguage = session.state_data.preferred_language || 'en';

  // Collect employment type
  if (!session.state_data.employment_type) {
    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        employment_type: message
      }
    });

    return t('ask_household', lang);
  }

  // Collect household size and move to product selection
  if (!session.state_data.household_size) {
    const household = parseInt(message);

    if (isNaN(household) || household < 1 || household > 20) {
      return t('invalid_input', lang);
    }

    // Assume dependents = household_size - 1 for simplicity
    const dependents = Math.max(0, household - 1);

    await updateSession(context.from, {
      current_state: 'product_selection',
      state_data: {
        ...session.state_data,
        household_size: household,
        dependents: dependents
      }
    });

    return t('income_info_complete', lang) + '\n\n' + t('product_selection', lang);
  }

  return t('error_generic', lang);
}
