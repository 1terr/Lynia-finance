/**
 * Property-based tests for KYC state machine.
 * Tests: processKYCResult from services/kyc-service/src/handlers/process-kyc-result.ts
 *
 * Key invariants:
 * - APPROVED → submission.status='verified' AND customer.kyc_status='verified'
 * - REJECTED → submission.status='rejected'
 * - MANUAL_REVIEW → creates kyc_manual_reviews entry
 * - Non-APPROVED decisions never set customer.kyc_status='verified'
 * - Scores are always persisted to submission
 */

import fc from 'fast-check';
import { arbKYCVerificationResult } from '../../helpers/fast-check-arbitraries';
import type { KYCVerificationResult, KYCDecision } from '../../../services/shared/types/kyc-provider';

// Track all DB operations
const dbOps: { table: string; op: string; data: Record<string, unknown> }[] = [];

const mockFrom = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn().mockResolvedValue({ data: {} }) },
}));

const mockDetermineDecision = jest.fn();
jest.mock('../../../services/kyc-service/src/handlers/provider-instance', () => ({
  kycProvider: {
    determineDecision: (...args: unknown[]) => mockDetermineDecision(...args),
  },
}));

import { processKYCResult } from '../../../services/kyc-service/src/handlers/process-kyc-result';

describe('KYC State Machine - property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbOps.length = 0;

    // Default mock: all DB operations succeed
    mockFrom.mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
        dbOps.push({ table, op: 'insert', data });
        return chain;
      });
      chain.update = jest.fn().mockImplementation((data: Record<string, unknown>) => {
        dbOps.push({ table, op: 'update', data });
        return chain;
      });
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.single = jest.fn().mockReturnValue(chain);
      chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });

      // For customer lookup (WhatsApp notification)
      if (table === 'customers') {
        chain.execute = jest.fn().mockResolvedValue({
          data: { phone_number: '+263771234567', whatsapp_number: '+263771234567' },
          error: null,
        });
      }
      // For whatsapp_sessions lookup
      if (table === 'whatsapp_sessions') {
        chain.execute = jest.fn().mockResolvedValue({
          data: { current_state: 'kyc_processing', state_data: {} },
          error: null,
        });
      }

      return chain;
    });
  });

  it('APPROVED → submission.status=verified AND customer.kyc_status=verified (always)', () => {
    return fc.assert(
      fc.asyncProperty(arbKYCVerificationResult(), async (result) => {
        dbOps.length = 0;
        mockDetermineDecision.mockReturnValue({ decision: 'APPROVED', reason: 'High confidence' } as KYCDecision);

        await processKYCResult('sub-1', 'cust-1', result);

        // Submission should be updated to 'verified'
        const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
        expect(subUpdate).toBeDefined();
        expect(subUpdate!.data.status).toBe('verified');
        expect(subUpdate!.data.verified_at).toBeDefined();

        // Customer should be updated to kyc_status='verified'
        const custUpdate = dbOps.find(op => op.table === 'customers' && op.op === 'update');
        expect(custUpdate).toBeDefined();
        expect(custUpdate!.data.kyc_status).toBe('verified');
      }),
      { numRuns: 100 }
    );
  });

  it('REJECTED → submission.status=rejected (always)', () => {
    return fc.assert(
      fc.asyncProperty(arbKYCVerificationResult(), async (result) => {
        dbOps.length = 0;
        mockDetermineDecision.mockReturnValue({ decision: 'REJECTED', reason: 'Face not matched' } as KYCDecision);

        await processKYCResult('sub-1', 'cust-1', result);

        const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
        expect(subUpdate).toBeDefined();
        expect(subUpdate!.data.status).toBe('rejected');
        expect(subUpdate!.data.rejected_at).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('MANUAL_REVIEW → creates kyc_manual_reviews entry (always)', () => {
    return fc.assert(
      fc.asyncProperty(arbKYCVerificationResult(), async (result) => {
        dbOps.length = 0;
        mockDetermineDecision.mockReturnValue({ decision: 'MANUAL_REVIEW', reason: 'Low confidence' } as KYCDecision);

        await processKYCResult('sub-1', 'cust-1', result);

        // Submission set to manual_review
        const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
        expect(subUpdate).toBeDefined();
        expect(subUpdate!.data.status).toBe('manual_review');

        // Manual review entry created
        const manualInsert = dbOps.find(op => op.table === 'kyc_manual_reviews' && op.op === 'insert');
        expect(manualInsert).toBeDefined();
        expect(manualInsert!.data.kyc_submission_id).toBe('sub-1');
        expect(manualInsert!.data.customer_id).toBe('cust-1');
        expect(manualInsert!.data.review_status).toBe('pending');
        expect(manualInsert!.data.sla_deadline).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('non-APPROVED decisions never set customer.kyc_status=verified', () => {
    const nonApprovedDecision = fc.constantFrom(
      { decision: 'REJECTED' as const, reason: 'Failed' },
      { decision: 'MANUAL_REVIEW' as const, reason: 'Needs review' }
    );

    return fc.assert(
      fc.asyncProperty(arbKYCVerificationResult(), nonApprovedDecision, async (result, decision) => {
        dbOps.length = 0;
        mockDetermineDecision.mockReturnValue(decision);

        await processKYCResult('sub-1', 'cust-1', result);

        const custUpdates = dbOps.filter(op => op.table === 'customers' && op.op === 'update');
        for (const update of custUpdates) {
          expect(update.data.kyc_status).not.toBe('verified');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('verification scores are always persisted to submission', () => {
    return fc.assert(
      fc.asyncProperty(
        arbKYCVerificationResult(),
        fc.constantFrom('APPROVED' as const, 'REJECTED' as const, 'MANUAL_REVIEW' as const),
        async (result, decision) => {
          dbOps.length = 0;
          mockDetermineDecision.mockReturnValue({ decision, reason: 'test' });

          await processKYCResult('sub-1', 'cust-1', result);

          const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
          expect(subUpdate).toBeDefined();
          expect(subUpdate!.data.verification_confidence).toBe(result.confidence_score);
          expect(subUpdate!.data.liveness_score).toBe(result.liveness_score);
          expect(subUpdate!.data.face_match_score).toBe(result.face_match_score);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('APPROVED always stores the decision reason', () => {
    return fc.assert(
      fc.asyncProperty(
        arbKYCVerificationResult(),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (result, reason) => {
          dbOps.length = 0;
          mockDetermineDecision.mockReturnValue({ decision: 'APPROVED', reason });

          await processKYCResult('sub-1', 'cust-1', result);

          const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
          expect(subUpdate!.data.verification_decision).toBe('APPROVED');
          expect(subUpdate!.data.verification_reason).toBe(reason);
        }
      ),
      { numRuns: 50 }
    );
  });
});
