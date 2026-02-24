import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHmac } from 'crypto';
import { db } from '../../shared/clients/database';
import axios from 'axios';
import type {
  WhatsAppWebhookEvent,
  WhatsAppSendMessageRequest,
  WhatsAppSendMessageResponse
} from '../../shared/types';
import { routeOnboardingMessage, type MessageContext } from './onboarding';
import { routeLoanCommand } from './loan-commands';
import {
  sanitizeInput,
  getSuspiciousInputResponse,
  detectRapidMessages,
  getRapidMessageResponse,
  validateMessageLength,
  checkInappropriateLanguage,
  handleUnexpectedMessageType,
  getExpectedInputType,
  detectGlobalCommand,
  detectOutOfContextCommand,
  handleGlobalCommandResponse,
  handleOutOfContextResponse,
  trackError,
  trackSecurityEvent,
  mapWhatsAppApiError,
} from './error-handler';
import { CircuitBreaker, CircuitOpenError } from './utils/circuit-breaker';
import { getSecurityHeaders } from '../../shared/utils/response';
import { SQSQueues } from '../../shared/utils/sqs-publisher';
import { logger, setRequestContext } from '../../shared/utils/logger';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN!;
const META_APP_SECRET = process.env.META_APP_SECRET;

/** Circuit breaker for WhatsApp Cloud API calls */
const whatsappCircuitBreaker = new CircuitBreaker({
  name: 'whatsapp-cloud-api',
  failureThreshold: 5,
  resetTimeout: 60000,
  onOpen: (name, count) => {
    logger.error(`CircuitBreaker ${name} opened after ${count} failures`, { action: 'circuit_breaker.open' });
  },
  onClose: (name) => {
    logger.info(`CircuitBreaker ${name} recovered`, { action: 'circuit_breaker.close' });
  },
});

/**
 * WhatsApp Service Lambda Handler
 * Handles WhatsApp messaging and webhooks
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  setRequestContext(
    event.headers['x-request-id'] || event.requestContext?.requestId
  );

  try {
    const path = event.path;
    const method = event.httpMethod;

    // Route handling
    if (path === '/whatsapp/send' && method === 'POST') {
      return await sendMessage(event);
    } else if (path === '/whatsapp/webhook' && method === 'GET') {
      return verifyWebhook(event);
    } else if (path === '/whatsapp/webhook' && method === 'POST') {
      return await handleWebhook(event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    logger.error('Unhandled handler error', { action: 'handler.error', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};

/**
 * Send WhatsApp message via Cloud API
 */
async function sendMessage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { to, message, templateName, templateParams } = body;

    let messagePayload: WhatsAppSendMessageRequest;

    if (templateName) {
      // Send template message
      messagePayload = {
        messaging_product: 'whatsapp',
        to: sanitizePhoneNumber(to),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: templateParams ? [
            {
              type: 'body',
              parameters: Object.values(templateParams).map((value) => ({
                type: 'text',
                text: String(value)
              }))
            }
          ] : undefined
        }
      };
    } else {
      // Send text message
      messagePayload = {
        messaging_product: 'whatsapp',
        to: sanitizePhoneNumber(to),
        type: 'text',
        text: { body: message }
      };
    }

    const response = await axios.post<WhatsAppSendMessageResponse>(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Store message in database
    const messageId = response.data.messages[0].id;
    await storeMessage({
      phone_number: to,
      message_type: templateName ? 'template' : 'text',
      direction: 'outbound',
      content: message || `Template: ${templateName}`,
      whatsapp_message_id: messageId,
      template_name: templateName,
      status: 'sent'
    });

    logger.info('Message sent successfully', { action: 'message.send', meta: { messageId } });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        messageId,
        waId: response.data.contacts[0].wa_id
      }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    logger.error('Error sending message', { action: 'message.send', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    if (axios.isAxiosError(error)) {
      logger.error('WhatsApp API error', { action: 'message.send', meta: { statusCode: error.response?.status } });
      return {
        statusCode: error.response?.status || 500,
        body: JSON.stringify({
          error: 'Failed to send WhatsApp message'
        }),
        headers: getSecurityHeaders(event)
      };
    }
    throw error;
  }
}

/**
 * Verify webhook - called by Meta when setting up webhook
 */
function verifyWebhook(event: APIGatewayProxyEvent): APIGatewayProxyResult {
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
function validateWebhookSignature(event: APIGatewayProxyEvent): boolean {
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
async function handleWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

/**
 * Process incoming message from customer
 *
 * Applies T011 error handling layers in order:
 * 1. Rapid message detection
 * 2. Input sanitization (XSS/SQL injection)
 * 3. Message length validation
 * 4. Inappropriate language check
 * 5. Unexpected message type handling
 * 6. Global command detection (HELP, CANCEL, BACK, etc.)
 * 7. Out-of-context loan command detection
 * 8. Onboarding flow routing
 */
async function processIncomingMessage(
  message: NonNullable<WhatsAppWebhookEvent['entry'][number]['changes'][number]['value']['messages']>[number],
  contactName?: string
): Promise<void> {
  const phoneNumber = message.from;

  try {
    // Deduplication: check if this message ID was already processed
    // Meta may deliver the same webhook multiple times (at-least-once delivery)
    const { data: existingMsg } = await db
      .from('whatsapp_messages')
      .select('id')
      .eq('whatsapp_message_id', message.id)
      .single()
      .execute();

    if (existingMsg) {
      logger.info('Duplicate webhook message, skipping', { action: 'webhook.dedup', meta: { messageId: message.id } });
      return;
    }

    let messageText = '';
    let imageUrl: string | undefined;

    // Extract message text based on type
    if (message.type === 'text' && message.text) {
      messageText = message.text.body;
    } else if (message.type === 'interactive' && message.interactive) {
      if (message.interactive.button_reply) {
        messageText = message.interactive.button_reply.title;
      } else if (message.interactive.list_reply) {
        messageText = message.interactive.list_reply.title;
      }
    } else if (message.type === 'image' && message.image) {
      messageText = '[Image received]';
      imageUrl = message.image.id;
      logger.info('Image received', { action: 'message.receive', meta: { mediaId: imageUrl } });
    }

    logger.info('Incoming message processed', { action: 'message.receive', meta: { type: message.type } });

    // Store incoming message
    await storeMessage({
      phone_number: phoneNumber,
      message_type: message.type,
      direction: 'inbound',
      content: messageText,
      whatsapp_message_id: message.id,
      status: 'delivered'
    });

    // --- T011 Error Handling Layers ---

    // 1. Rapid message detection
    if (detectRapidMessages(phoneNumber)) {
      await sendTextMessage(phoneNumber, getRapidMessageResponse());
      return;
    }

    // 2. Input sanitization (skip for non-text)
    if (messageText && messageText !== '[Image received]') {
      const { safe, sanitized } = sanitizeInput(messageText);
      if (!safe) {
        await trackSecurityEvent(phoneNumber, 'suspicious_input', {
          original_input: messageText.substring(0, 100),
        });
        await sendTextMessage(phoneNumber, getSuspiciousInputResponse());
        return;
      }
      messageText = sanitized;
    }

    // 3. Message length validation
    if (messageText.length > 0) {
      const lengthCheck = validateMessageLength(messageText);
      if (!lengthCheck.valid && lengthCheck.userMessage) {
        await sendTextMessage(phoneNumber, lengthCheck.userMessage);
        return;
      }
    }

    // 4. Inappropriate language check
    if (messageText.length > 0) {
      const inappropriateMsg = checkInappropriateLanguage(messageText);
      if (inappropriateMsg) {
        await trackError(phoneNumber, {
          category: 'security',
          severity: 'low',
          code: 'INAPPROPRIATE_LANGUAGE',
          userMessage: inappropriateMsg,
          internalMessage: 'Inappropriate language detected',
        });
        await sendTextMessage(phoneNumber, inappropriateMsg);
        return;
      }
    }

    // 5. Unexpected message type handling
    // Get current conversation state to determine expected input
    const { data: session } = await db
      .from('whatsapp_sessions')
      .select('current_state')
      .eq('phone_number', phoneNumber)
      .single()
      .execute();

    const currentState = session?.current_state || 'welcome';
    const expectedType = getExpectedInputType(currentState);
    const typeError = handleUnexpectedMessageType(message.type, expectedType, currentState);
    if (typeError) {
      await sendTextMessage(phoneNumber, typeError);
      return;
    }

    // 6. Global command detection
    if (messageText.length > 0) {
      const globalCmd = detectGlobalCommand(messageText);
      if (globalCmd) {
        const response = handleGlobalCommandResponse(globalCmd);
        if (response) {
          if (globalCmd === 'cancel') {
            // Save progress and reset state
            await db
              .from('whatsapp_sessions')
              .update({ current_state: 'welcome', last_activity_at: new Date() })
              .eq('phone_number', phoneNumber)
              .execute();
          }
          await sendTextMessage(phoneNumber, response);
          return;
        }
        // 'back' and 'continue' fall through to onboarding router
      }
    }

    // 7. For completed users, route loan commands
    if (messageText.length > 0 && currentState === 'completed') {
      const loanResponse = await routeLoanCommand(phoneNumber, messageText);
      if (loanResponse) {
        await sendTextMessage(phoneNumber, loanResponse);
        return;
      }
    }

    // 7b. Out-of-context loan command detection (for non-completed users)
    if (messageText.length > 0 && currentState !== 'completed') {
      const loanCmd = detectOutOfContextCommand(messageText);
      if (loanCmd) {
        await sendTextMessage(phoneNumber, handleOutOfContextResponse(loanCmd));
        return;
      }
    }

    // 8. Find or create customer and route to onboarding flow
    const customer = await findOrCreateCustomer(phoneNumber, contactName);

    // Store customer_id in session so downstream code can reference it
    if (customer?.id) {
      await db.from('whatsapp_sessions')
        .update({ customer_id: customer.id })
        .eq('phone_number', phoneNumber)
        .execute();
    }

    const context: MessageContext = {
      from: phoneNumber,
      message: messageText,
      messageId: message.id,
      timestamp: parseInt(message.timestamp, 10)
    };

    const responseMessage = await routeOnboardingMessage(context, imageUrl);
    await sendTextMessage(phoneNumber, responseMessage);

  } catch (error) {
    logger.error('Error processing incoming message', { action: 'message.process', meta: { error: error instanceof Error ? error.message : 'Unknown' } });

    await trackError(phoneNumber, {
      category: 'system',
      severity: 'high',
      code: 'PROCESSING_ERROR',
      userMessage: '',
      internalMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    try {
      await sendTextMessage(
        phoneNumber,
        'Something went wrong, but your progress is saved. Reply *CONTINUE* to pick up where you left off.\n\nReference: SYS-' + Date.now()
      );
    } catch (sendError) {
      logger.error('Failed to send error message', { action: 'message.send', meta: { error: sendError instanceof Error ? sendError.message : 'Unknown' } });
    }
  }
}

// REMOVED: Old routeMessage function - replaced by onboarding flow module

/**
 * Helper: Send text message with circuit breaker and WhatsApp API error handling (T011)
 */
async function sendTextMessage(to: string, message: string): Promise<void> {
  try {
    const payload: WhatsAppSendMessageRequest = {
      messaging_product: 'whatsapp',
      to: sanitizePhoneNumber(to),
      type: 'text',
      text: { body: message }
    };

    const response = await whatsappCircuitBreaker.execute(() =>
      axios.post<WhatsAppSendMessageResponse>(
        `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      )
    );

    await storeMessage({
      phone_number: to,
      message_type: 'text',
      direction: 'outbound',
      content: message,
      whatsapp_message_id: response.data.messages[0].id,
      status: 'sent'
    });
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      logger.error('WhatsApp API circuit open, message queued for retry', { action: 'message.send' });
      await storeMessage({
        phone_number: to,
        message_type: 'text',
        direction: 'outbound',
        content: message,
        status: 'queued'
      });
      // Enqueue for retry via SQS
      await SQSQueues.retryWhatsAppMessage({
        phoneNumber: to,
        messageContent: message,
        messageType: 'text',
        retryCount: 0,
        originalError: 'circuit_open',
      }).catch(sqsErr => logger.error('Failed to enqueue retry', { action: 'sqs.enqueue', meta: { error: sqsErr instanceof Error ? sqsErr.message : 'Unknown' } }));
      return;
    }

    if (axios.isAxiosError(error)) {
      const errorCode = error.response?.data?.error?.code;
      if (errorCode) {
        const mapped = mapWhatsAppApiError(errorCode);
        logger.error('WhatsApp API error', { action: 'message.send', meta: { errorCode, internalAction: mapped.internalAction } });

        if (mapped.internalAction === 'queue') {
          // Rate limited - enqueue for retry via SQS
          await storeMessage({
            phone_number: to,
            message_type: 'text',
            direction: 'outbound',
            content: message,
            status: 'queued'
          });
          await SQSQueues.retryWhatsAppMessage({
            phoneNumber: to,
            messageContent: message,
            messageType: 'text',
            retryCount: 0,
            originalError: `whatsapp_api_${errorCode}`,
          }).catch(sqsErr => logger.error('Failed to enqueue retry', { action: 'sqs.enqueue', meta: { error: sqsErr instanceof Error ? sqsErr.message : 'Unknown' } }));
          return;
        }
      }
    }

    logger.error('Error sending text message', { action: 'message.send', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
  }
}

/**
 * Helper: Store message in database
 */
async function storeMessage(data: {
  phone_number: string;
  message_type: string;
  direction: 'inbound' | 'outbound';
  content: string;
  whatsapp_message_id?: string;
  template_name?: string;
  status: string;
}): Promise<void> {
  try {
    // Find customer by phone number
    const { data: customer } = await db
      .from('customers')
      .select('id')
      .eq('whatsapp_number', data.phone_number)
      .single()
      .execute();

    // Populate both message_id (original schema) and whatsapp_message_id (new column)
    // for backward compatibility with existing queries
    const insertData: Record<string, unknown> = {
      ...data,
      customer_id: customer?.id || null,
      message_id: data.whatsapp_message_id,
    };

    await db.from('whatsapp_messages').insert(insertData).execute();
  } catch (error) {
    logger.error('Error storing message', { action: 'message.store', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
  }
}

/**
 * Helper: Update message status from delivery/read receipts
 *
 * Tracks message lifecycle: sent → delivered → read → failed
 * Logs failed deliveries for retry processing and monitoring
 */
async function updateMessageStatus(
  messageId: string,
  status: string,
  recipientId?: string,
  timestamp?: string
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = { status };

    if (status === 'delivered') {
      updateData.delivered_at = timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString();
    } else if (status === 'read') {
      updateData.read_at = timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString();
    } else if (status === 'failed') {
      updateData.failed_at = new Date().toISOString();
      logger.error('Message delivery failed', { action: 'message.status', meta: { messageId } });
    }

    await db
      .from('whatsapp_messages')
      .update(updateData)
      .eq('whatsapp_message_id', messageId)
      .execute();

    logger.info('Message status updated', { action: 'message.status', meta: { messageId, status } });
  } catch (error) {
    logger.error('Error updating message status', { action: 'message.status', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
  }
}

/**
 * Helper: Find or create customer
 */
async function findOrCreateCustomer(phoneNumber: string, name?: string): Promise<Record<string, unknown> | null> {
  try {
    // Try to find existing customer by whatsapp_number or phone_number
    let { data: customer } = await db
      .from('customers')
      .select('*')
      .eq('whatsapp_number', phoneNumber)
      .single()
      .execute();

    if (!customer) {
      // Also try phone_number for customers created before whatsapp_number column
      const { data: phoneCustomer } = await db
        .from('customers')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()
        .execute();
      customer = phoneCustomer;

      if (customer && !customer.whatsapp_number) {
        // Backfill whatsapp_number for existing customer
        await db.from('customers')
          .update({ whatsapp_number: phoneNumber })
          .eq('id', customer.id)
          .execute();
      }
    }

    if (!customer) {
      // Create new customer record - split name into first_name/last_name
      const nameParts = (name || 'WhatsApp User').trim().split(/\s+/);
      const firstName = nameParts[0] || 'WhatsApp';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      const { data: newCustomer, error } = await db
        .from('customers')
        .insert({
          phone_number: phoneNumber,
          whatsapp_number: phoneNumber,
          first_name: firstName,
          last_name: lastName,
          kyc_status: 'pending',
          onboarding_status: 'in_progress'
        })
        .select()
        .single()
        .execute();

      if (error) throw error;
      customer = newCustomer;
      logger.info('Created new customer', { action: 'customer.create', meta: { customerId: customer.id } });
    }

    return customer;
  } catch (error) {
    logger.error('Error finding/creating customer', { action: 'customer.lookup', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    throw error;
  }
}

/**
 * Helper: Sanitize phone number to WhatsApp format
 */
function sanitizePhoneNumber(phone: string): string {
  let sanitized = phone.replace(/[\s\-()]/g, '');

  if (sanitized.startsWith('0')) {
    sanitized = '263' + sanitized.substring(1);
  } else if (sanitized.startsWith('+')) {
    sanitized = sanitized.substring(1);
  } else if (!sanitized.startsWith('263')) {
    sanitized = '263' + sanitized;
  }

  return sanitized;
}
