/**
 * POST /payments/webhook/innbucks
 * Handle InnBucks webhook
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { errorResponse } from '../../../shared/utils/response';
import { PaymentService } from '../payment-service';
import { InnBucksProvider, InnBucksWebhook } from '../innbucks-provider';
import { PaymentEventLogger } from '../payment-event-logger';
import { syncPaymentToFineract } from './fineract-sync';
import { resolveDepositByNationalId } from '../deposit-resolver';
import { SQSQueues } from '../../../shared/utils/sqs-publisher';
import logger from '../../../shared/utils/logger';

const paymentService = new PaymentService();
const innbucksProvider = new InnBucksProvider();
const eventLogger = new PaymentEventLogger();

export const handleInnBucksWebhook: RouteHandler = async (event, _params, _auth) => {
  try {
    // Verify webhook signature
    const receivedSignature = event.headers['x-signature'] || event.headers['X-Signature'];
    if (receivedSignature) {
      const isValid = innbucksProvider.verifyWebhookSignature(receivedSignature, event.body || '');
      if (!isValid) {
        logger.warn('InnBucks webhook rejected: invalid signature', { action: 'innbucks.webhook' });
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid signature' }),
          headers: { 'Content-Type': 'application/json' }
        };
      }
    }

    const payload: InnBucksWebhook = JSON.parse(event.body || '{}');

    let paymentId = payload.merchant_reference;

    eventLogger.logEvent({
      payment_id: paymentId,
      to_status: payload.status === 'SUCCESS' ? 'completed' : payload.status.toLowerCase(),
      event_type: 'webhook_received',
      gateway: 'innbucks',
      provider_transaction_id: payload.transaction_id,
      actor_type: 'webhook',
      actor_id: 'innbucks-webhook',
      provider_response: payload as unknown as Record<string, unknown>,
    }).catch(err => logger.error('Failed to log InnBucks webhook event', { error: err instanceof Error ? err.message : String(err), action: 'innbucks.webhook.event_log' }));

    if (payload.status === 'SUCCESS') {
      let resolved = false;
      try {
        await paymentService.checkPaymentStatus(paymentId);
        resolved = true;
      } catch {
        const deposit = await resolveDepositByNationalId(
          paymentId, payload.amount, payload.currency || 'USD',
          payload.transaction_id, 'innbucks'
        );
        if (deposit?.resolved && deposit.paymentId) {
          paymentId = deposit.paymentId;
          resolved = true;
        }
      }

      if (resolved) {
        await paymentService.processPaymentCompletion(paymentId);
        await paymentService.trackCompletedPayment(paymentId, payload.transaction_id);

        if (process.env.FINERACT_SECRET_NAME) {
          syncPaymentToFineract(paymentId).catch((err: Error) => {
            logger.error('[fineract-sync] Background sync failed', { action: 'fineract.sync', meta: { error: err.message } });
          });
        }

        SQSQueues.syncDataWarehouse({
          eventType: 'payment.confirmed',
          entityId: paymentId,
          entityType: 'payment',
        }).catch((err: Error) => {
          logger.error('[dw-sync] Background DW sync failed', { action: 'dw.sync', meta: { error: err.message } });
        });
      } else {
        logger.warn('InnBucks webhook: could not resolve payment', {
          action: 'innbucks.webhook',
          meta: { merchantReference: payload.merchant_reference },
        });
      }
    } else if (payload.status === 'FAILED' || payload.status === 'CANCELLED') {
      try {
        await paymentService.checkPaymentStatus(paymentId);
      } catch {
        // Ignore — may be unresolved national ID reference
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    const requestId = event.requestContext?.requestId || 'unknown';
    logger.error('Error processing InnBucks webhook', { action: 'innbucks.webhook', status: 'failed', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return errorResponse('Webhook processing failed', 500, { requestId }, event);
  }
};
