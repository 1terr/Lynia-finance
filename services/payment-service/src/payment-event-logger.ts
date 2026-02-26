/**
 * Payment Event Logger
 *
 * Structured audit trail for every payment state transition.
 * Non-blocking: errors are caught and logged, never propagated to callers.
 *
 * Inspired by PH-EE's Kafka event stream, adapted to PostgreSQL + Lambda.
 */

import { query, queryOne } from '../../shared/clients/database';
import logger from '../../shared/utils/logger';

// ===================================================================
// TYPES
// ===================================================================

export type PaymentEventType =
  | 'initiated'
  | 'held'
  | 'provider_submitted'
  | 'webhook_received'
  | 'completed'
  | 'failed'
  | 'released'
  | 'timeout'
  | 'reconciled'
  | 'escalated';

export type ActorType = 'system' | 'webhook' | 'admin' | 'reconciliation';

export interface PaymentEvent {
  payment_id: string;
  loan_id?: string;
  customer_id?: string;
  from_status?: string;
  to_status: string;
  event_type: PaymentEventType;
  gateway?: string;
  provider_transaction_id?: string;
  provider_response?: Record<string, unknown>;
  actor_type?: ActorType;
  actor_id?: string;
  error_code?: string;
  error_message?: string;
  request_id?: string;
  idempotency_key?: string;
}

interface StoredPaymentEvent extends PaymentEvent {
  id: string;
  duration_ms?: number;
  created_at: string;
}

// ===================================================================
// VALID STATE TRANSITIONS
// ===================================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  '': ['pending'],                                               // Initial creation
  'pending': ['held', 'processing', 'failed', 'cancelled'],      // Direct or via hold
  'held': ['processing', 'released', 'failed'],                  // After hold
  'processing': ['completed', 'failed', 'cancelled'],            // Awaiting provider
  'completed': [],                                               // Terminal
  'failed': [],                                                  // Terminal
  'cancelled': [],                                               // Terminal
  'released': [],                                                // Terminal (hold released)
};

// ===================================================================
// LOGGER CLASS
// ===================================================================

export class PaymentEventLogger {
  /**
   * Log a payment state transition event.
   * Non-blocking: errors are caught and logged to console, never thrown.
   */
  async logEvent(event: PaymentEvent): Promise<void> {
    try {
      // Validate transition if from_status is provided
      if (event.from_status !== undefined) {
        const allowed = VALID_TRANSITIONS[event.from_status || ''] || [];
        if (allowed.length > 0 && !allowed.includes(event.to_status)) {
          logger.warn(
            `[payment-events] Invalid transition: ${event.from_status || '(none)'} -> ${event.to_status} ` +
            `for payment ${event.payment_id}. Logging anyway for audit.`,
            { action: 'payment_event.validate' }
          );
        }
      }

      // Compute duration from previous event
      const durationMs = await this.computeDuration(event.payment_id);

      const sql = `
        INSERT INTO payment_events (
          payment_id, loan_id, customer_id,
          from_status, to_status, event_type,
          gateway, provider_transaction_id, provider_response,
          actor_type, actor_id,
          error_code, error_message,
          duration_ms, request_id, idempotency_key
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          $10, $11,
          $12, $13,
          $14, $15, $16
        )
      `;

      await query(sql, [
        event.payment_id,
        event.loan_id || null,
        event.customer_id || null,
        event.from_status || null,
        event.to_status,
        event.event_type,
        event.gateway || null,
        event.provider_transaction_id || null,
        event.provider_response ? JSON.stringify(event.provider_response) : null,
        event.actor_type || 'system',
        event.actor_id || null,
        event.error_code || null,
        event.error_message || null,
        durationMs,
        event.request_id || null,
        event.idempotency_key || null,
      ]);
    } catch (error) {
      // Never propagate — audit logging must not break payment flow
      logger.error('[payment-events] Failed to log event', { action: 'payment_event.log', meta: { error: error instanceof Error ? error.message : String(error), paymentId: event.payment_id } });
    }
  }

  /**
   * Get full event history for a payment, ordered chronologically.
   */
  async getPaymentHistory(paymentId: string): Promise<StoredPaymentEvent[]> {
    const { data, error } = await query<StoredPaymentEvent>(
      'SELECT * FROM payment_events WHERE payment_id = $1 ORDER BY created_at ASC',
      [paymentId]
    );
    if (error) {
      logger.error('[payment-events] Failed to get payment history', { action: 'payment_event.history', meta: { error: error instanceof Error ? error.message : String(error) } });
      return [];
    }
    return data;
  }

  /**
   * Find payments stuck in a non-terminal state older than threshold.
   */
  async getStuckPayments(olderThanMinutes: number): Promise<Array<{ payment_id: string; to_status: string; gateway: string; created_at: string }>> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

    const sql = `
      SELECT DISTINCT ON (pe.payment_id)
        pe.payment_id, pe.to_status, pe.gateway, pe.created_at
      FROM payment_events pe
      WHERE pe.created_at < $1
        AND pe.to_status IN ('pending', 'held', 'processing')
        AND NOT EXISTS (
          SELECT 1 FROM payment_events pe2
          WHERE pe2.payment_id = pe.payment_id
            AND pe2.to_status IN ('completed', 'failed', 'cancelled', 'released')
        )
      ORDER BY pe.payment_id, pe.created_at DESC
    `;

    const { data, error } = await query<{ payment_id: string; to_status: string; gateway: string; created_at: string }>(sql, [cutoff]);
    if (error) {
      logger.error('[payment-events] Failed to get stuck payments', { action: 'payment_event.stuck', meta: { error: error instanceof Error ? error.message : String(error) } });
      return [];
    }
    return data;
  }

  /**
   * Get aggregate transition stats for a date range.
   */
  async getTransitionStats(
    startDate: string,
    endDate: string
  ): Promise<Array<{ event_type: string; count: number }>> {
    const sql = `
      SELECT event_type, COUNT(*)::int as count
      FROM payment_events
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY event_type
      ORDER BY count DESC
    `;

    const { data, error } = await query<{ event_type: string; count: number }>(sql, [startDate, endDate]);
    if (error) {
      logger.error('[payment-events] Failed to get transition stats', { action: 'payment_event.stats', meta: { error: error instanceof Error ? error.message : String(error) } });
      return [];
    }
    return data;
  }

  /**
   * Compute how long the payment has been in its current state.
   */
  private async computeDuration(paymentId: string): Promise<number | null> {
    try {
      const { data } = await queryOne<{ created_at: string }>(
        'SELECT created_at FROM payment_events WHERE payment_id = $1 ORDER BY created_at DESC LIMIT 1',
        [paymentId]
      );

      if (data?.created_at) {
        return Date.now() - new Date(data.created_at).getTime();
      }
      return null;
    } catch {
      return null;
    }
  }
}
