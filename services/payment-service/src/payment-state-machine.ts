/**
 * Payment State Machine
 *
 * Enforces valid payment status transitions with optimistic concurrency
 * via the PostgreSQL transition_payment_status() function.
 *
 * Inspired by PH-EE's Zeebe PREPARE/COMMIT/RELEASE pattern,
 * adapted to PostgreSQL + Lambda.
 */

import { queryOne } from '../../shared/clients/database';
import logger from '../../shared/utils/logger';
import { PaymentEventLogger, type PaymentEventType, type ActorType } from './payment-event-logger';

// ===================================================================
// TYPES
// ===================================================================

export type PaymentHoldStatus =
  | 'pending'
  | 'held'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'released';

/** Metadata for state transitions */
export interface TransitionMetadata {
  gateway?: string;
  provider_transaction_id?: string;
  provider_response?: Record<string, unknown>;
  release_reason?: string;
  error_code?: string;
  error_message?: string;
  actor_type?: ActorType;
  actor_id?: string;
  loan_id?: string;
  customer_id?: string;
  request_id?: string;
}

// ===================================================================
// VALID TRANSITIONS
// ===================================================================

const VALID_TRANSITIONS: Record<PaymentHoldStatus, PaymentHoldStatus[]> = {
  'pending': ['held', 'processing', 'failed', 'cancelled'],
  'held': ['processing', 'released', 'failed'],
  'processing': ['completed', 'failed', 'cancelled'],
  'completed': [],
  'failed': [],
  'cancelled': [],
  'released': [],
};

/** Map status transitions to event types */
function getEventType(from: PaymentHoldStatus, to: PaymentHoldStatus): PaymentEventType {
  if (to === 'held') return 'held';
  if (to === 'processing') return 'provider_submitted';
  if (to === 'completed') return 'completed';
  if (to === 'failed') return 'failed';
  if (to === 'released') return 'released';
  if (to === 'cancelled') return 'failed';
  return 'initiated';
}

// ===================================================================
// ERRORS
// ===================================================================

export class InvalidTransitionError extends Error {
  constructor(
    public readonly paymentId: string,
    public readonly fromStatus: PaymentHoldStatus,
    public readonly toStatus: PaymentHoldStatus
  ) {
    super(`Invalid payment transition: ${fromStatus} -> ${toStatus} for payment ${paymentId}`);
    this.name = 'InvalidTransitionError';
  }
}

export class ConcurrentModificationError extends Error {
  constructor(
    public readonly paymentId: string,
    public readonly expectedStatus: PaymentHoldStatus
  ) {
    super(`Payment ${paymentId} is no longer in status '${expectedStatus}' (concurrent modification)`);
    this.name = 'ConcurrentModificationError';
  }
}

// ===================================================================
// STATE MACHINE
// ===================================================================

export class PaymentStateMachine {
  private eventLogger: PaymentEventLogger;

  constructor(eventLogger?: PaymentEventLogger) {
    this.eventLogger = eventLogger || new PaymentEventLogger();
  }

  /**
   * Transition a payment from expectedStatus to newStatus.
   *
   * Uses PostgreSQL transition_payment_status() for atomic optimistic
   * concurrency — the UPDATE only succeeds if the row is currently
   * in expectedStatus.
   *
   * @throws InvalidTransitionError if the transition is not allowed
   * @throws ConcurrentModificationError if the payment was modified concurrently
   */
  async transition(
    paymentId: string,
    expectedStatus: PaymentHoldStatus,
    newStatus: PaymentHoldStatus,
    metadata: TransitionMetadata = {}
  ): Promise<boolean> {
    // Validate transition is allowed
    const allowed = VALID_TRANSITIONS[expectedStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new InvalidTransitionError(paymentId, expectedStatus, newStatus);
    }

    // Build metadata JSON for the PostgreSQL function
    const pgMetadata: Record<string, string> = {};
    if (metadata.release_reason) {
      pgMetadata.release_reason = metadata.release_reason;
    }

    // Execute atomic transition
    const { data, error } = await queryOne<{ transition_payment_status: boolean }>(
      'SELECT transition_payment_status($1, $2, $3, $4)',
      [paymentId, expectedStatus, newStatus, JSON.stringify(pgMetadata)]
    );

    if (error) {
      throw error;
    }

    const succeeded = data?.transition_payment_status === true;

    if (!succeeded) {
      throw new ConcurrentModificationError(paymentId, expectedStatus);
    }

    // Log the event (non-blocking)
    this.eventLogger.logEvent({
      payment_id: paymentId,
      from_status: expectedStatus,
      to_status: newStatus,
      event_type: getEventType(expectedStatus, newStatus),
      gateway: metadata.gateway,
      provider_transaction_id: metadata.provider_transaction_id,
      provider_response: metadata.provider_response,
      actor_type: metadata.actor_type || 'system',
      actor_id: metadata.actor_id,
      error_code: metadata.error_code,
      error_message: metadata.error_message,
      loan_id: metadata.loan_id,
      customer_id: metadata.customer_id,
      request_id: metadata.request_id,
    }).catch((err) => {
      logger.error('[state-machine] Failed to log transition event', { action: 'payment_state.transition', meta: { error: err instanceof Error ? err.message : String(err) } });
    });

    return true;
  }

  /**
   * Check if a transition from one status to another is valid.
   */
  isValidTransition(from: PaymentHoldStatus, to: PaymentHoldStatus): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return !!allowed && allowed.includes(to);
  }

  /**
   * Get allowed next statuses from a given status.
   */
  getAllowedTransitions(from: PaymentHoldStatus): PaymentHoldStatus[] {
    return VALID_TRANSITIONS[from] || [];
  }
}
