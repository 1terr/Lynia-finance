/**
 * Characterization tests for services/payment-service/src/payment-state-machine.ts
 *
 * Enforces valid payment status transitions. Wrong transitions = stuck payments
 * or premature confirmations.
 */

import {
  PaymentStateMachine,
  InvalidTransitionError,
  ConcurrentModificationError,
  PaymentHoldStatus,
} from '../../../services/payment-service/src/payment-state-machine';

// Mock database
jest.mock('../../../services/shared/clients/database', () => ({
  queryOne: jest.fn(),
}));

const { queryOne } = require('../../../services/shared/clients/database');

// Mock event logger
jest.mock('../../../services/payment-service/src/payment-event-logger', () => ({
  PaymentEventLogger: jest.fn().mockImplementation(() => ({
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('PaymentStateMachine', () => {
  let sm: PaymentStateMachine;

  beforeEach(() => {
    sm = new PaymentStateMachine();
    jest.clearAllMocks();
  });

  // ─── isValidTransition ────────────────────────────────────────
  describe('isValidTransition', () => {
    // Valid transitions
    const validTransitions: [PaymentHoldStatus, PaymentHoldStatus][] = [
      ['pending', 'held'],
      ['pending', 'processing'],
      ['pending', 'failed'],
      ['pending', 'cancelled'],
      ['held', 'processing'],
      ['held', 'released'],
      ['held', 'failed'],
      ['processing', 'completed'],
      ['processing', 'failed'],
      ['processing', 'cancelled'],
    ];

    for (const [from, to] of validTransitions) {
      it(`should allow ${from} → ${to}`, () => {
        expect(sm.isValidTransition(from, to)).toBe(true);
      });
    }

    // Invalid transitions (terminal states)
    const invalidTransitions: [PaymentHoldStatus, PaymentHoldStatus][] = [
      ['completed', 'pending'],
      ['completed', 'failed'],
      ['failed', 'completed'],
      ['failed', 'pending'],
      ['cancelled', 'pending'],
      ['released', 'pending'],
      ['pending', 'completed'],  // Can't skip to completed
      ['held', 'completed'],     // Must go through processing
    ];

    for (const [from, to] of invalidTransitions) {
      it(`should reject ${from} → ${to}`, () => {
        expect(sm.isValidTransition(from, to)).toBe(false);
      });
    }
  });

  // ─── getAllowedTransitions ────────────────────────────────────
  describe('getAllowedTransitions', () => {
    it('should return allowed next states for pending', () => {
      expect(sm.getAllowedTransitions('pending')).toEqual(
        expect.arrayContaining(['held', 'processing', 'failed', 'cancelled'])
      );
    });

    it('should return empty array for terminal states', () => {
      expect(sm.getAllowedTransitions('completed')).toEqual([]);
      expect(sm.getAllowedTransitions('failed')).toEqual([]);
      expect(sm.getAllowedTransitions('cancelled')).toEqual([]);
      expect(sm.getAllowedTransitions('released')).toEqual([]);
    });
  });

  // ─── transition ───────────────────────────────────────────────
  describe('transition', () => {
    it('should succeed for valid transition when DB confirms', async () => {
      queryOne.mockResolvedValueOnce({
        data: { transition_payment_status: true },
        error: null,
      });

      const result = await sm.transition('pay-1', 'pending', 'held', {
        gateway: 'ecocash',
      });

      expect(result).toBe(true);
      expect(queryOne).toHaveBeenCalledWith(
        'SELECT transition_payment_status($1, $2, $3, $4)',
        ['pay-1', 'pending', 'held', expect.any(String)]
      );
    });

    it('should throw InvalidTransitionError for invalid transition', async () => {
      await expect(
        sm.transition('pay-1', 'completed', 'pending')
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('should throw ConcurrentModificationError when DB returns false', async () => {
      queryOne.mockResolvedValueOnce({
        data: { transition_payment_status: false },
        error: null,
      });

      await expect(
        sm.transition('pay-1', 'pending', 'held')
      ).rejects.toThrow(ConcurrentModificationError);
    });

    it('should propagate database errors', async () => {
      queryOne.mockResolvedValueOnce({
        data: null,
        error: new Error('DB connection lost'),
      });

      await expect(
        sm.transition('pay-1', 'pending', 'held')
      ).rejects.toThrow('DB connection lost');
    });

    it('should include release_reason in metadata for released transition', async () => {
      queryOne.mockResolvedValueOnce({
        data: { transition_payment_status: true },
        error: null,
      });

      await sm.transition('pay-1', 'held', 'released', {
        gateway: 'ecocash',
        release_reason: 'Hold expired',
      });

      const [, params] = queryOne.mock.calls[0];
      const metadata = JSON.parse(params[3]);
      expect(metadata.release_reason).toBe('Hold expired');
    });
  });

  // ─── Error classes ────────────────────────────────────────────
  describe('error classes', () => {
    it('InvalidTransitionError should contain payment details', () => {
      const err = new InvalidTransitionError('pay-99', 'completed', 'pending');
      expect(err.paymentId).toBe('pay-99');
      expect(err.fromStatus).toBe('completed');
      expect(err.toStatus).toBe('pending');
      expect(err.name).toBe('InvalidTransitionError');
    });

    it('ConcurrentModificationError should contain payment details', () => {
      const err = new ConcurrentModificationError('pay-99', 'pending');
      expect(err.paymentId).toBe('pay-99');
      expect(err.expectedStatus).toBe('pending');
      expect(err.name).toBe('ConcurrentModificationError');
    });
  });
});
