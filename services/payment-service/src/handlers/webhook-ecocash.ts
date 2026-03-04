/**
 * POST /payments/webhook/ecocash
 * Handle EcoCash webhook
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { PaymentService } from '../payment-service';
import { EcoCashProvider, EcoCashWebhook } from '../ecocash-provider';
import { PaymentEventLogger } from '../payment-event-logger';
import { syncPaymentToFineract } from './fineract-sync';
import { resolveDepositByNationalId } from '../deposit-resolver';
import { SQSQueues } from '../../../shared/utils/sqs-publisher';
import logger from '../../../shared/utils/logger';

const paymentService = new PaymentService();
const ecocashProvider = new EcoCashProvider();
const eventLogger = new PaymentEventLogger();

export const handleEcoCashWebhook: RouteHandler = async (event, _params, _auth) => {
  try {
    // Verify webhook signature (mandatory -- reject unsigned requests)
    const receivedSignature = event.headers['x-signature'] || event.headers['X-Signature'];
    if (!receivedSignature) {
      logger.warn('EcoCash webhook rejected: missing signature header', { action: 'ecocash.webhook' });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const isValid = ecocashProvider.verifyWebhookSignature(receivedSignature, event.body || '');
    if (!isValid) {
      logger.warn('EcoCash webhook rejected: invalid signature', { action: 'ecocash.webhook' });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const payload: EcoCashWebhook = JSON.parse(event.body || '{}');

    let paymentId = payload.merchant_reference;

    // Log webhook receipt
    eventLogger.logEvent({
      payment_id: paymentId,
      to_status: payload.status === 'SUCCESS' ? 'completed' : payload.status.toLowerCase(),
      event_type: 'webhook_received',
      gateway: 'ecocash',
      provider_transaction_id: payload.transaction_id,
      actor_type: 'webhook',
      actor_id: 'ecocash-webhook',
      provider_response: payload as unknown as Record<string, unknown>,
    }).catch(() => {});

    if (payload.status === 'SUCCESS') {
      // Try normal flow first (pre-initiated payment with our payment_id)
      let resolved = false;
      try {
        await paymentService.checkPaymentStatus(paymentId);
        resolved = true;
      } catch {
        // Payment not found by ID — try resolving as national ID deposit
        const deposit = await resolveDepositByNationalId(
          paymentId, payload.amount, payload.currency || 'USD',
          payload.transaction_id, 'ecocash'
        );
        if (deposit?.resolved && deposit.paymentId) {
          paymentId = deposit.paymentId;
          resolved = true;
        }
      }

      if (resolved) {
        await paymentService.processPaymentCompletion(paymentId);
        await paymentService.trackCompletedPayment(paymentId, payload.transaction_id);

        // Non-blocking: sync to Fineract core banking
        if (process.env.FINERACT_SECRET_NAME) {
          syncPaymentToFineract(paymentId).catch((err: Error) => {
            logger.error('[fineract-sync] Background sync failed', { action: 'fineract.sync', meta: { error: err.message } });
          });
        }

        // Non-blocking: real-time DW sync
        SQSQueues.syncDataWarehouse({
          eventType: 'payment.confirmed',
          entityId: paymentId,
          entityType: 'payment',
        }).catch((err: Error) => {
          logger.error('[dw-sync] Background DW sync failed', { action: 'dw.sync', meta: { error: err.message } });
        });
      } else {
        logger.warn('EcoCash webhook: could not resolve payment', {
          action: 'ecocash.webhook',
          meta: { merchantReference: payload.merchant_reference },
        });
      }
    } else if (payload.status === 'FAILED' || payload.status === 'CANCELLED') {
      try {
        await paymentService.checkPaymentStatus(paymentId);
      } catch {
        // Ignore — may be an unresolved national ID reference for a failed payment
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    logger.error('Error processing EcoCash webhook', { action: 'ecocash.webhook', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
