/**
 * WhatsApp Service Lambda Handler
 *
 * Entry point that routes requests to the appropriate module.
 * Business logic has been decomposed into:
 *  - webhook-handler.ts  -- webhook verification and incoming webhook processing
 *  - message-router.ts   -- incoming message routing/dispatching
 *  - message-sender.ts   -- outbound message sending, storage, status tracking
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getSecurityHeaders } from '../../shared/utils/response';
import { logger, setRequestContext } from '../../shared/utils/logger';
import { verifyWebhook, handleWebhook } from './webhook-handler';
import { sendMessage } from './message-sender';

// Re-export all modules for backwards compatibility
export { verifyWebhook, validateWebhookSignature, handleWebhook } from './webhook-handler';
export { processIncomingMessage } from './message-router';
export {
  sendMessage,
  sendTextMessage,
  storeMessage,
  updateMessageStatus,
  sanitizePhoneNumber,
} from './message-sender';

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

    // Health check (unauthenticated, lightweight)
    if (path === '/whatsapp/health' && method === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', service: 'whatsapp-service', timestamp: new Date().toISOString() }),
        headers: { 'Content-Type': 'application/json', ...getSecurityHeaders(event) },
      };
    }

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
