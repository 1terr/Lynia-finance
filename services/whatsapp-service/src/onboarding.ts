/**
 * WhatsApp Bot - Customer Onboarding Flow
 *
 * 8-Step Onboarding Process:
 * 1. Welcome & Language Selection
 * 2. Zimbabwe Phone Validation
 * 3. Personal Information Collection
 * 4. Employment & Income Collection
 * 5. Product Selection
 * 6. KYC Document Upload
 * 7. Credit Scoring
 * 8. Loan Terms Acceptance
 */

import { db } from '../../shared/clients/database';
import axios from 'axios';
import { logger } from '../../shared/utils/logger';
import { t, detectLanguage, type SupportedLanguage } from './i18n';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const KYC_API_URL = process.env.KYC_API_URL!;

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type OnboardingState =
  | 'welcome'
  | 'phone_validation'
  | 'collecting_personal_info'
  | 'personal_info_name'
  | 'personal_info_dob'
  | 'personal_info_gender'
  | 'personal_info_location'
  | 'collecting_employment'
  | 'employment_type'
  | 'employment_income'
  | 'employment_debts'
  | 'employment_household'
  | 'product_selection'
  | 'kyc_id_upload'
  | 'kyc_selfie_upload'
  | 'kyc_processing'
  | 'credit_scoring'
  | 'loan_offer'
  | 'terms_acceptance'
  | 'completed'
  | 'rejected';

export interface OnboardingSession {
  customer_id: string;
  phone_number: string;
  current_state: OnboardingState;
  state_data: {
    // Language preference
    preferred_language?: SupportedLanguage;

    // Personal info
    full_name?: string;
    date_of_birth?: string;
    gender?: 'male' | 'female' | 'other';
    location?: string;

    // Employment & Income
    employment_type?: string;
    monthly_income_usd?: number;
    existing_debt_obligations_usd?: number;
    household_size?: number;
    dependents?: number;

    // Product selection
    selected_product?: 'smartphone' | 'digital_credit';
    requested_loan_amount?: number;

    // KYC
    id_number?: string;
    id_photo_url?: string;
    selfie_photo_url?: string;
    kyc_verification_id?: string;
    kyc_status?: 'pending' | 'verified' | 'failed';

    // Credit scoring
    credit_score?: number;
    credit_tier?: string;
    credit_limit_usd?: number;
    decision?: 'approve' | 'review' | 'reject';

    // Tracking
    retry_count?: number;
    started_at?: string;
  };
  last_activity_at: Date;
  created_at: Date;
}

export interface MessageContext {
  from: string;
  message: string;
  messageId: string;
  timestamp: number;
}

// ===================================================================
// PHONE VALIDATION
// ===================================================================

/**
 * Validate Zimbabwe phone number
 *
 * Valid formats:
 * - +263 77 123 4567
 * - 263771234567
 * - 0771234567
 *
 * Valid prefixes: 71, 73, 74, 77, 78 (Econet, NetOne, Telecel)
 */
export function validateZimbabwePhoneNumber(phoneNumber: string): {
  valid: boolean;
  normalized?: string;
  message?: string;
} {
  // Remove spaces, dashes, and parentheses
  const normalized = phoneNumber.replace(/[\s\-()]/g, '');

  // Zimbabwe mobile number pattern
  const mobilePattern = /^(\+?263|0)(7[1-8]{1}\d{7})$/;

  if (!mobilePattern.test(normalized)) {
    // Check if it's a non-Zimbabwean number
    if (!normalized.startsWith('+263') && !normalized.startsWith('263') && !normalized.startsWith('0')) {
      return {
        valid: false,
        message: 'non_zimbabwean_number'
      };
    }

    return {
      valid: false,
      message: 'invalid_zimbabwe_mobile'
    };
  }

  // Normalize to international format
  let normalizedPhone = normalized;
  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = '+263' + normalizedPhone.substring(1);
  } else if (normalizedPhone.startsWith('263')) {
    normalizedPhone = '+' + normalizedPhone;
  }

  return {
    valid: true,
    normalized: normalizedPhone
  };
}

// ===================================================================
// SESSION MANAGEMENT
// ===================================================================

/**
 * Get or create onboarding session
 */
export async function getOrCreateSession(phoneNumber: string): Promise<OnboardingSession> {
  // Try to get existing active session
  const { data: existingSession } = await db
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (existingSession && existingSession.current_state !== 'completed') {
    // Check if session expired (30 minutes)
    const lastActivity = new Date(existingSession.last_activity_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    if (diffMinutes < 30) {
      return existingSession as OnboardingSession;
    }
  }

  // Create new session
  const session: Partial<OnboardingSession> = {
    phone_number: phoneNumber,
    current_state: 'welcome',
    state_data: {
      started_at: new Date().toISOString(),
      retry_count: 0
    },
    last_activity_at: new Date(),
    created_at: new Date()
  };

  const { data: newSession, error } = await db
    .from('whatsapp_sessions')
    .insert(session)
    .select()
    .single()
    .execute();

  if (error) {
    logger.error('Failed to create session', { action: 'session.create', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    throw new Error('Failed to create onboarding session');
  }

  return newSession as OnboardingSession;
}

/**
 * Update session state
 */
export async function updateSession(
  phoneNumber: string,
  updates: Partial<OnboardingSession>
): Promise<void> {
  const { error } = await db
    .from('whatsapp_sessions')
    .update({
      ...updates,
      last_activity_at: new Date()
    })
    .eq('phone_number', phoneNumber)
    .execute();

  if (error) {
    logger.error('Failed to update session', { action: 'session.update', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    throw new Error('Failed to update session');
  }
}

// ===================================================================
// WHATSAPP MEDIA HELPERS
// ===================================================================

/**
 * Download media from WhatsApp Cloud API and return as base64.
 * Step 1: GET media metadata to get the download URL.
 * Step 2: Download the binary data.
 * Step 3: Convert to base64.
 */
async function downloadWhatsAppMedia(mediaId: string): Promise<string> {
  const metadataResponse = await axios.get(
    `${WHATSAPP_API_URL}/${mediaId}`,
    { headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
  );

  const downloadUrl = metadataResponse.data.url;

  const mediaResponse = await axios.get(downloadUrl, {
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    responseType: 'arraybuffer'
  });

  return Buffer.from(mediaResponse.data).toString('base64');
}

// ===================================================================
// STATE HANDLERS
// ===================================================================

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

    return t('ask_income', lang);
  }

  // Collect monthly income
  if (!session.state_data.monthly_income_usd) {
    const income = parseFloat(message);

    if (isNaN(income) || income <= 0) {
      return t('invalid_input', lang);
    }

    if (income < 50) {
      return t('invalid_input', lang);
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        monthly_income_usd: income
      }
    });

    return t('ask_debts', lang);
  }

  // Collect existing debts
  if (session.state_data.existing_debt_obligations_usd === undefined) {
    const debts = parseFloat(message);

    if (isNaN(debts) || debts < 0) {
      return t('invalid_input', lang);
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        existing_debt_obligations_usd: debts
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

  if (message === '2' || message.includes('digital')) {
    return t('digital_credit_soon', lang);
  }

  return t('product_selection', lang);
}

/**
 * Handle KYC_ID_UPLOAD state
 * Collects National ID number (text) then ID photo (image).
 */
export async function handleKYCIdUpload(
  session: OnboardingSession,
  context: MessageContext,
  imageUrl?: string
): Promise<string> {
  // Step 1: Collect National ID number (text input)
  if (!session.state_data.id_number) {
    const idNumber = context.message.trim();

    // If user sent an image before providing ID number, ask for text first
    if (imageUrl || idNumber === '[Image received]') {
      return `First, please type your *National ID number*.

Format: *XX-XXXXXXX-X-XX*
Example: *63-2345678-B-08*`;
    }

    // Validate Zimbabwe national ID format (e.g., "63-2345678-B-08")
    const normalized = idNumber.replace(/[\s-]/g, '');
    const idPattern = /^\d{2}\d{6,7}[A-Z]\d{2}$/i;
    if (!idPattern.test(normalized)) {
      return `Invalid ID number format.

Please enter your National ID number:
Format: *XX-XXXXXXX-X-XX*
Example: *63-2345678-B-08*`;
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        id_number: idNumber
      }
    });

    return `✅ *ID Number Received!*

📸 *Now send a photo of your National ID*

Tips for a clear photo:
✅ Place ID on flat surface
✅ Good lighting, no shadows
✅ All text visible
✅ Hold phone steady

*Send photo now*`;
  }

  // Step 2: Collect ID photo (image input)
  if (!imageUrl) {
    return `Please send a photo of your National ID.

Make sure:
✅ Photo is clear and readable
✅ All corners visible
✅ Good lighting

*Send photo now*`;
  }

  // Store ID photo media ID and move to selfie capture
  await updateSession(context.from, {
    current_state: 'kyc_selfie_upload',
    state_data: {
      ...session.state_data,
      id_photo_url: imageUrl
    }
  });

  return `✅ *ID Photo Received!*

📸 *Step 2: Take a Selfie*

This helps us match your face to your ID.

Tips:
✅ Face the camera directly
✅ Remove sunglasses/hat
✅ Good lighting on face
✅ Neutral expression

🔒 Your privacy matters - we never share your photos.

*Send selfie now*`;
}

/**
 * Handle KYC_SELFIE_UPLOAD state
 * Downloads images from WhatsApp and submits to the KYC service.
 */
export async function handleKYCSelfieUpload(
  session: OnboardingSession,
  context: MessageContext,
  imageUrl?: string
): Promise<string> {
  if (!imageUrl) {
    return `Please send a clear selfie.

Make sure:
✅ Your face is clearly visible
✅ Looking directly at camera
✅ Good lighting
✅ No sunglasses or hat

*Send selfie now*`;
  }

  // Store selfie media ID and transition to processing
  await updateSession(context.from, {
    current_state: 'kyc_processing',
    state_data: {
      ...session.state_data,
      selfie_photo_url: imageUrl,
      kyc_status: 'pending'
    }
  });

  try {
    // Download both images from WhatsApp Cloud API as base64
    const [idImageBase64, selfieImageBase64] = await Promise.all([
      downloadWhatsAppMedia(session.state_data.id_photo_url!),
      downloadWhatsAppMedia(imageUrl)
    ]);

    // Find the customer record
    const { data: customer } = await db
      .from('customers')
      .select('id')
      .eq('whatsapp_number', context.from)
      .single()
      .execute();

    if (!customer) {
      throw new Error('Customer record not found');
    }

    // Parse name into first/last
    const nameParts = (session.state_data.full_name || '').split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Convert DOB from DD/MM/YYYY to YYYY-MM-DD
    let dobFormatted: string | undefined;
    if (session.state_data.date_of_birth) {
      const [day, month, year] = session.state_data.date_of_birth.split('/');
      dobFormatted = `${year}-${month}-${day}`;
    }

    // Call KYC service
    const kycResponse = await axios.post(`${KYC_API_URL}/kyc/initiate`, {
      customer_id: customer.id,
      id_number: session.state_data.id_number,
      id_image_base64: idImageBase64,
      selfie_image_base64: selfieImageBase64,
      first_name: firstName,
      last_name: lastName,
      dob: dobFormatted,
      phone_number: context.from
    });

    const kycResult = kycResponse.data;

    // Store the KYC submission ID
    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        selfie_photo_url: imageUrl,
        kyc_verification_id: kycResult.kyc_submission_id,
        kyc_status: 'pending'
      }
    });

    // If KYC was processed synchronously (e.g., Didit), check result immediately
    if (kycResult.status === 'processing') {
      const statusResponse = await axios.get(
        `${KYC_API_URL}/kyc/${customer.id}`
      );
      const statusResult = statusResponse.data;

      if (statusResult.kyc_status === 'verified') {
        await updateSession(context.from, {
          current_state: 'credit_scoring',
          state_data: {
            ...session.state_data,
            selfie_photo_url: imageUrl,
            kyc_verification_id: kycResult.kyc_submission_id,
            kyc_status: 'verified'
          }
        });

        return `✅ *Identity Verified!*

Great news! Your identity has been confirmed.

⏳ *Assessing your eligibility...*

We're calculating your loan amount based on:
✓ Identity verification
✓ Income information
✓ First-time borrower status

This takes about 10 seconds...`;
      }

      if (statusResult.kyc_status === 'rejected') {
        const retryCount = (session.state_data.retry_count || 0) + 1;
        const attemptsRemaining = 3 - retryCount;

        if (attemptsRemaining <= 0) {
          await updateSession(context.from, {
            current_state: 'rejected',
            state_data: {
              ...session.state_data,
              kyc_status: 'failed'
            }
          });

          return `❌ *Verification Failed*

You have used all 3 verification attempts.

Please contact support for assistance: support@lynia.finance`;
        }

        // Reset to ID upload for retry
        await updateSession(context.from, {
          current_state: 'kyc_id_upload',
          state_data: {
            ...session.state_data,
            kyc_status: 'failed',
            id_photo_url: undefined,
            selfie_photo_url: undefined,
            id_number: undefined,
            retry_count: retryCount
          }
        });

        return `❌ *Verification Unsuccessful*

${statusResult.verification_reason || 'We could not verify your identity.'}

You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.

Please enter your National ID number to try again:
Format: *XX-XXXXXXX-X-XX*`;
      }
    }

    // Async flow (e.g., Smile Identity) — tell customer to wait
    return `⏳ *Verifying Your Identity...*

Your documents have been submitted for verification.

This usually takes 1-5 minutes. We'll message you as soon as it's complete.

Please wait...`;

  } catch (error) {
    logger.error('KYC initiation failed', { action: 'kyc.initiate', meta: { error: error instanceof Error ? error.message : 'Unknown' } });

    // Revert to ID upload state for retry
    await updateSession(context.from, {
      current_state: 'kyc_id_upload',
      state_data: {
        ...session.state_data,
        kyc_status: 'failed',
        id_photo_url: undefined,
        selfie_photo_url: undefined,
        id_number: undefined
      }
    });

    return `⚠️ *Verification Error*

We had trouble processing your documents. This could be due to:
• Image quality too low
• Network issues

Please try again. Type your National ID number to restart verification.
Format: *XX-XXXXXXX-X-XX*`;
  }
}

/**
 * Handle CREDIT_SCORING state
 */
export async function handleCreditScoring(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  // Call credit scoring service
  try {
    // Fetch real KYC data from the latest submission
    const { data: kycSubmission } = await db
      .from('kyc_submissions')
      .select('verification_confidence, face_match_score, liveness_score, verification_decision')
      .eq('customer_id', session.customer_id || `temp_${context.from}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    const scoringPayload = {
      customer_id: session.customer_id || `temp_${context.from}`,
      monthly_income_usd: session.state_data.monthly_income_usd || 200,
      existing_debt_obligations_usd: session.state_data.existing_debt_obligations_usd || 0,
      household_size: session.state_data.household_size || 1,
      dependents: session.state_data.dependents || 0,
      requested_loan_amount: session.state_data.requested_loan_amount || 250,
      kyc_result: kycSubmission ? {
        face_match_score: kycSubmission.face_match_score ?? 96,
        liveness_passed: (kycSubmission.liveness_score ?? 0) >= 50,
        confidence_score: kycSubmission.verification_confidence ?? 96,
        verification_decision: kycSubmission.verification_decision ?? 'APPROVED',
      } : {
        face_match_score: 96,
        liveness_passed: true,
        confidence_score: 96,
        verification_decision: 'APPROVED',
      }
    };

    // Call scoring service (when deployed)
    const SCORING_API_URL = process.env.SCORING_API_URL!;
    const response = await axios.post(SCORING_API_URL, scoringPayload);
    const scoreResult = response.data;

    await updateSession(context.from, {
      current_state: 'loan_offer',
      state_data: {
        ...session.state_data,
        credit_score: scoreResult.scaled_score,
        credit_tier: scoreResult.tier,
        credit_limit_usd: scoreResult.credit_limit_usd,
        decision: scoreResult.decision
      }
    });

    if (scoreResult.decision === 'approve') {
      return `🎉 *Congratulations! You're Approved!*

Your Loan Details:
💰 *Loan Limit:* $${scoreResult.credit_limit_usd}
🏆 *Credit Tier:* ${scoreResult.tier}
📊 *Credit Score:* ${scoreResult.scaled_score}/850

You can now choose a smartphone up to $${scoreResult.credit_limit_usd}.

📱 *Available Devices:*
• Samsung A15 - $180
• Tecno Spark 20 - $150
• Infinix Note 30 - $195

*Payment Plan:*
• 6 months installments
• ${scoreResult.down_payment_percentage}% down payment
• ${scoreResult.interest_rate_apr}% APR

Ready to continue?
Reply *Yes* to see loan terms`;
    }

    if (scoreResult.decision === 'review') {
      return `⏸️ *Manual Review Required*

We need to manually review your application. This takes up to 24 hours.

You'll receive a WhatsApp message when ready.

Our team will review:
• Income information
• Identity verification
• Eligibility criteria

Usually takes 2-12 hours.`;
    }

    return `❌ *Application Not Approved*

Unfortunately, we cannot approve your application at this time.

Possible reasons:
• Income below minimum threshold
• Debt-to-income ratio too high
• Incomplete information

You can try again in 30 days or contact support: support@lynia.finance`;

  } catch (error) {
    logger.error('Credit scoring failed', { action: 'scoring.calculate', meta: { error: error instanceof Error ? error.message : 'Unknown' } });

    // Do NOT auto-approve when scoring service is unavailable.
    // Keep session in credit_scoring state so customer can retry.
    const lang: SupportedLanguage = session.state_data.preferred_language || 'en';
    return t('scoring_unavailable', lang) + `\nReference: SCORE-${Date.now()}`;
  }
}

/**
 * Handle LOAN_OFFER state
 */
export async function handleLoanOffer(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim().toLowerCase();

  if (message.includes('yes') || message.includes('continue')) {
    await updateSession(context.from, {
      current_state: 'terms_acceptance'
    });

    const creditLimit = session.state_data.credit_limit_usd || 200;

    return `📄 *Loan Terms & Conditions*

Before we proceed, please review:

1. You'll make 6-8 monthly payments
2. Device will be locked if payment is missed
3. Device unlocks after final payment
4. No early repayment penalties
5. 10% down payment required

*Your Loan Details:*
• Maximum: $${creditLimit}
• Term: 6-8 months
• Monthly payment: ~$${Math.round((creditLimit * 1.15) / 6)}
• Down payment: $${Math.round(creditLimit * 0.1)}

Do you accept these terms?

Reply *I Accept* to continue`;
  }

  return `Please reply *Yes* to continue with your loan application.`;
}

/**
 * Handle TERMS_ACCEPTANCE state
 */
export async function handleTermsAcceptance(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim().toLowerCase();

  if (message.includes('accept') || message.includes('i accept')) {
    // Log consent (schema: migration 007 - customer_consents table)
    await db.from('customer_consents').insert({
      customer_id: session.customer_id,
      purpose: 'loan_terms',
      granted: true,
      granted_at: new Date(),
      consent_method: 'whatsapp'
    }).execute();

    await updateSession(context.from, {
      current_state: 'completed',
      state_data: {
        ...session.state_data
      }
    });

    return `✅ *Onboarding Complete!*

Congratulations! Your application is approved.

*Next Steps:*
1. Visit a Lynia distributor
2. Choose your device
3. Pay deposit (${session.state_data.credit_limit_usd ? Math.round(session.state_data.credit_limit_usd * 0.1) : 20} USD)
4. Collect your device

*Nearest Distributor:*
📍 Tech Hub Harare
   123 Jason Moyo Ave, Harare
   Mon-Sat, 9am-6pm

*What to bring:*
✅ Your National ID
✅ This phone (for verification)

We'll send you payment instructions shortly.

Welcome to Lynia Finance! 🎉`;
  }

  return `Please reply *I Accept* to accept the loan terms and complete your application.`;
}

// ===================================================================
// KYC PROCESSING HANDLERS
// ===================================================================

/**
 * Handle KYC_PROCESSING state
 * Customer messages while KYC is being verified — tell them to wait.
 */
async function handleKYCProcessing(
  session: OnboardingSession,
  _context: MessageContext
): Promise<string> {
  // Check if KYC has been completed while they were waiting
  if (session.state_data.kyc_verification_id) {
    const { data: customer } = await db
      .from('customers')
      .select('id')
      .eq('whatsapp_number', _context.from)
      .single()
      .execute();

    if (customer) {
      const { data: kycSubmission } = await db
        .from('kyc_submissions')
        .select('status, verification_decision, verification_reason')
        .eq('id', session.state_data.kyc_verification_id)
        .single()
        .execute();

      if (kycSubmission) {
        if (kycSubmission.status === 'verified') {
          await updateSession(_context.from, {
            current_state: 'credit_scoring',
            state_data: { ...session.state_data, kyc_status: 'verified' }
          });

          return `✅ *Identity Verified!*

Great news! Your identity has been confirmed.

⏳ *Assessing your eligibility...*

We're calculating your loan amount based on:
✓ Identity verification
✓ Income information
✓ First-time borrower status

This takes about 10 seconds...`;
        }

        if (kycSubmission.status === 'rejected') {
          const retryCount = (session.state_data.retry_count || 0) + 1;
          const attemptsRemaining = 3 - retryCount;

          if (attemptsRemaining <= 0) {
            await updateSession(_context.from, {
              current_state: 'rejected',
              state_data: { ...session.state_data, kyc_status: 'failed' }
            });

            return `❌ *Verification Failed*

You have used all 3 verification attempts.

Please contact support: support@lynia.finance`;
          }

          await updateSession(_context.from, {
            current_state: 'kyc_id_upload',
            state_data: {
              ...session.state_data,
              kyc_status: 'failed',
              id_photo_url: undefined,
              selfie_photo_url: undefined,
              id_number: undefined,
              retry_count: retryCount
            }
          });

          return `❌ *Verification Unsuccessful*

${kycSubmission.verification_reason || 'We could not verify your identity.'}

You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.

Enter your National ID number to try again:
Format: *XX-XXXXXXX-X-XX*`;
        }
      }
    }
  }

  return `⏳ *Still Verifying...*

Your identity verification is being processed.

This usually takes 1-5 minutes. We'll message you as soon as it's complete.

Please wait a bit longer.`;
}

/**
 * Resume onboarding after KYC callback completes.
 * Called by the KYC service when a verification result arrives.
 * Returns the message to send to the customer.
 */
export async function resumeOnboardingAfterKYC(
  phoneNumber: string,
  kycStatus: 'verified' | 'rejected' | 'manual_review',
  reason?: string
): Promise<string | null> {
  const { data: session } = await db
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!session || session.current_state !== 'kyc_processing') {
    return null;
  }

  const stateData = session.state_data || {};

  if (kycStatus === 'verified') {
    await updateSession(phoneNumber, {
      current_state: 'credit_scoring',
      state_data: { ...stateData, kyc_status: 'verified' }
    });

    return `✅ *Identity Verified!*

Great news! Your identity has been confirmed.

⏳ *Assessing your eligibility...*

We're calculating your loan amount based on:
✓ Identity verification
✓ Income information
✓ First-time borrower status

Reply with any message to continue.`;
  }

  if (kycStatus === 'rejected') {
    const retryCount = (stateData.retry_count || 0) + 1;
    const attemptsRemaining = 3 - retryCount;

    if (attemptsRemaining <= 0) {
      await updateSession(phoneNumber, {
        current_state: 'rejected',
        state_data: { ...stateData, kyc_status: 'failed' }
      });

      return `❌ *Verification Failed*

You have used all 3 verification attempts.

Please contact support: support@lynia.finance`;
    }

    await updateSession(phoneNumber, {
      current_state: 'kyc_id_upload',
      state_data: {
        ...stateData,
        kyc_status: 'failed',
        id_photo_url: undefined,
        selfie_photo_url: undefined,
        id_number: undefined,
        retry_count: retryCount
      }
    });

    return `❌ *Verification Unsuccessful*

${reason || 'We could not verify your identity.'}

You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.

Enter your National ID number to try again:
Format: *XX-XXXXXXX-X-XX*`;
  }

  // manual_review
  return `⏸️ *Manual Review Required*

Your verification needs additional review by our team. This typically takes 2-12 hours.

You'll receive a WhatsApp message when complete.`;
}

// ===================================================================
// MAIN ONBOARDING ROUTER
// ===================================================================

/**
 * Route incoming message to appropriate state handler
 */
export async function routeOnboardingMessage(
  context: MessageContext,
  imageUrl?: string
): Promise<string> {
  try {
    const session = await getOrCreateSession(context.from);

    logger.debug('Routing onboarding message', { action: 'onboarding.route', meta: { state: session.current_state } });

    // Handle restart command
    if (context.message.toLowerCase().includes('restart')) {
      await updateSession(context.from, {
        current_state: 'welcome',
        state_data: {}
      });
      return handleWelcome(context);
    }

    // Route based on current state
    switch (session.current_state) {
      case 'welcome':
        return handleWelcome(context);

      case 'collecting_personal_info':
        return handlePersonalInfo(session, context);

      case 'collecting_employment':
        return handleEmployment(session, context);

      case 'product_selection':
        return handleProductSelection(session, context);

      case 'kyc_id_upload':
        return handleKYCIdUpload(session, context, imageUrl);

      case 'kyc_selfie_upload':
        return handleKYCSelfieUpload(session, context, imageUrl);

      case 'kyc_processing':
        return handleKYCProcessing(session, context);

      case 'credit_scoring':
        return handleCreditScoring(session, context);

      case 'loan_offer':
        return handleLoanOffer(session, context);

      case 'terms_acceptance':
        return handleTermsAcceptance(session, context);

      case 'completed':
        return `You've already completed onboarding!

Your application is approved. Visit your nearest distributor to collect your device.

Need help? Reply *Support*`;

      default:
        return `Something went wrong. Reply *Restart* to begin again.`;
    }
  } catch (error) {
    logger.error('Onboarding routing error', { action: 'onboarding.route', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return `⚠️ Technical error. Please try again or contact support@lynia.finance`;
  }
}
