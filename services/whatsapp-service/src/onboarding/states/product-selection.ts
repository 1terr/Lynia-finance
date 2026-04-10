/**
 * WhatsApp Onboarding - Product Selection State Handler
 *
 * Handles product choice: smartphone financing or digital credit.
 * Uses interactive buttons for the initial prompt; falls back to text matching
 * for users who type their choice instead of tapping a button.
 */

import { t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext, WhatsAppResponse, ButtonsResponse } from '../types';

/**
 * Handle PRODUCT_SELECTION state
 */
export async function handleProductSelection(
  session: OnboardingSession,
  context: MessageContext
): Promise<WhatsAppResponse> {
  const message = context.message.trim().toLowerCase();
  const lang: SupportedLanguage = session.state_data.preferred_language || 'en';

  if (message === '1' || message === 'smartphone' || message.includes('smartphone') || message.includes('yes') || message.includes('hongu') || message.includes('yebo')) {
    await updateSession(context.from, {
      current_state: 'kyc_id_upload',
      state_data: {
        ...session.state_data,
        selected_product: 'smartphone',
        requested_loan_amount: 250, // Default, will be determined by credit scoring
      },
    });

    return t('smartphone_selected', lang) + '\n\n' + t('kyc_id_number', lang);
  }

  if (message === '2' || message.includes('digital') || message.includes('mari') || message.includes('imali')) {
    await updateSession(context.from, {
      current_state: 'org_verification',
      state_data: {
        ...session.state_data,
        selected_product: 'digital_credit',
      },
    });

    return t('digital_credit_selected', lang) + '\n\n' + t('org_verification_prompt', lang);
  }

  // Show interactive product selection buttons
  const productButtons: ButtonsResponse = {
    type: 'buttons',
    body: lang === 'sn'
      ? 'Chii chaunoda kuita application?\n\n📱 Smartphone Financing — tora foni uchiripira mwedzi nemwedzi\n💵 Digital Credit — mari inouya straight ku mobile wallet yako'
      : lang === 'nd'
      ? 'Yini ofuna ukwenza application?\n\n📱 Smartphone Financing — thola ifoni ukhokha ngenyanga ngenyanga\n💵 Digital Credit — imali iza qondile ku mobile wallet yakho'
      : 'What would you like to apply for?\n\n📱 Smartphone Financing — get a phone and pay monthly\n💵 Digital Credit — receive cash directly to your mobile wallet',
    buttons: [
      { id: 'prod_smartphone', title: '📱 Smartphone' },
      { id: 'prod_digital', title: '💵 Digital Credit' },
    ],
  };

  return productButtons;
}
