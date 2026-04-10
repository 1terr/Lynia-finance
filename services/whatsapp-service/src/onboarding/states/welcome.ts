/**
 * WhatsApp Onboarding - Welcome State Handler
 *
 * Handles the initial welcome state:
 *  1. First contact — shows interactive language-selection buttons (EN/SN/ND)
 *  2. Language selected — validates Zimbabwe phone, transitions to personal info
 */

import { db } from '../../../../shared/clients/database';
import { validateZimbabwePhoneNumber } from '../../../../shared/utils/validation';
import { t, detectLanguage, type SupportedLanguage } from '../../i18n';
import { getOrCreateSession, updateSession } from '../session';
import type { MessageContext, WhatsAppResponse, ButtonsResponse } from '../types';

/**
 * Handle WELCOME state
 */
export async function handleWelcome(context: MessageContext): Promise<WhatsAppResponse> {
  const session = await getOrCreateSession(context.from);

  // --- Step 1: First contact — show language selection buttons ---
  if (!session.state_data.language_selection_shown) {
    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        language_selection_shown: true,
      },
    });

    const languageButtons: ButtonsResponse = {
      type: 'buttons',
      body: 'Welcome to Lynia Finance! 🇿🇼\n\nLoan access for every Zimbabwean.\n\nPlease choose your language:\nSarudza mutauro:\nKhetha ulimi:',
      buttons: [
        { id: 'lang_en', title: 'English' },
        { id: 'lang_sn', title: 'Shona' },
        { id: 'lang_nd', title: 'Ndebele' },
      ],
    };

    return languageButtons;
  }

  // --- Step 2: Language was selected (button click or typed text) ---
  const msgLower = context.message.trim().toLowerCase();
  let selectedLang: SupportedLanguage;

  if (msgLower === 'english' || msgLower === 'lang_en') {
    selectedLang = 'en';
  } else if (msgLower === 'shona' || msgLower === 'lang_sn') {
    selectedLang = 'sn';
  } else if (msgLower === 'ndebele' || msgLower === 'lang_nd') {
    selectedLang = 'nd';
  } else {
    // Infer from message content (fallback for users who type their preference)
    selectedLang = detectLanguage(context.message) || 'en';
  }

  // Validate Zimbabwe phone number
  const validation = validateZimbabwePhoneNumber(context.from);

  if (!validation.valid) {
    if (validation.message === 'non_zimbabwean_number') {
      // Log international interest for future expansion tracking
      await db.from('international_interest').insert({
        phone_number: context.from,
        rejected_at: new Date(),
        source: 'whatsapp_onboarding',
      }).execute();

      return t('service_not_available', selectedLang);
    }

    return t('invalid_phone', selectedLang);
  }

  // Phone is valid — transition to personal info collection
  await updateSession(context.from, {
    current_state: 'collecting_personal_info',
    state_data: {
      ...session.state_data,
      preferred_language: selectedLang,
      language_selection_shown: true,
      started_at: new Date().toISOString(),
    },
  });

  return t('welcome', selectedLang) + '\n\n' + t('ask_name', selectedLang);
}
