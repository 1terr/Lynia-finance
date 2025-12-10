import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Notification Service Lambda Handler
 * Handles multi-channel notifications (SMS, WhatsApp, Email)
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));

    const path = event.path;
    const method = event.httpMethod;

    if (path === '/notifications/send' && method === 'POST') {
      return await sendNotification(event);
    } else if (path.startsWith('/notifications/') && method === 'GET') {
      const customerId = event.pathParameters?.customerId;
      return await getNotificationHistory(customerId!);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  }
};

async function sendNotification(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { customerId, channel, message } = body;

  // TODO: Send notification via specified channel (SMS, WhatsApp, Email)
  console.log(`Sending ${channel} notification to customer ${customerId}`);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, notificationId: 'notif_123' }),
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  };
}

async function getNotificationHistory(customerId: string): Promise<APIGatewayProxyResult> {
  // TODO: Fetch notification history from database
  return {
    statusCode: 200,
    body: JSON.stringify({ customerId, notifications: [] }),
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  };
}
