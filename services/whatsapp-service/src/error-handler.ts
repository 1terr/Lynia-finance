/**
 * WhatsApp Conversation Error Handling (T011)
 *
 * Comprehensive error handling for the WhatsApp bot covering:
 * - User input errors with auto-correction
 * - Unexpected message types
 * - Out-of-context commands
 * - Global commands (CANCEL, HELP, BACK, CONTINUE)
 * - Timeout detection
 * - WhatsApp API errors (rate limits, undeliverable, service window)
 * - Rapid message deduplication
 * - Message length validation
 * - Inappropriate language detection
 * - Suspicious input sanitization
 * - Error logging and analytics tracking
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===================================================================
// ERROR TYPES
// ===================================================================

export type ErrorCategory =
  | 'user_input'
  | 'validation'
  | 'timeout'
  | 'api'
  | 'system'
  | 'network'
  | 'security';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ConversationError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  userMessage: string;
  internalMessage: string;
  metadata?: Record<string, unknown>;
}

// ===================================================================
// GLOBAL COMMANDS
// ===================================================================

const GLOBAL_COMMANDS = ['help', 'cancel', 'back', 'restart', 'continue', 'support', 'language'] as const;
export type GlobalCommand = typeof GLOBAL_COMMANDS[number];

const ACTIVE_LOAN_COMMANDS = ['balance', 'pay', 'schedule', 'history', 'device', 'extension'] as const;
export type ActiveLoanCommand = typeof ACTIVE_LOAN_COMMANDS[number];

/**
 * Check if input is a global command that should be handled regardless of state
 */
export function detectGlobalCommand(input: string): GlobalCommand | null {
  const normalized = input.trim().toLowerCase();
  for (const cmd of GLOBAL_COMMANDS) {
    if (normalized === cmd) return cmd;
  }
  return null;
}

/**
 * Check if input is an active-loan command being used out of context
 */
export function detectOutOfContextCommand(input: string): ActiveLoanCommand | null {
  const normalized = input.trim().toLowerCase();
  for (const cmd of ACTIVE_LOAN_COMMANDS) {
    if (normalized === cmd) return cmd;
  }
  return null;
}

/**
 * Generate response for global commands
 */
export function handleGlobalCommandResponse(command: GlobalCommand): string {
  switch (command) {
    case 'help':
      return `Need help? Here's what you can do:

*Commands:*
- *RESTART* - Start your application over
- *CANCEL* - Cancel current application (progress saved for 48h)
- *BACK* - Go to previous question
- *CONTINUE* - Resume where you left off
- *SUPPORT* - Connect with a human agent
- *LANGUAGE* - Change language

Type any command to continue.`;

    case 'cancel':
      return `Application paused.

Your progress has been saved for 48 hours.

Reply *CONTINUE* to resume or *RESTART* to start fresh.`;

    case 'support':
      return `Connecting you with support...

A human agent will respond within 5 minutes.

You can also email us at support@lynia.finance

Reference: SUP-${Date.now()}`;

    case 'language':
      return `Choose your language:

1 - English
2 - Shona
3 - Ndebele

Reply with 1, 2, or 3.`;

    default:
      return '';
  }
}

/**
 * Generate response for out-of-context loan commands
 */
export function handleOutOfContextResponse(command: ActiveLoanCommand): string {
  return `I see you want to ${command}, but you don't have an active loan yet.

Let's finish your application first!

Please answer the previous question, or reply *CANCEL* to stop.`;
}

// ===================================================================
// INPUT VALIDATION WITH AUTO-CORRECTION
// ===================================================================

/**
 * Validate and auto-correct National ID format
 * Expected: XX-XXXXXXX-X-XX (e.g., 63-1234567-A-12)
 */
export function validateNationalId(input: string): {
  valid: boolean;
  error?: string;
  suggestion?: string;
  userMessage: string;
} {
  const pattern = /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/;

  if (pattern.test(input.toUpperCase())) {
    return { valid: true, userMessage: '' };
  }

  // Attempt auto-correction
  const suggestion = attemptNationalIdCorrection(input);

  if (suggestion) {
    return {
      valid: false,
      error: 'format_correctable',
      suggestion,
      userMessage: `I think you meant: *${suggestion}*

Is this your National ID?

Reply *YES* to confirm or *NO* to re-enter.`,
    };
  }

  return {
    valid: false,
    error: 'invalid_format',
    userMessage: `Invalid National ID format.

Please use this format: *63-1234567-A-12*

Make sure to include the dashes (-) and the letter.

Example: *63-1234567-A-12*`,
  };
}

function attemptNationalIdCorrection(input: string): string | null {
  const cleaned = input.replace(/[^0-9A-Z]/gi, '').toUpperCase();

  if (cleaned.length >= 11 && cleaned.length <= 12) {
    const formatted = `${cleaned.slice(0, 2)}-${cleaned.slice(2, -3)}-${cleaned.slice(-3, -2)}-${cleaned.slice(-2)}`;
    if (/^\d{2}-\d{6,7}-[A-Z]-\d{2}$/.test(formatted)) {
      return formatted;
    }
  }

  return null;
}

/**
 * Validate and auto-correct phone number
 * Expected: 263XXXXXXXXX (12 digits)
 */
export function validatePhoneNumber(input: string): {
  valid: boolean;
  normalized?: string;
  userMessage: string;
} {
  let cleaned = input.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = '263' + cleaned.substring(1);
  }

  if (!cleaned.startsWith('263')) {
    cleaned = '263' + cleaned;
  }

  if (cleaned.length === 12 && /^263[0-9]{9}$/.test(cleaned)) {
    return {
      valid: true,
      normalized: cleaned,
      userMessage: `Got it! I'll use: *${cleaned}*

Is this correct?

Reply *YES* to confirm or *NO* to re-enter.`,
    };
  }

  return {
    valid: false,
    userMessage: `Please enter your phone number with country code.

*Format:* 263771234567

Zimbabwe country code is 263, followed by your 9-digit number.`,
  };
}

/**
 * Validate income amount
 */
export function validateIncome(input: string): {
  valid: boolean;
  amount?: number;
  error?: string;
  userMessage: string;
} {
  const cleaned = input.replace(/[$,\s]/g, '');
  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    return {
      valid: false,
      error: 'not_a_number',
      userMessage: `Please enter your monthly income as a number.

*Example:* 250 (for $250/month)

Don't include currency symbols or commas.`,
    };
  }

  if (amount < 0) {
    return {
      valid: false,
      error: 'negative_amount',
      userMessage: `Income cannot be negative. Please enter a valid amount.

*Example:* 250`,
    };
  }

  if (amount < 50) {
    return {
      valid: false,
      error: 'below_minimum',
      userMessage: `Our minimum income requirement is $50/month.

Your income: $${amount}

If your income is at least $50, please re-enter the correct amount.

Reply *SUPPORT* if you think this is an error.`,
    };
  }

  if (amount > 10000) {
    return {
      valid: false,
      error: 'suspiciously_high',
      userMessage: `The amount you entered ($${amount.toLocaleString()}) seems high for monthly income.

Did you mean:
- *$${(amount / 10).toFixed(0)}* per month? (Reply ${(amount / 10).toFixed(0)})
- *$${(amount / 12).toFixed(0)}* per month from yearly? (Reply ${(amount / 12).toFixed(0)})

Or reply with the correct monthly amount.`,
    };
  }

  return { valid: true, amount, userMessage: '' };
}

// ===================================================================
// MESSAGE TYPE HANDLING
// ===================================================================

export type ExpectedInputType = 'text' | 'image' | 'any';

/**
 * Handle unexpected message types based on what's expected
 */
export function handleUnexpectedMessageType(
  receivedType: string,
  expectedType: ExpectedInputType,
  currentState: string
): string | null {
  if (expectedType === 'any') return null;

  if (expectedType === 'image' && receivedType !== 'image') {
    return `I need a photo, not a ${receivedType === 'audio' ? 'voice message' : receivedType}.

Please send a clear photo of your ${currentState === 'kyc_id_upload' ? 'National ID' : 'face (selfie)'}.`;
  }

  if (expectedType === 'text' && receivedType !== 'text' && receivedType !== 'interactive') {
    if (receivedType === 'audio' || receivedType === 'voice') {
      return `I received your voice message, but I need a text reply for this question.

Please type your answer.`;
    }

    if (receivedType === 'sticker') {
      return `Thanks for the sticker! But I need a text reply right now.

Please type your answer to continue.`;
    }

    if (receivedType === 'location') {
      return `I received your location, but I need a text reply for this question.

Please type your answer.`;
    }

    return `I received your ${receivedType}, but I need a text reply right now.

Please type your answer.`;
  }

  return null;
}

/**
 * Get expected input type for a given conversation state
 */
export function getExpectedInputType(state: string): ExpectedInputType {
  if (state === 'kyc_id_upload' || state === 'kyc_selfie_upload') {
    return 'image';
  }
  return 'text';
}

// ===================================================================
// MESSAGE VALIDATION
// ===================================================================

const MAX_MESSAGE_LENGTH = 500;

/**
 * Validate message length
 */
export function validateMessageLength(text: string): { valid: boolean; userMessage?: string } {
  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      userMessage: `That message was quite long!

Please keep your answer short and simple.`,
    };
  }
  return { valid: true };
}

// ===================================================================
// RAPID MESSAGE DETECTION
// ===================================================================

const recentMessages = new Map<string, { count: number; firstAt: number }>();

/**
 * Detect rapid successive messages from same user.
 * Returns true if messages should be throttled.
 */
export function detectRapidMessages(phoneNumber: string): boolean {
  const now = Date.now();
  const entry = recentMessages.get(phoneNumber);

  // Clean up stale entries
  if (entry && now - entry.firstAt > 5000) {
    recentMessages.delete(phoneNumber);
    return false;
  }

  if (!entry) {
    recentMessages.set(phoneNumber, { count: 1, firstAt: now });
    return false;
  }

  entry.count++;

  if (entry.count >= 5) {
    recentMessages.delete(phoneNumber);
    return true;
  }

  return false;
}

export function getRapidMessageResponse(): string {
  return `I received multiple messages from you.

Please send one message at a time so I can help you better.`;
}

// ===================================================================
// INAPPROPRIATE LANGUAGE DETECTION
// ===================================================================

const INAPPROPRIATE_PATTERNS = [
  /\bf+u+c+k+/i,
  /\bs+h+i+t+/i,
  /\ba+s+s+h+o+l+e+/i,
  /\bb+i+t+c+h+/i,
  /\bd+a+m+n+/i,
  /\bscam/i,
  /\bfraud/i,
  /\bsteal/i,
  /\bthie[fv]/i,
];

/**
 * Check for inappropriate language.
 * Returns user message if detected, null otherwise.
 */
export function checkInappropriateLanguage(text: string): string | null {
  const lower = text.toLowerCase();

  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(lower)) {
      return `Please keep the conversation professional.

Our team is here to help you get device financing.`;
    }
  }

  return null;
}

// ===================================================================
// SUSPICIOUS INPUT DETECTION (XSS / SQL INJECTION)
// ===================================================================

const SUSPICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /union\s+select/i,
  /drop\s+table/i,
  /;\s*--/,
  /'\s*or\s+'1'\s*=\s*'1/i,
  /'\s*;\s*delete/i,
  /\bexec\s*\(/i,
];

/**
 * Sanitize user input by removing control characters.
 * Throws if suspicious patterns are detected.
 */
export function sanitizeInput(input: string): { safe: boolean; sanitized: string } {
  const sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      return { safe: false, sanitized };
    }
  }

  return { safe: true, sanitized };
}

export function getSuspiciousInputResponse(): string {
  return `For security reasons, your session has been paused.

Our security team will review and contact you within 24 hours.

Reference: SEC-${Date.now()}`;
}

// ===================================================================
// CONVERSATION STATE FLOW (for BACK command)
// ===================================================================

const STATE_FLOW = [
  'welcome',
  'collecting_personal_info',
  'collecting_employment',
  'product_selection',
  'kyc_id_upload',
  'kyc_selfie_upload',
  'credit_scoring',
  'loan_offer',
  'terms_acceptance',
] as const;

/**
 * Get previous state for BACK command navigation
 */
export function getPreviousState(currentState: string): string | null {
  const currentIndex = STATE_FLOW.indexOf(currentState as typeof STATE_FLOW[number]);
  if (currentIndex > 0) {
    return STATE_FLOW[currentIndex - 1];
  }
  return null;
}

/**
 * Generate BACK navigation response
 */
export function getBackResponse(currentState: string): string | null {
  const previousState = getPreviousState(currentState);
  if (!previousState) {
    return `You're at the beginning. Can't go back further!

Reply *CANCEL* to stop or answer the question to continue.`;
  }
  return null; // Caller should navigate to previousState
}

// ===================================================================
// ERROR TRACKING & ANALYTICS
// ===================================================================

/**
 * Log a conversation error for analytics
 */
export async function trackError(
  phoneNumber: string,
  error: ConversationError
): Promise<void> {
  try {
    await supabase.from('whatsapp_error_log').insert({
      phone_number: phoneNumber,
      error_category: error.category,
      error_severity: error.severity,
      error_code: error.code,
      user_message: error.userMessage,
      internal_message: error.internalMessage,
      metadata: error.metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never let error tracking fail the main flow
    console.error('Failed to track error:', err);
  }
}

/**
 * Track security events (suspicious input, abuse, etc.)
 */
export async function trackSecurityEvent(
  phoneNumber: string,
  eventType: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('whatsapp_error_log').insert({
      phone_number: phoneNumber,
      error_category: 'security',
      error_severity: 'high',
      error_code: `SEC_${eventType.toUpperCase()}`,
      user_message: '',
      internal_message: `Security event: ${eventType}`,
      metadata: details,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to track security event:', err);
  }
}

// ===================================================================
// RETRY TRACKING
// ===================================================================

const MAX_RETRIES = 3;

/**
 * Check if customer has exceeded max retries for current step.
 * Returns escalation message if exceeded, null otherwise.
 */
export function checkRetryLimit(retryCount: number): string | null {
  if (retryCount >= MAX_RETRIES) {
    return `I'm having trouble understanding. Let me connect you with a human agent who can help.

Please wait, an agent will respond within 5 minutes.

Reference: ESC-${Date.now()}`;
  }
  return null;
}

// ===================================================================
// WHATSAPP API ERROR MAPPING
// ===================================================================

/**
 * Map WhatsApp Cloud API error codes to user-friendly responses
 * and determine if the error is retryable.
 */
export function mapWhatsAppApiError(errorCode: number): {
  retryable: boolean;
  userMessage: string;
  internalAction: 'retry' | 'queue' | 'fallback_sms' | 'alert';
} {
  switch (errorCode) {
    case 131031: // Rate limit
      return {
        retryable: true,
        userMessage: '',
        internalAction: 'queue',
      };

    case 131047: // Message undeliverable
      return {
        retryable: false,
        userMessage: '',
        internalAction: 'fallback_sms',
      };

    case 130472: // User not found on WhatsApp
      return {
        retryable: false,
        userMessage: '',
        internalAction: 'fallback_sms',
      };

    case 133016: // Service window expired (24h rule)
      return {
        retryable: false,
        userMessage: '',
        internalAction: 'fallback_sms',
      };

    default:
      return {
        retryable: true,
        userMessage: 'We had trouble sending your message. Please try again.',
        internalAction: 'retry',
      };
  }
}

// ===================================================================
// TIMEOUT MESSAGES
// ===================================================================

/**
 * Generate short timeout reminder (10 minutes)
 */
export function getShortTimeoutMessage(firstName?: string): string {
  return `Hi ${firstName || 'there'}, are you still there?

I'm waiting for your answer to continue.

Reply *CONTINUE* to pick up where we left off, or *CANCEL* to stop.`;
}

/**
 * Generate medium timeout message (24 hours) - for template messages
 */
export function getMediumTimeoutMessage(firstName?: string): string {
  return `Hi ${firstName || 'there'}, you started a loan application but didn't finish.

We saved your progress! Complete it now to get your device financing approved.

Time remaining: 24 hours

Reply *CONTINUE* to resume.`;
}

/**
 * Generate long timeout / expiry message (48+ hours)
 */
export function getLongTimeoutMessage(): string {
  return `Your application has expired due to inactivity.

Don't worry - you can start a new application anytime!

Reply *APPLY* when you're ready.`;
}
