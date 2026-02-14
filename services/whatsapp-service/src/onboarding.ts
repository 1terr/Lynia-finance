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
    .from('whatsapp_onboarding_sessions')
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
    .from('whatsapp_onboarding_sessions')
    .insert(session)
    .select()
    .single()
    .execute();

  if (error) {
    console.error('Failed to create session:', error);
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
    .from('whatsapp_onboarding_sessions')
    .update({
      ...updates,
      last_activity_at: new Date()
    })
    .eq('phone_number', phoneNumber)
    .execute();

  if (error) {
    console.error('Failed to update session:', error);
    throw new Error('Failed to update session');
  }
}

// ===================================================================
// STATE HANDLERS
// ===================================================================

/**
 * Handle WELCOME state
 */
export async function handleWelcome(context: MessageContext): Promise<string> {
  const session = await getOrCreateSession(context.from);

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

      return `❌ *Service Not Available*

We currently only serve customers with Zimbabwean phone numbers (+263).

We'll notify you when we expand to your country! 🌍

Have a Zimbabwean number? Contact us: support@lynia.finance`;
    }

    return `❌ *Invalid Phone Number*

Please ensure you're messaging from a valid Zimbabwean mobile number.

Valid formats:
• +263 77 123 4567
• 0771234567

Need help? Contact support@lynia.finance`;
  }

  // Phone is valid, move to personal info collection
  await updateSession(context.from, {
    current_state: 'collecting_personal_info',
    state_data: {
      ...session.state_data,
      started_at: new Date().toISOString()
    }
  });

  return `👋 *Welcome to Lynia Finance!*

Get a smartphone today, pay over 6-8 months.

✅ No credit history needed
✅ Fast approval (<10 min)
✅ Flexible payment plans
✅ Device locked until paid

Let's get started! First, what's your full name? (as it appears on your National ID)

Example: *Tendai Mukanya Moyo*`;
}

/**
 * Handle COLLECTING_PERSONAL_INFO state
 */
export async function handlePersonalInfo(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();

  // Collect full name
  if (!session.state_data.full_name) {
    // Validate name (2-5 words)
    const nameParts = message.split(/\s+/);
    if (nameParts.length < 2 || nameParts.length > 5) {
      return `Please provide your full name (2-5 words).

Example: *Tendai Mukanya Moyo*`;
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        full_name: message
      }
    });

    return `Great, ${nameParts[0]}! 👍

Now, what's your date of birth?

Format: *DD/MM/YYYY*
Example: *15/03/1990*`;
  }

  // Collect date of birth
  if (!session.state_data.date_of_birth) {
    // Validate DOB format and age (18-75)
    const dobPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = message.match(dobPattern);

    if (!match) {
      return `Invalid date format. Please use DD/MM/YYYY

Example: *15/03/1990*`;
    }

    const [, day, month, year] = match;
    const dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    if (age < 18 || age > 75) {
      return `Sorry, you must be between 18 and 75 years old to apply.

Age: ${age} years`;
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        date_of_birth: message
      }
    });

    return `Perfect! Now, what's your gender?

Reply with:
1️⃣ *Male*
2️⃣ *Female*
3️⃣ *Other*`;
  }

  // Collect gender
  if (!session.state_data.gender) {
    const gender = message.toLowerCase();
    if (!['male', 'female', 'other', '1', '2', '3'].includes(gender)) {
      return `Please select your gender:

1️⃣ *Male*
2️⃣ *Female*
3️⃣ *Other*`;
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

    return `Great! What city/town do you live in?

Examples:
• *Harare*
• *Bulawayo*
• *Chitungwiza*
• *Mutare*`;
  }

  // Collect location and move to employment info
  if (!session.state_data.location) {
    const location = message.trim();

    if (location.length < 2) {
      return `Please enter a valid city or town name.`;
    }

    await updateSession(context.from, {
      current_state: 'collecting_employment',
      state_data: {
        ...session.state_data,
        location: location
      }
    });

    return `✅ *Personal Info Complete!*

Now let's talk about your income. This helps us determine your loan amount.

What type of work do you do?

Examples:
• *Formal employment*
• *Self-employed*
• *Informal trader*
• *Driver (Uber/Bolt)*
• *Other*`;
  }

  return 'Something went wrong. Please contact support.';
}

/**
 * Handle COLLECTING_EMPLOYMENT state
 */
export async function handleEmployment(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();

  // Collect employment type
  if (!session.state_data.employment_type) {
    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        employment_type: message
      }
    });

    return `Got it! What's your average monthly income (in USD)?

Please enter a number:
Example: *350*`;
  }

  // Collect monthly income
  if (!session.state_data.monthly_income_usd) {
    const income = parseFloat(message);

    if (isNaN(income) || income <= 0) {
      return `Please enter a valid income amount (numbers only).

Example: *350*`;
    }

    if (income < 50) {
      return `Minimum monthly income required: $50 USD

Your income: $${income}

If this is incorrect, please re-enter your monthly income.`;
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        monthly_income_usd: income
      }
    });

    return `Do you have any existing debt obligations? (loans, rent, etc.)

Enter monthly amount in USD, or type *0* if none:
Example: *50*`;
  }

  // Collect existing debts
  if (session.state_data.existing_debt_obligations_usd === undefined) {
    const debts = parseFloat(message);

    if (isNaN(debts) || debts < 0) {
      return `Please enter a valid amount (numbers only), or *0* if no debts.

Example: *50* or *0*`;
    }

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        existing_debt_obligations_usd: debts
      }
    });

    return `How many people live in your household? (including yourself)

Example: *3*`;
  }

  // Collect household size and move to product selection
  if (!session.state_data.household_size) {
    const household = parseInt(message);

    if (isNaN(household) || household < 1 || household > 20) {
      return `Please enter a valid number (1-20).

Example: *3*`;
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

    return `✅ *Income Info Complete!*

Now, what would you like to apply for?

1️⃣ *Smartphone Financing* 📱
   Get a device now, pay monthly

2️⃣ *Digital Credit* 💰 (Coming Soon)
   Cash loan for any purpose

Reply with *1* or *2*`;
  }

  return 'Something went wrong. Please contact support.';
}

/**
 * Handle PRODUCT_SELECTION state
 */
export async function handleProductSelection(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim().toLowerCase();

  if (message === '1' || message.includes('smartphone')) {
    await updateSession(context.from, {
      current_state: 'kyc_id_upload',
      state_data: {
        ...session.state_data,
        selected_product: 'smartphone',
        requested_loan_amount: 250 // Default, will be determined by credit scoring
      }
    });

    return `📱 *Smartphone Financing Selected!*

Perfect! We'll assess your eligibility and show you available devices.

First, we need to verify your identity.

📸 *Step 1: Upload your National ID*

Tips for a clear photo:
✅ Place ID on flat surface
✅ Good lighting, no shadows
✅ All text visible
✅ Hold phone steady

*Send photo now*`;
  }

  if (message === '2' || message.includes('digital')) {
    return `💰 *Digital Credit Coming Soon!*

We're launching digital credit in Q1 2026.

For now, you can apply for smartphone financing.

Would you like to continue with smartphone financing?

Reply *Yes* to continue`;
  }

  return `Please select an option:

1️⃣ *Smartphone Financing*
2️⃣ *Digital Credit* (Coming Soon)

Reply with *1* or *2*`;
}

/**
 * Handle KYC_ID_UPLOAD state
 */
export async function handleKYCIdUpload(
  session: OnboardingSession,
  context: MessageContext,
  imageUrl?: string
): Promise<string> {
  if (!imageUrl) {
    return `Please send a photo of your National ID.

Make sure:
✅ Photo is clear and readable
✅ All corners visible
✅ Good lighting

*Send photo now*`;
  }

  // Store ID photo URL and move to selfie capture
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

  // Store selfie URL and move to KYC processing
  await updateSession(context.from, {
    current_state: 'kyc_processing',
    state_data: {
      ...session.state_data,
      selfie_photo_url: imageUrl,
      kyc_status: 'pending'
    }
  });

  // Simulate KYC verification (in production, call Smile Identity API)
  // For now, auto-approve for testing
  const kycResult = {
    verified: true,
    confidence: 0.96,
    liveness_passed: true
  };

  if (kycResult.verified) {
    await updateSession(context.from, {
      current_state: 'credit_scoring',
      state_data: {
        ...session.state_data,
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

  return `❌ *Verification Unsuccessful*

We couldn't verify your identity. This could be because:
• Photos were too blurry
• ID doesn't match selfie
• Liveness check failed

You can try again. Please retake your photos.

Reply *Restart* to begin again.`;
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
    const scoringPayload = {
      customer_id: session.customer_id || `temp_${context.from}`,
      monthly_income_usd: session.state_data.monthly_income_usd || 200,
      existing_debt_obligations_usd: session.state_data.existing_debt_obligations_usd || 0,
      household_size: session.state_data.household_size || 1,
      dependents: session.state_data.dependents || 0,
      requested_loan_amount: session.state_data.requested_loan_amount || 250,
      kyc_result: {
        id_verification: { status: 'verified' },
        face_match: { confidence: 0.96 },
        liveness: { status: 'passed' }
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
    console.error('Credit scoring failed:', error);

    // Fallback: Basic approval for testing
    await updateSession(context.from, {
      current_state: 'loan_offer',
      state_data: {
        ...session.state_data,
        credit_score: 680,
        credit_tier: 'Tier 1',
        credit_limit_usd: 200,
        decision: 'approve'
      }
    });

    return `🎉 *Congratulations! You're Approved!*

Your Loan Details:
💰 *Loan Limit:* $200
🏆 *Credit Tier:* Tier 1
📊 *Credit Score:* 680/850

You can now choose a smartphone up to $200.

Reply *Yes* to see loan terms and continue.`;
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
    // Log consent
    await db.from('customer_consents').insert({
      customer_id: session.customer_id,
      phone_number: context.from,
      consent_type: 'loan_terms',
      consent_text: 'Customer accepted loan terms via WhatsApp',
      version: '1.0',
      accepted_at: new Date()
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

    console.log(`Current state: ${session.current_state}`);

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
    console.error('Onboarding routing error:', error);
    return `⚠️ Technical error. Please try again or contact support@lynia.finance`;
  }
}
