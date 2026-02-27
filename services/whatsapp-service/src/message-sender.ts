/**
 * Message Sender Module
 *
 * Handles outbound message sending via the WhatsApp Cloud API,
 * message storage in database, and status update tracking.
 * Includes circuit breaker pattern for resilience.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';
import type {
  WhatsAppSendMessageRequest,
  WhatsAppSendMessageResponse
} from '../../shared/types';
import {
  mapWhatsAppApiError,
} from './error-handler';
import { CircuitBreaker, CircuitOpenError } from '../../shared/utils/circuit-breaker';
import { getSecurityHeaders } from '../../shared/utils/response';
import { SQSQueues } from '../../shared/utils/sqs-publisher';
import { logger } from '../../shared/utils/logger';
import { db } from '../../shared/clients/database';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

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
 * Send WhatsApp message via Cloud API (API endpoint handler)
 */
export async function sendMessage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
 * Helper: Send text message with circuit breaker and WhatsApp API error handling (T011)
 */
export async function sendTextMessage(to: string, message: string): Promise<void> {
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
export async function storeMessage(data: {
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
 * Tracks message lifecycle: sent -> delivered -> read -> failed
 * Logs failed deliveries for retry processing and monitoring
 */
export async function updateMessageStatus(
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
 * Helper: Sanitize phone number to WhatsApp format
 */
export function sanitizePhoneNumber(phone: string): string {
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
