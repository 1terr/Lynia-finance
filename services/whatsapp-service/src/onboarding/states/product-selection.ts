/**
 * WhatsApp Onboarding - Product Selection State Handler
 *
 * Handles product choice: smartphone financing or digital credit.
 */

import { t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle PRODUCT_SELECTION state
 */
export async function handleProductSelection(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim().toLowerCase();
  const lang: SupportedLanguage = session.state_data.preferred_language || 'en';

  if (message === '1' || message.includes('smartphone') || message.includes('yes') || message.includes('hongu') || message.includes('yebo')) {
    await updateSession(context.from, {
      current_state: 'kyc_id_upload',
      state_data: {
        ...session.state_data,
        selected_product: 'smartphone',
        requested_loan_amount: 250 // Default, will be determined by credit scoring
      }
    });

    return t('smartphone_selected', lang) + '\n\n' + t('kyc_id_number', lang);
  }

  if (message === '2' || message.includes('digital') || message.includes('mari') || message.includes('imali')) {
    await updateSession(context.from, {
      current_state: 'org_verification',
      state_data: {
        ...session.state_data,
        selected_product: 'digital_credit',
      }
    });

    return t('digital_credit_selected', lang) + '\n\n' + t('org_verification_prompt', lang);
  }

  return t('product_selection', lang);
}
