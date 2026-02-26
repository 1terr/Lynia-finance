/**
 * POST /payments/webhook/onemoney
 * Handle OneMoney webhook
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RouteHandler } from '../../../shared/utils/lambda-router';
import { PaymentService } from '../payment-service';
import { OneMoneyProvider, OneMoneyWebhook } from '../onemoney-provider';
import { PaymentEventLogger } from '../payment-event-logger';
import { syncPaymentToFineract } from './fineract-sync';
import { SQSQueues } from '../../../shared/utils/sqs-publisher';
import logger from '../../../shared/utils/logger';

const paymentService = new PaymentService();
const onemoneyProvider = new OneMoneyProvider();
const eventLogger = new PaymentEventLogger();

export const handleOneMoneyWebhook: RouteHandler = async (event, _params, _auth) => {
  try {
    // Verify webhook signature (mandatory -- reject unsigned requests)
    const receivedSignature = event.headers['x-signature'] || event.headers['X-Signature'];
    if (!receivedSignature) {
      logger.warn('OneMoney webhook rejected: missing signature header', { action: 'onemoney.webhook' });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const isValid = onemoneyProvider.verifyWebhookSignature(receivedSignature, event.body || '');
    if (!isValid) {
      logger.warn('OneMoney webhook rejected: invalid signature', { action: 'onemoney.webhook' });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const payload: OneMoneyWebhook = JSON.parse(event.body || '{}');

    const paymentId = payload.merchant_reference;

    eventLogger.logEvent({
      payment_id: paymentId,
      to_status: payload.status === 'SUCCESS' ? 'completed' : payload.status.toLowerCase(),
      event_type: 'webhook_received',
      gateway: 'onemoney',
      provider_transaction_id: payload.transaction_id,
      actor_type: 'webhook',
      actor_id: 'onemoney-webhook',
      provider_response: payload as unknown as Record<string, unknown>,
    }).catch(() => {});

    if (payload.status === 'SUCCESS') {
      await paymentService.checkPaymentStatus(paymentId);
      await paymentService.processPaymentCompletion(paymentId);
      await paymentService.trackCompletedPayment(paymentId, payload.transaction_id);

      // Non-blocking: sync repayment to Fineract core banking
      if (process.env.FINERACT_SECRET_NAME) {
        syncPaymentToFineract(paymentId).catch((err) => {
          logger.error('[fineract-sync] Background repayment sync failed', { action: 'fineract.sync', meta: { error: err instanceof Error ? err.message : String(err) } });
        });
      }

      // Non-blocking: real-time DW sync
      SQSQueues.syncDataWarehouse({
        eventType: 'payment.confirmed',
        entityId: paymentId,
        entityType: 'payment',
      }).catch((err) => {
        logger.error('[dw-sync] Background DW sync failed', { action: 'dw.sync', meta: { error: err instanceof Error ? err.message : String(err) } });
      });
    } else if (payload.status === 'FAILED' || payload.status === 'CANCELLED') {
      await paymentService.checkPaymentStatus(paymentId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    logger.error('Error processing OneMoney webhook', { action: 'onemoney.webhook', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
