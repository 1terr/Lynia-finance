/**
 * WhatsApp Onboarding - Personal Info State Handler
 *
 * Collects personal information: full name, date of birth, gender, and location.
 */

import { t, type SupportedLanguage } from '../../i18n';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle COLLECTING_PERSONAL_INFO state
 */
export async function handlePersonalInfo(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();
  const lang: SupportedLanguage = session.state_data.preferred_language || 'en';

  // Collect full name
  if (!session.state_data.full_name) {
    // Validate name (2-5 words)
    const nameParts = message.split(/\s+/);
    if (nameParts.length < 2 || nameParts.length > 5) {
      return t('name_format_error', lang);
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        full_name: message
      }
    });

    return t('ask_dob', lang);
  }

  // Collect date of birth
  if (!session.state_data.date_of_birth) {
    // Validate DOB format and age (18-75)
    const dobPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = message.match(dobPattern);

    if (!match) {
      return t('dob_format_error', lang);
    }

    const [, day, month, year] = match;
    const dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    if (age < 18 || age > 75) {
      return t('dob_format_error', lang);
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        date_of_birth: message
      }
    });

    return t('ask_gender', lang);
  }

  // Collect gender
  if (!session.state_data.gender) {
    const gender = message.toLowerCase();
    if (!['male', 'female', 'other', '1', '2', '3'].includes(gender)) {
      return t('ask_gender', lang);
    }

    const genderMap: Record<string, 'male' | 'female' | 'other'> = {
      'male': 'male',
      '1': 'male',
      'female': 'female',
      '2': 'female',
      'other': 'other',
      '3': 'other'
    };

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        gender: genderMap[gender]
      }
    });

    return t('ask_location', lang);
  }

  // Collect location and move to employment info
  if (!session.state_data.location) {
    const location = message.trim();

    if (location.length < 2) {
      return t('invalid_input', lang);
    }

    await updateSession(context.from, {
      current_state: 'collecting_employment',
      state_data: {
        ...session.state_data,
        location: location
      }
    });

    return t('personal_info_complete', lang) + '\n\n' + t('ask_employment', lang);
  }

  return t('error_generic', lang);
}
