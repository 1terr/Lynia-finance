import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import type {
  WhatsAppWebhookEvent,
  WhatsAppSendMessageRequest,
  WhatsAppSendMessageResponse
} from '../../shared/types';
import { routeOnboardingMessage, type MessageContext } from './onboarding';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'lynia_webhook_2025';

/**
 * WhatsApp Service Lambda Handler
 * Handles WhatsApp messaging and webhooks
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  } catch (error) {
    console.error('Error sending message:', error);
    if (axios.isAxiosError(error)) {
      console.error('WhatsApp API error:', error.response?.data);
      return {
        statusCode: error.response?.status || 500,
        body: JSON.stringify({
          error: 'Failed to send WhatsApp message',
          details: error.response?.data
        }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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

  console.log('Webhook verification request:', { mode, token, challenge });

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
 * Handle incoming webhook from WhatsApp
 */
async function handleWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const webhookEvent: WhatsAppWebhookEvent = JSON.parse(event.body || '{}');
    console.log('WhatsApp webhook received:', JSON.stringify(webhookEvent, null, 2));

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

        // Handle message status updates
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            await updateMessageStatus(status.id, status.status);
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('Error handling webhook:', error);
    // Still return 200 to avoid Meta retrying
    return {
      statusCode: 200,
      body: JSON.stringify({ success: false, error: 'Processing error' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

/**
 * Process incoming message from customer
 */
async function processIncomingMessage(
  message: WhatsAppWebhookEvent['entry'][0]['changes'][0]['value']['messages'][0],
  contactName?: string
): Promise<void> {
  try {
    const phoneNumber = message.from;
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
      // Handle image upload (for KYC)
      messageText = '[Image received]';
      imageUrl = message.image.id; // Store image ID for later download
      console.log(`Image received: ${imageUrl}`);
    }

    console.log(`Message from ${phoneNumber} (${contactName}): ${messageText}`);

    // Store incoming message
    await storeMessage({
      phone_number: phoneNumber,
      message_type: message.type,
      direction: 'inbound',
      content: messageText,
      whatsapp_message_id: message.id,
      status: 'delivered'
    });

    // Find or create customer
    const _customer = await findOrCreateCustomer(phoneNumber, contactName);

    // Create message context for onboarding flow
    const context: MessageContext = {
      from: phoneNumber,
      message: messageText,
      messageId: message.id,
      timestamp: message.timestamp
    };

    // Route to onboarding flow
    const responseMessage = await routeOnboardingMessage(context, imageUrl);

    // Send response back to customer
    await sendTextMessage(phoneNumber, responseMessage);

  } catch (error) {
    console.error('Error processing incoming message:', error);
    // Send error message to customer
    try {
      await sendTextMessage(
        message.from,
        '⚠️ Technical error. Please try again or contact support@lynia.finance'
      );
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  }
}

// REMOVED: Old routeMessage function - replaced by onboarding flow module

/**
 * Helper: Send text message
 */
async function sendTextMessage(to: string, message: string): Promise<void> {
  try {
    const payload: WhatsAppSendMessageRequest = {
      messaging_product: 'whatsapp',
      to: sanitizePhoneNumber(to),
      type: 'text',
      text: { body: message }
    };

    const response = await axios.post<WhatsAppSendMessageResponse>(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
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
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('whatsapp_number', data.phone_number)
      .single();

    if (customer) {
      await supabase.from('whatsapp_messages').insert({
        customer_id: customer.id,
        ...data
      });
    }
  } catch (error) {
    console.error('Error storing message:', error);
  }
}

/**
 * Helper: Update message status
 */
async function updateMessageStatus(messageId: string, status: string): Promise<void> {
  try {
    await supabase
      .from('whatsapp_messages')
      .update({ status })
      .eq('whatsapp_message_id', messageId);
    console.log(`Updated message ${messageId} status to ${status}`);
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
    let { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('whatsapp_number', phoneNumber)
      .single();

    if (!customer) {
      // Create new customer record
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          phone_number: phoneNumber,
          whatsapp_number: phoneNumber,
          full_name: name || 'WhatsApp User',
          kyc_status: 'pending',
          status: 'active'
        })
        .select()
        .single();

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
    let { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('customer_id', customerId)
      .eq('phone_number', phoneNumber)
      .single();

    if (!conversation) {
      // Create new conversation
      const { data: newConv } = await supabase
        .from('whatsapp_conversations')
        .insert({
          customer_id: customerId,
          phone_number: phoneNumber,
          conversation_state: 'idle'
        })
        .select()
        .single();
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
    await supabase
      .from('whatsapp_conversations')
      .update({
        conversation_state: state,
        last_message_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .eq('phone_number', phoneNumber);
  } catch (error) {
    console.error('Error updating conversation state:', error);
  }
}

/**
 * Helper: Get customer's active loan
 */
async function _getCustomerLoan(customerId: string): Promise<Record<string, unknown> | null> {
  try {
    const { data: loan } = await supabase
      .from('loans')
      .select('*')
      .eq('customer_id', customerId)
      .in('loan_status', ['approved', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

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
