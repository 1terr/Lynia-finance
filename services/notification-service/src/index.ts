import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { db } from '../../shared/clients/database';
import { processPaymentReminders, getReminderAnalytics, handleReminderOptOut, handleReminderOptIn } from './reminder-scheduler';
import { getSecurityHeaders } from '../../shared/utils/response';

/**
 * Notification Service Lambda Handler
 * Handles multi-channel notifications (SMS, WhatsApp, Email)
 * and scheduled payment reminders
 */
export const handler = async (
  event: APIGatewayProxyEvent | ScheduledEvent
): Promise<APIGatewayProxyResult | void> => {
  try {
    // Handle scheduled event (EventBridge cron for reminders)
    if ('source' in event && event.source === 'aws.events') {
      console.log('Scheduled reminder processing triggered');
      const stats = await processPaymentReminders();
      console.log('Reminder processing complete:', stats);
      return;
    }

    // Handle API Gateway event
    const apiEvent = event as APIGatewayProxyEvent;
    const path = apiEvent.path;
    const method = apiEvent.httpMethod;

    if (path === '/notifications/send' && method === 'POST') {
      return await sendNotification(apiEvent);
    }

    if (path === '/notifications/reminders/process' && method === 'POST') {
      const stats = await processPaymentReminders();
      return { statusCode: 200, body: JSON.stringify({ success: true, stats }), headers: getSecurityHeaders(apiEvent) };
    }

    if (path === '/notifications/reminders/analytics' && method === 'GET') {
      const from = apiEvent.queryStringParameters?.from;
      const to = apiEvent.queryStringParameters?.to;
      const analytics = await getReminderAnalytics(from && to ? { from, to } : undefined);
      return { statusCode: 200, body: JSON.stringify({ success: true, data: analytics }), headers: getSecurityHeaders(apiEvent) };
    }

    if (path === '/notifications/reminders/opt-out' && method === 'POST') {
      const body = JSON.parse(apiEvent.body || '{}');
      await handleReminderOptOut(body.customerId);
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Opted out of reminders' }), headers: getSecurityHeaders(apiEvent) };
    }

    if (path === '/notifications/reminders/opt-in' && method === 'POST') {
      const body = JSON.parse(apiEvent.body || '{}');
      await handleReminderOptIn(body.customerId);
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Opted in to reminders' }), headers: getSecurityHeaders(apiEvent) };
    }

    if (path.startsWith('/notifications/') && method === 'GET') {
      const customerId = apiEvent.pathParameters?.customerId;
      return await getNotificationHistory(customerId!, apiEvent);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: getSecurityHeaders(apiEvent)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders()
    };
  }
};

async function sendNotification(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { customerId, channel, message, templateName, metadata } = body;

  if (!customerId || !channel || !message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: customerId, channel, message' }),
      headers: getSecurityHeaders(event)
    };
  }

  // Get customer phone number
  const { data: customer } = await db
    .from('customers')
    .select('phone_number, first_name')
    .eq('id', customerId)
    .single()
    .execute();

  if (!customer) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Customer not found' }),
      headers: getSecurityHeaders(event)
    };
  }

  // Store notification record
  const { data: notification, error: insertError } = await db
    .from('notifications')
    .insert({
      customer_id: customerId,
      channel,
      message,
      template_name: templateName,
      metadata,
      status: 'pending',
    })
    .select()
    .single()
    .execute();

  if (insertError) {
    console.error('Failed to store notification:', insertError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create notification' }),
      headers: getSecurityHeaders(event)
    };
  }

  // Send via appropriate channel
  try {
    if (channel === 'whatsapp') {
      const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL!;
      const axios = (await import('axios')).default;
      await axios.post(WHATSAPP_API_URL, {
        to: customer.phone_number,
        message,
        templateName,
      });
    }
    // SMS and email channels to be implemented

    await db
      .from('notifications')
      .update({ status: 'sent', sent_at: new Date() })
      .eq('id', notification.id)
      .execute();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, notificationId: notification.id }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    await db
      .from('notifications')
      .update({ status: 'failed' })
      .eq('id', notification.id)
      .execute();

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send notification' }),
      headers: getSecurityHeaders(event)
    };
  }
}

async function getNotificationHistory(customerId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { data: notifications, error } = await db
    .from('notifications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
    .execute();

  if (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch notifications' }),
      headers: getSecurityHeaders(event)
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ customerId, notifications: notifications || [] }),
    headers: getSecurityHeaders(event)
  };
}
