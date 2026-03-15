/**
 * SMS Sender Module
 * Sends SMS notifications via AWS SNS to Zimbabwe mobile numbers.
 * Uses IAM-based authentication (no API keys needed).
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { validateZimbabwePhoneNumber } from '../../shared/utils/validation';
import logger from '../../shared/utils/logger';

const snsClient = new SNSClient({});

/** Maximum SMS messages per phone number per 24-hour window */
const MAX_SMS_PER_DAY = 10;
/** 24 hours in milliseconds */
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SmsResult {
  success: boolean;
  messageId?: string;
}

export class SmsError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_PHONE' | 'RATE_LIMITED' | 'SNS_ERROR' | 'SEND_FAILED',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SmsError';
  }
}

// --- In-memory rate limiter for SMS per phone number ---

interface SmsRateLimitEntry {
  count: number;
  resetAt: number;
}

const smsRateLimitStore = new Map<string, SmsRateLimitEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  for (const [key, entry] of smsRateLimitStore) {
    if (now > entry.resetAt) {
      smsRateLimitStore.delete(key);
    }
  }
  lastCleanup = now;
}

/**
 * Check if a phone number has exceeded the daily SMS rate limit.
 * @returns true if the number is rate-limited (should NOT send)
 */
export function checkSmsRateLimit(phoneNumber: string): boolean {
  cleanupExpiredEntries();
  const now = Date.now();
  const entry = smsRateLimitStore.get(phoneNumber);

  if (!entry || now > entry.resetAt) {
    smsRateLimitStore.set(phoneNumber, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_SMS_PER_DAY) {
    return true;
  }

  entry.count++;
  return false;
}

/** Reset rate limit store — exposed for testing only */
export function _resetRateLimitStore(): void {
  smsRateLimitStore.clear();
  lastCleanup = Date.now();
}

/**
 * Send an SMS message to a Zimbabwe mobile number via AWS SNS.
 *
 * @param phoneNumber - Customer phone number (local or international format)
 * @param message - SMS message body (max 160 chars for single segment)
 * @returns SmsResult with messageId on success
 * @throws SmsError on validation failure, rate limit, or SNS error
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<SmsResult> {
  // Validate and normalize phone number
  const validation = validateZimbabwePhoneNumber(phoneNumber);
  if (!validation.valid) {
    throw new SmsError(
      `Invalid Zimbabwe phone number: ${validation.message}`,
      'INVALID_PHONE',
      { phoneNumber: phoneNumber.slice(0, 6) + '***' }
    );
  }

  const normalizedPhone = validation.normalized!;

  // Check rate limit
  if (checkSmsRateLimit(normalizedPhone)) {
    throw new SmsError(
      'SMS rate limit exceeded for this number',
      'RATE_LIMITED',
      { maxPerDay: MAX_SMS_PER_DAY }
    );
  }

  // Send via AWS SNS
  try {
    const command = new PublishCommand({
      PhoneNumber: normalizedPhone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'Lynia',
        },
      },
    });

    const response = await snsClient.send(command);

    logger.info('SMS sent successfully', {
      action: 'sms.send',
      status: 'completed',
      messageId: response.MessageId,
      phoneNumber: normalizedPhone.slice(0, 7) + '****',
    });

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SNS error';
    logger.error('SMS send failed', {
      action: 'sms.send',
      status: 'failed',
      errorMessage,
      phoneNumber: normalizedPhone.slice(0, 7) + '****',
    });

    throw new SmsError(
      'Failed to send SMS',
      'SNS_ERROR',
      { snsError: errorMessage }
    );
  }
}
