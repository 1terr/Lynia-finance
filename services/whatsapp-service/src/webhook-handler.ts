/**
 * Webhook Handler Module
 *
 * Handles WhatsApp webhook verification (GET) and incoming webhook
 * processing (POST), including HMAC signature validation.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHmac } from 'crypto';
import type { WhatsAppWebhookEvent } from '../../shared/types';
import { getSecurityHeaders } from '../../shared/utils/response';
import { logger } from '../../shared/utils/logger';
import { processIncomingMessage } from './message-router';
import { updateMessageStatus } from './message-sender';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN!;
const META_APP_SECRET = process.env.META_APP_SECRET;

/**
 * Verify webhook - called by Meta when setting up webhook
 */
export function verifyWebhook(event: APIGatewayProxyEvent): APIGatewayProxyResult {
  const mode = event.queryStringParameters?.['hub.mode'];
  const token = event.queryStringParameters?.['hub.verify_token'];
  const challenge = event.queryStringParameters?.['hub.challenge'];

  logger.info('Webhook verification request', { action: 'webhook.verify', meta: { mode } });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('Webhook verified successfully', { action: 'webhook.verify', status: 'completed' });
    return {
      statusCode: 200,
      body: challenge!,
      headers: { 'Content-Type': 'text/plain' }
    };
  }

  logger.warn('Webhook verification failed', { action: 'webhook.verify', status: 'failed' });
  return {
    statusCode: 403,
    body: 'Forbidden',
    headers: { 'Content-Type': 'text/plain' }
  };
}

/**
 * Validate Meta webhook HMAC signature (X-Hub-Signature-256)
 *
 * Meta signs every webhook payload with the App Secret using HMAC-SHA256.
 * This prevents spoofed webhook calls from unauthorized sources.
 */
export function validateWebhookSignature(event: APIGatewayProxyEvent): boolean {
  if (!META_APP_SECRET) {
    // Skip validation if META_APP_SECRET is not configured (development/test only)
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging') {
      logger.warn('Webhook signature validation skipped: META_APP_SECRET not configured', { action: 'webhook.signature' });
      return true;
    }
    logger.error('META_APP_SECRET not configured - rejecting webhook', { action: 'webhook.signature' });
    return false;
  }

  const signature = event.headers['X-Hub-Signature-256'] || event.headers['x-hub-signature-256'];
  if (!signature) {
    logger.error('Missing X-Hub-Signature-256 header', { action: 'webhook.signature' });
    return false;
  }

  const body = event.body || '';
  const expectedSignature = 'sha256=' + createHmac('sha256', META_APP_SECRET).update(body).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  if (mismatch !== 0) {
    logger.error('Webhook signature mismatch', { action: 'webhook.signature' });
    return false;
  }

  return true;
}

/**
 * Handle incoming webhook from WhatsApp
 */
export async function handleWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Validate webhook signature from Meta
    if (!validateWebhookSignature(event)) {
      logger.error('Webhook signature validation failed', { action: 'webhook.signature' });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
        headers: getSecurityHeaders(event)
      };
    }

    const webhookEvent: WhatsAppWebhookEvent = JSON.parse(event.body || '{}');
    logger.info('WhatsApp webhook received', { action: 'webhook.receive', meta: { entryCount: webhookEvent.entry?.length } });

    // Process each entry in the webhook
    for (const entry of webhookEvent.entry) {
      for (const change of entry.changes) {
        const { value } = change;

        // Handle incoming messages
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await processIncomingMessage(message, value.contacts?.[0]?.profile?.name);
          }
        }

        // Handle message status updates (delivery/read receipts)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            await updateMessageStatus(status.id, status.status, status.recipient_id, status.timestamp);
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    logger.error('Error handling webhook', { action: 'webhook.receive', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    // Still return 200 to avoid Meta retrying
    return {
      statusCode: 200,
      body: JSON.stringify({ success: false, error: 'Processing error' }),
      headers: getSecurityHeaders(event)
    };
  }
}
