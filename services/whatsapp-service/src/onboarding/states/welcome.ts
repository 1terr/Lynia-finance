/**
 * WhatsApp Onboarding - Welcome State Handler
 *
 * Handles the initial welcome state: language detection, phone validation,
 * and transition to personal info collection.
 */

import { db } from '../../../../shared/clients/database';
import { validateZimbabwePhoneNumber } from '../../../../shared/utils/validation';
import { t, detectLanguage, type SupportedLanguage } from '../../i18n';
import { getOrCreateSession, updateSession } from '../session';
import type { MessageContext } from '../types';

/**
 * Handle WELCOME state
 */
export async function handleWelcome(context: MessageContext): Promise<string> {
  const session = await getOrCreateSession(context.from);

  // Detect language from initial message
  const detectedLang = detectLanguage(context.message) || 'en';
  const lang: SupportedLanguage = session.state_data.preferred_language || detectedLang;

  // Validate Zimbabwe phone number
  const validation = validateZimbabwePhoneNumber(context.from);

  if (!validation.valid) {
    if (validation.message === 'non_zimbabwean_number') {
      // Log international interest
      await db.from('international_interest').insert({
        phone_number: context.from,
        rejected_at: new Date(),
        source: 'whatsapp_onboarding'
      }).execute();

      return t('service_not_available', lang);
    }

    return t('invalid_phone', lang);
  }

  // Phone is valid, move to personal info collection
  await updateSession(context.from, {
    current_state: 'collecting_personal_info',
    state_data: {
      ...session.state_data,
      preferred_language: lang,
      started_at: new Date().toISOString()
    }
  });

  return t('welcome', lang) + '\n\n' + t('ask_name', lang);
}
