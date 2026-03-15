/**
 * Email Sender Module
 * Sends email notifications via AWS SES.
 * Uses IAM-based authentication (no API keys needed).
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import logger from '../../shared/utils/logger';

const sesClient = new SESClient({});

/** Maximum emails per address per 24-hour window */
const MAX_EMAILS_PER_DAY = 20;
/** 24 hours in milliseconds */
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Sender address — override via SES_SENDER_EMAIL env var */
const SENDER_EMAIL = process.env.SES_SENDER_EMAIL || 'noreply@lynia.finance';

export interface EmailResult {
  success: boolean;
  messageId?: string;
}

export class EmailError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_EMAIL' | 'RATE_LIMITED' | 'SES_ERROR' | 'SEND_FAILED',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

// --- In-memory rate limiter for emails per address ---

interface EmailRateLimitEntry {
  count: number;
  resetAt: number;
}

const emailRateLimitStore = new Map<string, EmailRateLimitEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  for (const [key, entry] of emailRateLimitStore) {
    if (now > entry.resetAt) {
      emailRateLimitStore.delete(key);
    }
  }
  lastCleanup = now;
}

/**
 * Check if an email address has exceeded the daily email rate limit.
 * @returns true if the address is rate-limited (should NOT send)
 */
export function checkEmailRateLimit(email: string): boolean {
  cleanupExpiredEntries();
  const now = Date.now();
  const entry = emailRateLimitStore.get(email);

  if (!entry || now > entry.resetAt) {
    emailRateLimitStore.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_EMAILS_PER_DAY) {
    return true;
  }

  entry.count++;
  return false;
}

/** Reset rate limit store — exposed for testing only */
export function _resetRateLimitStore(): void {
  emailRateLimitStore.clear();
  lastCleanup = Date.now();
}

/** Basic email format validation */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Mask an email address for safe logging.
 * Shows the first 3 characters of the local part, then ***@domain.
 * Example: "john.doe@example.com" → "joh***@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, 3);
  return `${visible}***@${domain}`;
}

/**
 * Send an email via AWS SES.
 *
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param textBody - Plain-text email body
 * @param htmlBody - Optional HTML email body
 * @returns EmailResult with messageId on success
 * @throws EmailError on validation failure, rate limit, or SES error
 */
export async function sendEmail(
  to: string,
  subject: string,
  textBody: string,
  htmlBody?: string
): Promise<EmailResult> {
  // Validate email format
  if (!isValidEmail(to)) {
    throw new EmailError(
      `Invalid email address: ${maskEmail(to)}`,
      'INVALID_EMAIL',
      { email: maskEmail(to) }
    );
  }

  // Check rate limit
  if (checkEmailRateLimit(to)) {
    throw new EmailError(
      'Email rate limit exceeded for this address',
      'RATE_LIMITED',
      { maxPerDay: MAX_EMAILS_PER_DAY }
    );
  }

  // Send via AWS SES
  try {
    const body: Record<string, { Data: string }> = {
      Text: { Data: textBody },
    };
    if (htmlBody) {
      body.Html = { Data: htmlBody };
    }

    const command = new SendEmailCommand({
      Source: SENDER_EMAIL,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: { Data: subject },
        Body: body,
      },
    });

    const response = await sesClient.send(command);

    logger.info('Email sent successfully', {
      action: 'email.send',
      status: 'completed',
      messageId: response.MessageId,
      email: maskEmail(to),
    });

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SES error';
    logger.error('Email send failed', {
      action: 'email.send',
      status: 'failed',
      errorMessage,
      email: maskEmail(to),
    });

    throw new EmailError(
      'Failed to send email',
      'SES_ERROR',
      { sesError: errorMessage }
    );
  }
}
