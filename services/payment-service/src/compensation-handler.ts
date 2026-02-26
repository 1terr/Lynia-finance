/**
 * Payment Compensation Handler
 *
 * Automated handlers for payment failure scenarios:
 * - Hold timeout (provider didn't respond)
 * - Missing webhook (callback never arrived)
 * - Fineract sync failure (accounting system unreachable)
 * - Provider error (retryable vs permanent)
 *
 * Inspired by PH-EE's BPMN error flows, adapted to SQS + Lambda.
 */

import { db } from '../../shared/clients/database';
import logger from '../../shared/utils/logger';
import { EcoCashProvider } from './ecocash-provider';
import { OneMoneyProvider } from './onemoney-provider';
import { OmariProvider } from './omari-provider';
import { InnBucksProvider } from './innbucks-provider';
import { PaymentEventLogger } from './payment-event-logger';
import { PaymentStateMachine, ConcurrentModificationError } from './payment-state-machine';
import { publishMessage, SQSQueues } from '../../shared/utils/sqs-publisher';
import type { PaymentProvider, PaymentGateway } from './payment-provider.interface';

// ===================================================================
// TYPES
// ===================================================================

export type CompensationAction =
  | 'hold_timeout'
  | 'webhook_missing'
  | 'fineract_sync_failed'
  | 'provider_error';

export type CompensationOutcome =
  | { outcome: 'resolved'; newStatus: string }
  | { outcome: 'retry'; delaySeconds: number }
  | { outcome: 'escalate'; reason: string };

export interface CompensationMessage {
  action: CompensationAction;
  paymentId: string;
  gateway: PaymentGateway;
  currentStatus: string;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

const MAX_COMPENSATION_RETRIES = 5;
const COMPENSATION_QUEUE = `${process.env.NODE_ENV || 'development'}-lynia-payment-compensation`;

// ===================================================================
// HANDLER
// ===================================================================

export class CompensationHandler {
  private providers: Map<PaymentGateway, PaymentProvider>;
  private eventLogger: PaymentEventLogger;
  private stateMachine: PaymentStateMachine;

  constructor() {
    this.providers = new Map<PaymentGateway, PaymentProvider>([
      ['ecocash', new EcoCashProvider()],
      ['onemoney', new OneMoneyProvider()],
      ['omari', new OmariProvider()],
      ['innbucks', new InnBucksProvider()],
    ]);
    this.eventLogger = new PaymentEventLogger();
    this.stateMachine = new PaymentStateMachine(this.eventLogger);
  }

  /**
   * Process a compensation message from SQS.
   */
  async handleCompensation(message: CompensationMessage): Promise<CompensationOutcome> {
    logger.info(`[compensation] Processing ${message.action} for payment ${message.paymentId} (retry ${message.retryCount})`, { action: 'compensation.process' });

    let result: CompensationOutcome;

    switch (message.action) {
      case 'hold_timeout':
        result = await this.handleHoldTimeout(message);
        break;
      case 'webhook_missing':
        result = await this.handleWebhookMissing(message);
        break;
      case 'fineract_sync_failed':
        result = await this.handleFineractSyncFailed(message);
        break;
      case 'provider_error':
        result = await this.handleProviderError(message);
        break;
      default:
        result = { outcome: 'escalate', reason: `Unknown compensation action: ${message.action}` };
    }

    // Handle the outcome
    if (result.outcome === 'retry' && message.retryCount < MAX_COMPENSATION_RETRIES) {
      await this.requeueCompensation(message, result.delaySeconds);
    } else if (result.outcome === 'retry') {
      // Max retries exceeded — escalate
      result = { outcome: 'escalate', reason: `Max retries (${MAX_COMPENSATION_RETRIES}) exceeded for ${message.action}` };
    }

    if (result.outcome === 'escalate') {
      await this.escalate(message, result.reason);
    }

    return result;
  }

  /**
   * Handle expired hold: poll provider, resolve or release.
   */
  private async handleHoldTimeout(message: CompensationMessage): Promise<CompensationOutcome> {
    const provider = this.providers.get(message.gateway);
    if (!provider) {
      return { outcome: 'escalate', reason: `Unknown gateway: ${message.gateway}` };
    }

    // Fetch payment to get transaction ID
    const { data: payment } = await db
      .from('payments')
      .select('id, gateway_transaction_id, status')
      .eq('id', message.paymentId)
      .single()
      .execute();

    if (!payment) {
      return { outcome: 'escalate', reason: 'Payment not found' };
    }

    // If already resolved, nothing to do
    if (['completed', 'failed', 'cancelled', 'released'].includes(payment.status)) {
      return { outcome: 'resolved', newStatus: payment.status };
    }

    // Poll provider if we have a transaction ID
    if (payment.gateway_transaction_id) {
      try {
        const status = await provider.checkPaymentStatus(payment.gateway_transaction_id);
        if (status.status === 'completed') {
          await this.stateMachine.transition(payment.id, payment.status, 'processing', {
            gateway: message.gateway,
            actor_type: 'system',
            actor_id: 'compensation-hold-timeout',
          });
          return { outcome: 'resolved', newStatus: 'processing' };
        }
        if (status.status === 'failed' || status.status === 'cancelled') {
          await this.stateMachine.transition(payment.id, payment.status, 'released', {
            gateway: message.gateway,
            release_reason: `Provider reported ${status.status}`,
            actor_type: 'system',
            actor_id: 'compensation-hold-timeout',
          });
          return { outcome: 'resolved', newStatus: 'released' };
        }
      } catch {
        // Provider unreachable — retry
        return { outcome: 'retry', delaySeconds: 120 };
      }
    }

    // No transaction ID or provider says still pending — release the hold
    try {
      await this.stateMachine.transition(payment.id, payment.status, 'released', {
        gateway: message.gateway,
        release_reason: 'Hold timeout — no provider confirmation',
        actor_type: 'system',
        actor_id: 'compensation-hold-timeout',
      });
      return { outcome: 'resolved', newStatus: 'released' };
    } catch (err) {
      if (err instanceof ConcurrentModificationError) {
        return { outcome: 'resolved', newStatus: 'unknown (concurrent)' };
      }
      return { outcome: 'retry', delaySeconds: 60 };
    }
  }

  /**
   * Handle missing webhook: poll provider for final status.
   */
  private async handleWebhookMissing(message: CompensationMessage): Promise<CompensationOutcome> {
    const provider = this.providers.get(message.gateway);
    if (!provider) {
      return { outcome: 'escalate', reason: `Unknown gateway: ${message.gateway}` };
    }

    const { data: payment } = await db
      .from('payments')
      .select('id, gateway_transaction_id, status')
      .eq('id', message.paymentId)
      .single()
      .execute();

    if (!payment || !payment.gateway_transaction_id) {
      return { outcome: 'escalate', reason: 'Payment not found or no transaction ID' };
    }

    if (['completed', 'failed', 'cancelled', 'released'].includes(payment.status)) {
      return { outcome: 'resolved', newStatus: payment.status };
    }

    try {
      const status = await provider.checkPaymentStatus(payment.gateway_transaction_id);
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        // Update payment status directly
        await db.from('payments').update({
          status: status.status,
          completed_at: status.status === 'completed' ? new Date().toISOString() : undefined,
          failed_at: status.status === 'failed' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        }).eq('id', payment.id).execute();

        this.eventLogger.logEvent({
          payment_id: payment.id,
          from_status: payment.status,
          to_status: status.status,
          event_type: 'reconciled',
          gateway: message.gateway,
          actor_type: 'system',
          actor_id: 'compensation-webhook-missing',
        }).catch(() => {});

        return { outcome: 'resolved', newStatus: status.status };
      }
      // Still pending — retry later
      return { outcome: 'retry', delaySeconds: 300 };
    } catch {
      return { outcome: 'retry', delaySeconds: 120 };
    }
  }

  /**
   * Handle Fineract sync failure: delegate to existing retry queue.
   */
  private async handleFineractSyncFailed(message: CompensationMessage): Promise<CompensationOutcome> {
    try {
      await SQSQueues.retryFineractSync({
        entityType: 'payment',
        entityId: message.paymentId,
        operation: 'sync_repayment',
        requestPayload: message.metadata || {},
        retryCount: message.retryCount,
        originalError: message.failureReason,
      });
      return { outcome: 'resolved', newStatus: 'queued_for_fineract_retry' };
    } catch {
      return { outcome: 'retry', delaySeconds: 60 };
    }
  }

  /**
   * Handle provider error: retry if retryable, release if permanent.
   */
  private async handleProviderError(message: CompensationMessage): Promise<CompensationOutcome> {
    // Check if the error is retryable
    const retryablePatterns = ['timeout', 'ETIMEDOUT', 'ECONNREFUSED', 'circuit breaker', '503', '502', '429'];
    const isRetryable = retryablePatterns.some(
      (p) => message.failureReason?.toLowerCase().includes(p.toLowerCase())
    );

    if (isRetryable && message.retryCount < 3) {
      return { outcome: 'retry', delaySeconds: 60 * Math.pow(2, message.retryCount) };
    }

    // Permanent error — release the hold
    const { data: payment } = await db
      .from('payments')
      .select('id, status')
      .eq('id', message.paymentId)
      .single()
      .execute();

    if (payment && payment.status === 'held') {
      try {
        await this.stateMachine.transition(payment.id, 'held', 'released', {
          gateway: message.gateway,
          release_reason: `Provider error (permanent): ${message.failureReason}`,
          actor_type: 'system',
          actor_id: 'compensation-provider-error',
        });
        return { outcome: 'resolved', newStatus: 'released' };
      } catch {
        return { outcome: 'escalate', reason: 'Failed to release hold after provider error' };
      }
    }

    return { outcome: 'escalate', reason: `Non-retryable provider error: ${message.failureReason}` };
  }

  /**
   * Re-queue a compensation message for retry with delay.
   */
  private async requeueCompensation(message: CompensationMessage, delaySeconds: number): Promise<void> {
    await publishMessage({
      queueName: COMPENSATION_QUEUE,
      message: {
        ...message,
        retryCount: message.retryCount + 1,
        timestamp: new Date().toISOString(),
      },
      delaySeconds: Math.min(900, delaySeconds), // SQS max delay is 900s
    });
  }

  /**
   * Escalate an unresolvable compensation to admin.
   */
  private async escalate(message: CompensationMessage, reason: string): Promise<void> {
    logger.error(`[compensation] ESCALATION: payment ${message.paymentId}, action ${message.action}, reason: ${reason}`, { action: 'compensation.escalate' });

    // Log escalation event
    this.eventLogger.logEvent({
      payment_id: message.paymentId,
      to_status: message.currentStatus,
      event_type: 'escalated',
      gateway: message.gateway,
      error_message: reason,
      actor_type: 'system',
      actor_id: 'compensation-escalation',
    }).catch(() => {});

    // Notify admin via notification queue
    try {
      await SQSQueues.sendNotification({
        customerId: 'admin',
        channel: 'email',
        templateName: 'payment_compensation_escalation',
        templateParams: {
          paymentId: message.paymentId,
          action: message.action,
          reason,
          gateway: message.gateway,
          retryCount: String(message.retryCount),
        },
      });
    } catch (err) {
      logger.error('[compensation] Failed to send escalation notification', { action: 'compensation.escalate', meta: { error: err instanceof Error ? err.message : String(err) } });
    }
  }
}

// ===================================================================
// QUEUE HELPER
// ===================================================================

/**
 * Queue a compensation action for a payment.
 */
export async function queueCompensation(params: {
  action: CompensationAction;
  paymentId: string;
  gateway: PaymentGateway;
  currentStatus: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await publishMessage({
    queueName: COMPENSATION_QUEUE,
    message: {
      ...params,
      retryCount: 0,
      timestamp: new Date().toISOString(),
    },
    attributes: { action: params.action },
  });
}
