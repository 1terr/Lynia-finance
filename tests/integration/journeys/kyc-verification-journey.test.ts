/**
 * Integration journey test: KYC Verification
 *
 * Tests the full KYC flow:
 *   Initiate KYC → Provider processes → Result updates system → Admin reviews
 *
 * Handlers under test:
 *   - handleInitiateKYC (kyc-service)
 *   - processKYCResult (kyc-service)
 *   - handleApproveKYC, handleRejectKYC (admin-service)
 */

import type { KYCVerificationResult, KYCDecision } from '../../../services/shared/types/kyc-provider';

// ─── DB operation tracking ───
const dbOps: { table: string; op: string; data: Record<string, unknown>; filters?: Record<string, unknown> }[] = [];
const mockFrom = jest.fn();
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: { from: (...args: unknown[]) => mockFrom(...args) },
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));

jest.mock('../../../services/shared/utils/response', () => ({
  successResponse: (body: unknown, status: number, _event: unknown) => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  errorResponse: (message: string, status: number, details: unknown = {}, _event: unknown) => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: { message, ...details } }),
  }),
  getSecurityHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

jest.mock('../../../services/shared/middleware/authorization', () => ({
  isAdminOrManager: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn().mockResolvedValue({ data: {} }) },
}));

// Mock KYC provider
const mockSubmitVerification = jest.fn();
const mockDetermineDecision = jest.fn();

jest.mock('../../../services/kyc-service/src/handlers/provider-instance', () => ({
  kycProvider: {
    providerName: 'didit',
    submitVerification: (...args: unknown[]) => mockSubmitVerification(...args),
    determineDecision: (...args: unknown[]) => mockDetermineDecision(...args),
  },
}));

import { handleInitiateKYC } from '../../../services/kyc-service/src/handlers/initiate-kyc';
import { processKYCResult } from '../../../services/kyc-service/src/handlers/process-kyc-result';
import { handleApproveKYC, handleRejectKYC } from '../../../services/admin-service/src/handlers/kyc-review';
import { createAPIGatewayEvent } from '../../helpers/test-utils';

// ─── Test data ───
const testCustomer = {
  id: 'cust-001',
  first_name: 'Tendai',
  last_name: 'Moyo',
  phone_number: '+263771234567',
  whatsapp_number: '+263771234567',
  kyc_status: 'pending',
};

const testSubmission = {
  id: 'sub-001',
  customer_id: 'cust-001',
  status: 'pending',
  id_number: '63-1234567B08',
  submitted_at: new Date().toISOString(),
};

function makeVerificationResult(overrides: Partial<KYCVerificationResult> = {}): KYCVerificationResult {
  return {
    provider: 'didit',
    provider_job_id: 'job-001',
    internal_job_id: 'int-001',
    confidence_score: 95,
    face_match_score: 97,
    liveness_score: 99,
    liveness_passed: true,
    document_authentic: true,
    document_tampered: false,
    document_expired: false,
    match_result: 'verified',
    id_info: {
      full_name: 'Tendai Moyo',
      id_number: '63-1234567B08',
      date_of_birth: '1990-05-15',
      gender: 'M',
      nationality: 'ZW',
      document_type: 'national_id',
    },
    raw_response: {},
    warnings: [],
    ...overrides,
  };
}

describe('KYC Verification Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbOps.length = 0;
  });

  function setupDbChain(table: string, selectData: unknown = null) {
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
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockReturnValue(chain);
    chain.maybeSingle = jest.fn().mockReturnValue(chain);
    chain.execute = jest.fn().mockResolvedValue({ data: selectData, error: null });
    return chain;
  }

  // ─── Happy Path: Initiate → APPROVED → Verified ───

  describe('Happy Path: Initiate -> Provider Approves -> Customer Verified', () => {
    it('Step 1: Initiate KYC creates pending submission via provider', async () => {
      // No existing submission found
      let kycCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'kyc_submissions') {
          kycCallCount++;
          const chain = setupDbChain(table, null);
          if (kycCallCount === 1) {
            // First from(): check existing → not found
            chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });
          } else {
            // Second from(): insert returns created record
            chain.execute = jest.fn().mockResolvedValue({
              data: { id: 'sub-new-001', customer_id: 'cust-001', status: 'pending' },
              error: null,
            });
          }
          return chain;
        }
        return setupDbChain(table);
      });

      mockSubmitVerification.mockResolvedValue({
        success: true,
        provider_job_id: 'didit-job-001',
        internal_job_id: 'int-001',
        message: 'Verification submitted',
        // No synchronous_result → async flow
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          customer_id: 'cust-001',
          id_number: '63-1234567B08',
          id_image_base64: 'base64data...',
          selfie_image_base64: 'base64selfie...',
        }),
      });

      const result = await handleInitiateKYC(event, {}, {});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(mockSubmitVerification).toHaveBeenCalled();
    });

    it('Step 2: Process APPROVED result updates submission to verified', async () => {
      mockFrom.mockImplementation((table: string) => setupDbChain(table, testCustomer));
      mockDetermineDecision.mockReturnValue({ decision: 'APPROVED', reason: 'High confidence' } as KYCDecision);

      await processKYCResult('sub-001', 'cust-001', makeVerificationResult());

      const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
      expect(subUpdate).toBeDefined();
      expect(subUpdate!.data.status).toBe('verified');
      expect(subUpdate!.data.verified_at).toBeDefined();
    });

    it('Step 3: Customer kyc_status is updated to verified', async () => {
      mockFrom.mockImplementation((table: string) => setupDbChain(table, testCustomer));
      mockDetermineDecision.mockReturnValue({ decision: 'APPROVED', reason: 'High confidence' } as KYCDecision);

      await processKYCResult('sub-001', 'cust-001', makeVerificationResult());

      const custUpdate = dbOps.find(op => op.table === 'customers' && op.op === 'update');
      expect(custUpdate).toBeDefined();
      expect(custUpdate!.data.kyc_status).toBe('verified');
      expect(custUpdate!.data.kyc_verified_at).toBeDefined();
    });

    it('Step 4: Re-initiating KYC for verified customer returns "already verified"', async () => {
      const verifiedSubmission = { ...testSubmission, status: 'verified' };
      mockFrom.mockImplementation((table: string) => {
        const chain = setupDbChain(table, verifiedSubmission);
        return chain;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          customer_id: 'cust-001',
          id_number: '63-1234567B08',
          id_image_base64: 'base64data...',
          selfie_image_base64: 'base64selfie...',
        }),
      });

      const result = await handleInitiateKYC(event, {}, {});
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('already verified');
    });
  });

  // ─── Rejection Path ───

  describe('Rejection Path: Provider Rejects -> Retry Allowed', () => {
    it('Process REJECTED result updates submission to rejected', async () => {
      mockFrom.mockImplementation((table: string) => setupDbChain(table, testCustomer));
      mockDetermineDecision.mockReturnValue({ decision: 'REJECTED', reason: 'Face not matched' } as KYCDecision);

      await processKYCResult('sub-001', 'cust-001', makeVerificationResult({
        confidence_score: 35,
        face_match_score: 30,
        match_result: 'not_verified',
      }));

      const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
      expect(subUpdate!.data.status).toBe('rejected');
      expect(subUpdate!.data.rejected_at).toBeDefined();
    });

    it('REJECTED does not set customer.kyc_status to verified', async () => {
      mockFrom.mockImplementation((table: string) => setupDbChain(table, testCustomer));
      mockDetermineDecision.mockReturnValue({ decision: 'REJECTED', reason: 'Face not matched' } as KYCDecision);

      await processKYCResult('sub-001', 'cust-001', makeVerificationResult());

      const custUpdates = dbOps.filter(op => op.table === 'customers' && op.op === 'update');
      for (const u of custUpdates) {
        expect(u.data.kyc_status).not.toBe('verified');
      }
    });
  });

  // ─── Manual Review Path ───

  describe('Manual Review Path: Admin Approves', () => {
    it('Process MANUAL_REVIEW creates review entry with 24h SLA', async () => {
      mockFrom.mockImplementation((table: string) => setupDbChain(table, testCustomer));
      mockDetermineDecision.mockReturnValue({ decision: 'MANUAL_REVIEW', reason: 'Low confidence' } as KYCDecision);

      await processKYCResult('sub-001', 'cust-001', makeVerificationResult({ confidence_score: 72 }));

      const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
      expect(subUpdate!.data.status).toBe('manual_review');

      const reviewInsert = dbOps.find(op => op.table === 'kyc_manual_reviews' && op.op === 'insert');
      expect(reviewInsert).toBeDefined();
      expect(reviewInsert!.data.review_status).toBe('pending');
      expect(reviewInsert!.data.sla_deadline).toBeDefined();

      // SLA should be ~24h from now
      const sla = new Date(reviewInsert!.data.sla_deadline as string).getTime();
      const now = Date.now();
      const diff = sla - now;
      expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('Admin approves submission via handleApproveKYC', async () => {
      mockQuery.mockResolvedValueOnce({ data: [{ id: 'sub-001' }], error: null }) // UPDATE kyc_submissions RETURNING
        .mockResolvedValue({ data: null, error: null }); // audit log
      mockQueryOne.mockResolvedValue({ data: { extracted_name: 'Tendai Moyo' }, error: null });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/v1/kyc/submissions/sub-001/approve',
        body: JSON.stringify({ customer_id: 'cust-001' }),
      });

      const result = await handleApproveKYC(event, { id: 'sub-001' }, { userId: 'admin-1', email: 'admin@lynia.com' });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('approved');
    });
  });

  // ─── Admin Reject Path ───

  describe('Admin Rejects KYC', () => {
    it('handleRejectKYC requires reason', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ customer_id: 'cust-001' }), // No reason
      });

      const result = await handleRejectKYC(event, { id: 'sub-001' }, { userId: 'admin-1', email: 'admin@lynia.com' });
      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('reason');
    });

    it('handleRejectKYC updates submission and customer status', async () => {
      mockQuery.mockResolvedValueOnce({ data: [{ id: 'sub-001' }], error: null }) // UPDATE RETURNING
        .mockResolvedValueOnce({ data: null, error: null }) // customer update
        .mockResolvedValue({ data: null, error: null }); // audit log

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ customer_id: 'cust-001', reason: 'Document illegible' }),
      });

      const result = await handleRejectKYC(event, { id: 'sub-001' }, { userId: 'admin-1', email: 'admin@lynia.com' });

      expect(result.statusCode).toBe(200);

      // First query call should be the UPDATE with rejection
      const firstCall = mockQuery.mock.calls[0];
      expect(firstCall[0]).toContain("status = 'rejected'");
      expect(firstCall[0]).toContain('rejection_reason');
    });

    it('handleRejectKYC creates audit log entry', async () => {
      mockQuery.mockResolvedValueOnce({ data: [{ id: 'sub-001' }], error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValue({ data: null, error: null });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ customer_id: 'cust-001', reason: 'Document illegible' }),
      });

      await handleRejectKYC(event, { id: 'sub-001' }, { userId: 'admin-1', email: 'admin@lynia.com' });

      // Third query call should be audit_log INSERT
      const auditCall = mockQuery.mock.calls[2];
      expect(auditCall[0]).toContain('audit_log');
      expect(auditCall[0]).toContain('kyc.reject');
    });

    it('returns 404 when submission not found or already reviewed', async () => {
      mockQuery.mockResolvedValueOnce({ data: [], error: null }); // UPDATE returns nothing

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ customer_id: 'cust-001', reason: 'Test' }),
      });

      const result = await handleRejectKYC(event, { id: 'nonexistent' }, { userId: 'admin-1', email: 'admin@lynia.com' });
      expect(result.statusCode).toBe(404);
    });
  });

  // ─── Input Validation ───

  describe('Input Validation', () => {
    it('rejects initiation with missing required fields', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ customer_id: 'cust-001' }), // Missing id_number, images
      });

      const result = await handleInitiateKYC(event, {}, {});
      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Missing required fields');
    });

    it('rejects initiation with invalid Zimbabwe ID', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          customer_id: 'cust-001',
          id_number: 'INVALID',
          id_image_base64: 'data...',
          selfie_image_base64: 'data...',
        }),
      });

      const result = await handleInitiateKYC(event, {}, {});
      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Invalid ID');
    });

    it('handleApproveKYC requires customer_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({}), // No customer_id
      });

      const result = await handleApproveKYC(event, { id: 'sub-001' }, { userId: 'admin-1', email: 'admin@lynia.com' });
      expect(result.statusCode).toBe(400);
    });
  });

  // ─── Score Persistence ───

  describe('Score Persistence', () => {
    it('all verification scores are stored in submission update', async () => {
      mockFrom.mockImplementation((table: string) => setupDbChain(table, testCustomer));
      mockDetermineDecision.mockReturnValue({ decision: 'APPROVED', reason: 'OK' } as KYCDecision);

      const result = makeVerificationResult({
        confidence_score: 92.5,
        face_match_score: 88.3,
        liveness_score: 95.1,
      });

      await processKYCResult('sub-001', 'cust-001', result);

      const subUpdate = dbOps.find(op => op.table === 'kyc_submissions' && op.op === 'update');
      expect(subUpdate!.data.verification_confidence).toBe(92.5);
      expect(subUpdate!.data.face_match_score).toBe(88.3);
      expect(subUpdate!.data.liveness_score).toBe(95.1);
    });
  });
});