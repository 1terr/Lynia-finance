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
    console.error(`[CircuitBreaker] ${name} opened after ${count} failures`);
  },
  onClose: (name) => {
    console.log(`[CircuitBreaker] ${name} recovered`);
  },
});

/**
 * WhatsApp Service Lambda Handler
 * Handles WhatsApp messaging and webhooks
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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
    console.error('Error:', error);
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

    console.log('Message sent successfully:', messageId);

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
    console.error('Error sending message:', error instanceof Error ? error.message : 'Unknown');
    if (axios.isAxiosError(error)) {
      console.error('WhatsApp API error:', error.response?.status);
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

  console.log('Webhook verification request:', { mode });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return {
      statusCode: 200,
      body: challenge!,
      headers: { 'Content-Type': 'text/plain' }
    };
  }

  console.warn('Webhook verification failed');
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
      console.warn('Webhook signature validation skipped: META_APP_SECRET not configured');
      return true;
    }
    console.error('META_APP_SECRET not configured - rejecting webhook');
    return false;
  }

  const signature = event.headers['X-Hub-Signature-256'] || event.headers['x-hub-signature-256'];
  if (!signature) {
    console.error('Missing X-Hub-Signature-256 header');
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
    console.error('Webhook signature mismatch');
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
      console.error('Webhook signature validation failed');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
        headers: getSecurityHeaders(event)
      };
    }

    const webhookEvent: WhatsAppWebhookEvent = JSON.parse(event.body || '{}');
    console.log('WhatsApp webhook received:', { entryCount: webhookEvent.entry?.length });

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
    console.error('Error handling webhook:', error);
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
      console.log(`Image received: ${imageUrl}`);
    }

    console.log(`Incoming message processed: type=${message.type}`);

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
      .from('whatsapp_onboarding_sessions')
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
              .from('whatsapp_onboarding_sessions')
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
    const _customer = await findOrCreateCustomer(phoneNumber, contactName);

    const context: MessageContext = {
      from: phoneNumber,
      message: messageText,
      messageId: message.id,
      timestamp: parseInt(message.timestamp, 10)
    };

    const responseMessage = await routeOnboardingMessage(context, imageUrl);
    await sendTextMessage(phoneNumber, responseMessage);

  } catch (error) {
    console.error('Error processing incoming message:', error);

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
      console.error('Failed to send error message:', sendError);
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
      console.error(`WhatsApp API circuit open, message to ${to.substring(0, 6)}*** queued for retry`);
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
      }).catch(sqsErr => console.error('Failed to enqueue retry:', sqsErr));
      return;
    }

    if (axios.isAxiosError(error)) {
      const errorCode = error.response?.data?.error?.code;
      if (errorCode) {
        const mapped = mapWhatsAppApiError(errorCode);
        console.error(`WhatsApp API error ${errorCode}: action=${mapped.internalAction}`);

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
          }).catch(sqsErr => console.error('Failed to enqueue retry:', sqsErr));
          return;
        }
      }
    }

    console.error('Error sending text message:', error);
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

    if (customer) {
      await db.from('whatsapp_messages').insert({
        customer_id: customer.id,
        ...data
      }).execute();
    }
  } catch (error) {
    console.error('Error storing message:', error);
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
      console.error(`Message delivery failed: ${messageId} to ${recipientId?.substring(0, 6)}***`);
    }

    await db
      .from('whatsapp_messages')
      .update(updateData)
      .eq('whatsapp_message_id', messageId)
      .execute();

    console.log(`Message ${messageId} status: ${status}`);
  } catch (error) {
    console.error('Error updating message status:', error);
  }
}

/**
 * Helper: Find or create customer
 */
async function findOrCreateCustomer(phoneNumber: string, name?: string): Promise<Record<string, unknown> | null> {
  try {
    // Try to find existing customer
    let { data: customer } = await db
      .from('customers')
      .select('*')
      .eq('whatsapp_number', phoneNumber)
      .single()
      .execute();

    if (!customer) {
      // Create new customer record
      const { data: newCustomer, error } = await db
        .from('customers')
        .insert({
          phone_number: phoneNumber,
          whatsapp_number: phoneNumber,
          full_name: name || 'WhatsApp User',
          kyc_status: 'pending',
          status: 'active'
        })
        .select()
        .single()
        .execute();

      if (error) throw error;
      customer = newCustomer;
      console.log('Created new customer:', customer.id);
    }

    return customer;
  } catch (error) {
    console.error('Error finding/creating customer:', error);
    throw error;
  }
}

/**
 * Helper: Get conversation state
 */
async function _getConversation(customerId: string, phoneNumber: string): Promise<Record<string, unknown> | null> {
  try {
    let { data: conversation } = await db
      .from('whatsapp_conversations')
      .select('*')
      .eq('customer_id', customerId)
      .eq('phone_number', phoneNumber)
      .single()
      .execute();

    if (!conversation) {
      // Create new conversation
      const { data: newConv } = await db
        .from('whatsapp_conversations')
        .insert({
          customer_id: customerId,
          phone_number: phoneNumber,
          conversation_state: 'idle'
        })
        .select()
        .single()
        .execute();
      conversation = newConv;
    }

    return conversation;
  } catch (error) {
    console.error('Error getting conversation:', error);
    return null;
  }
}

/**
 * Helper: Update conversation state
 */
async function _updateConversationState(
  customerId: string,
  phoneNumber: string,
  state: string
): Promise<void> {
  try {
    await db
      .from('whatsapp_conversations')
      .update({
        conversation_state: state,
        last_message_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .eq('phone_number', phoneNumber)
      .execute();
  } catch (error) {
    console.error('Error updating conversation state:', error);
  }
}

/**
 * Helper: Get customer's active loan
 */
async function _getCustomerLoan(customerId: string): Promise<Record<string, unknown> | null> {
  try {
    const { data: loan } = await db
      .from('loans')
      .select('*')
      .eq('customer_id', customerId)
      .in('loan_status', ['approved', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    return loan;
  } catch (error) {
    console.error('Error getting customer loan:', error);
    return null;
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
