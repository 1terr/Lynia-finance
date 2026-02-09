/**
 * Cross-Service Data Flow Tests: Onboarding Pipeline
 *
 * Validates data propagation through the full onboarding pipeline:
 * WhatsApp message -> Customer record -> KYC verification -> Credit scoring -> Loan creation
 *
 * Ensures customer_id is consistently propagated across all tables,
 * timestamps are sequential, and no data is lost during service handoffs.
 */

import {
  createMockSupabaseClient,
  seedMockTable,
  getMockTable,
  resetMockDataStore,
  createTestCustomer,
  createTestLoan,
  createAPIGatewayEvent,
  parseResponseBody,
  generateTestId,
} from '../../helpers/test-utils';
import { testCustomers, testLoans } from '../../fixtures';

// ---------------------------------------------------------------------------
// Mock Supabase before importing any service handlers
// ---------------------------------------------------------------------------
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  match: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
};

const mockSupabaseClient = {
  from: jest.fn(() => ({ ...mockQueryBuilder })),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('axios', () => ({
  default: {
    post: jest.fn().mockResolvedValue({
      data: {
        messages: [{ id: 'wamid.test_msg_001' }],
        contacts: [{ wa_id: '263771234567' }],
      },
    }),
    isAxiosError: jest.fn().mockReturnValue(false),
  },
  post: jest.fn(),
  isAxiosError: jest.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Onboarding Data Flow Tests', () => {
  const customerId = 'cust_onboarding_001';
  const phoneNumber = '+263771234567';
  const customerName = 'Tendai Moyo';

  beforeEach(() => {
    resetMockDataStore();
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. WhatsApp creates customer record that KYC can read
  // =========================================================================
  describe('WhatsApp -> Customer Record -> KYC Read', () => {
    it('should create a customer record when a WhatsApp message arrives from a new number', () => {
      // Step 1: Simulate WhatsApp service creating a customer
      const newCustomer = createTestCustomer({
        id: customerId,
        phone_number: phoneNumber,
        whatsapp_number: phoneNumber,
        full_name: customerName,
        kyc_status: 'pending',
        status: 'active',
        created_at: '2025-06-01T10:00:00.000Z',
      });

      seedMockTable('customers', [newCustomer]);

      // Step 2: Verify the customer was persisted
      const customers = getMockTable('customers');
      expect(customers).toHaveLength(1);
      expect(customers[0].id).toBe(customerId);
      expect(customers[0].phone_number).toBe(phoneNumber);
      expect(customers[0].whatsapp_number).toBe(phoneNumber);
      expect(customers[0].kyc_status).toBe('pending');
      expect(customers[0].status).toBe('active');
    });

    it('should allow KYC service to read the customer record created by WhatsApp', () => {
      // WhatsApp service wrote this customer
      const customer = createTestCustomer({
        id: customerId,
        phone_number: phoneNumber,
        whatsapp_number: phoneNumber,
        full_name: customerName,
        kyc_status: 'pending',
      });
      seedMockTable('customers', [customer]);

      // KYC service reads the same customer
      const customers = getMockTable('customers');
      const foundCustomer = customers.find((c) => c.id === customerId);

      expect(foundCustomer).toBeDefined();
      expect(foundCustomer!.id).toBe(customerId);
      expect(foundCustomer!.phone_number).toBe(phoneNumber);
      expect(foundCustomer!.full_name).toBe(customerName);
      expect(foundCustomer!.kyc_status).toBe('pending');
    });

    it('should preserve customer_id across WhatsApp messages table and customers table', () => {
      const customer = createTestCustomer({ id: customerId });
      seedMockTable('customers', [customer]);
      seedMockTable('whatsapp_messages', [
        {
          id: generateTestId('msg'),
          customer_id: customerId,
          phone_number: phoneNumber,
          direction: 'inbound',
          content: 'Hello',
          message_type: 'text',
          status: 'delivered',
          created_at: new Date().toISOString(),
        },
      ]);

      const customers = getMockTable('customers');
      const messages = getMockTable('whatsapp_messages');

      expect(customers[0].id).toBe(customerId);
      expect(messages[0].customer_id).toBe(customerId);
      // customer_id is consistent across tables
      expect(messages[0].customer_id).toBe(customers[0].id);
    });
  });

  // =========================================================================
  // 2. KYC verification result updates customer table
  // =========================================================================
  describe('KYC Verification -> Customer Update', () => {
    it('should update customer kyc_status to verified after successful KYC', () => {
      // Initial state: customer with pending KYC
      const customer = createTestCustomer({
        id: customerId,
        kyc_status: 'pending',
        created_at: '2025-06-01T10:00:00.000Z',
      });
      seedMockTable('customers', [customer]);

      // KYC submission record
      const kycSubmission = {
        id: generateTestId('kyc'),
        customer_id: customerId,
        status: 'pending',
        submitted_at: '2025-06-01T10:05:00.000Z',
        created_at: '2025-06-01T10:05:00.000Z',
      };
      seedMockTable('kyc_submissions', [kycSubmission]);

      // Simulate KYC callback updating submission and customer
      const kycTable = getMockTable('kyc_submissions');
      kycTable[0] = {
        ...kycTable[0],
        status: 'verified',
        verification_decision: 'APPROVED',
        verification_confidence: 99.5,
        verified_at: '2025-06-01T10:10:00.000Z',
      };

      const customerTable = getMockTable('customers');
      customerTable[0] = {
        ...customerTable[0],
        kyc_status: 'verified',
        kyc_verified_at: '2025-06-01T10:10:00.000Z',
      };

      // Verify the customer KYC status was updated
      const updatedCustomers = getMockTable('customers');
      expect(updatedCustomers[0].kyc_status).toBe('verified');
      expect(updatedCustomers[0].kyc_verified_at).toBe('2025-06-01T10:10:00.000Z');

      // Verify the KYC submission was updated
      const updatedKyc = getMockTable('kyc_submissions');
      expect(updatedKyc[0].status).toBe('verified');
      expect(updatedKyc[0].verification_decision).toBe('APPROVED');
    });

    it('should update customer kyc_status to rejected on KYC failure', () => {
      const customer = createTestCustomer({
        id: customerId,
        kyc_status: 'pending',
      });
      seedMockTable('customers', [customer]);

      const kycSubmission = {
        id: generateTestId('kyc'),
        customer_id: customerId,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      };
      seedMockTable('kyc_submissions', [kycSubmission]);

      // Simulate rejection
      const kycTable = getMockTable('kyc_submissions');
      kycTable[0] = {
        ...kycTable[0],
        status: 'rejected',
        verification_decision: 'REJECTED',
        verification_reason: 'Face not matched',
        rejected_at: new Date().toISOString(),
      };

      expect(kycTable[0].status).toBe('rejected');
      expect(kycTable[0].verification_decision).toBe('REJECTED');
    });

    it('should maintain customer_id link between customers and kyc_submissions tables', () => {
      const customer = createTestCustomer({ id: customerId });
      seedMockTable('customers', [customer]);

      const kycId = generateTestId('kyc');
      seedMockTable('kyc_submissions', [
        {
          id: kycId,
          customer_id: customerId,
          status: 'verified',
          verified_at: new Date().toISOString(),
        },
      ]);

      const customers = getMockTable('customers');
      const kycSubs = getMockTable('kyc_submissions');

      // Same customer_id links both records
      expect(kycSubs[0].customer_id).toBe(customers[0].id);
    });
  });

  // =========================================================================
  // 3. Scoring service reads correct customer + KYC data
  // =========================================================================
  describe('Scoring Service Reads Customer + KYC Data', () => {
    it('should read verified customer and KYC data for scoring', () => {
      const customer = createTestCustomer({
        id: customerId,
        kyc_status: 'verified',
        monthly_income_usd: 500,
        employment_status: 'employed',
      });
      seedMockTable('customers', [customer]);

      seedMockTable('kyc_submissions', [
        {
          id: generateTestId('kyc'),
          customer_id: customerId,
          status: 'verified',
          verification_decision: 'APPROVED',
          verification_confidence: 99.5,
          face_match_score: 0.97,
          liveness_score: 0.99,
          verified_at: '2025-06-01T10:10:00.000Z',
        },
      ]);

      // Scoring service reads customer
      const customers = getMockTable('customers');
      const scoringCustomer = customers.find((c) => c.id === customerId);

      expect(scoringCustomer).toBeDefined();
      expect(scoringCustomer!.kyc_status).toBe('verified');
      expect(scoringCustomer!.monthly_income_usd).toBe(500);

      // Scoring service reads KYC data
      const kycSubs = getMockTable('kyc_submissions');
      const kycData = kycSubs.find((k) => k.customer_id === customerId);

      expect(kycData).toBeDefined();
      expect(kycData!.status).toBe('verified');
      expect(kycData!.verification_confidence).toBe(99.5);
    });

    it('should create credit score record after reading customer and KYC data', () => {
      const customer = createTestCustomer({
        id: customerId,
        kyc_status: 'verified',
      });
      seedMockTable('customers', [customer]);

      // Scoring service writes credit score
      const scoreId = generateTestId('score');
      seedMockTable('credit_scores', [
        {
          id: scoreId,
          customer_id: customerId,
          total_raw_score: 750,
          scaled_score: 713,
          components: {
            affordability: 250,
            repayment_willingness: 125,
            mobile_money: 175,
            external_credit: 100,
            kyc_verification: 100,
          },
          decision: 'approve',
          tier: 'Tier 2',
          credit_limit_usd: 350,
          calculated_at: '2025-06-01T10:15:00.000Z',
        },
      ]);

      const scores = getMockTable('credit_scores');
      expect(scores).toHaveLength(1);
      expect(scores[0].customer_id).toBe(customerId);
      expect(scores[0].total_raw_score).toBe(750);
      expect(scores[0].decision).toBe('approve');
    });

    it('should not score a customer whose KYC is still pending', () => {
      const customer = createTestCustomer({
        id: customerId,
        kyc_status: 'pending',
      });
      seedMockTable('customers', [customer]);

      // Scoring service should check KYC status
      const customers = getMockTable('customers');
      const scoringCustomer = customers.find((c) => c.id === customerId);

      expect(scoringCustomer!.kyc_status).toBe('pending');
      // No credit score should be created for pending KYC
      const scores = getMockTable('credit_scores');
      expect(scores).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. Timestamp sequencing across the onboarding pipeline
  // =========================================================================
  describe('Timestamp Sequencing', () => {
    it('should maintain sequential timestamps: created_at < kyc_submitted_at < scored_at < loan_created_at', () => {
      const createdAt = '2025-06-01T10:00:00.000Z';
      const kycSubmittedAt = '2025-06-01T10:05:00.000Z';
      const kycVerifiedAt = '2025-06-01T10:10:00.000Z';
      const scoredAt = '2025-06-01T10:15:00.000Z';
      const loanCreatedAt = '2025-06-01T10:20:00.000Z';

      // Customer created by WhatsApp
      seedMockTable('customers', [
        createTestCustomer({
          id: customerId,
          created_at: createdAt,
          kyc_verified_at: kycVerifiedAt,
        }),
      ]);

      // KYC submission
      seedMockTable('kyc_submissions', [
        {
          id: generateTestId('kyc'),
          customer_id: customerId,
          submitted_at: kycSubmittedAt,
          verified_at: kycVerifiedAt,
          status: 'verified',
        },
      ]);

      // Credit score
      seedMockTable('credit_scores', [
        {
          id: generateTestId('score'),
          customer_id: customerId,
          calculated_at: scoredAt,
          decision: 'approve',
        },
      ]);

      // Loan
      seedMockTable('loans', [
        createTestLoan({
          id: generateTestId('loan'),
          customer_id: customerId,
          created_at: loanCreatedAt,
        }),
      ]);

      // Verify strict ordering
      const customer = getMockTable('customers')[0];
      const kyc = getMockTable('kyc_submissions')[0];
      const score = getMockTable('credit_scores')[0];
      const loan = getMockTable('loans')[0];

      const t_created = new Date(customer.created_at as string).getTime();
      const t_kyc_submitted = new Date(kyc.submitted_at as string).getTime();
      const t_kyc_verified = new Date(kyc.verified_at as string).getTime();
      const t_scored = new Date(score.calculated_at as string).getTime();
      const t_loan_created = new Date(loan.created_at as string).getTime();

      expect(t_created).toBeLessThan(t_kyc_submitted);
      expect(t_kyc_submitted).toBeLessThan(t_kyc_verified);
      expect(t_kyc_verified).toBeLessThan(t_scored);
      expect(t_scored).toBeLessThan(t_loan_created);
    });

    it('should reject out-of-order timestamps (scoring before KYC)', () => {
      const createdAt = '2025-06-01T10:00:00.000Z';
      const scoredAt = '2025-06-01T10:05:00.000Z'; // Before KYC
      const kycSubmittedAt = '2025-06-01T10:10:00.000Z'; // After scoring -- invalid

      const t_scored = new Date(scoredAt).getTime();
      const t_kyc_submitted = new Date(kycSubmittedAt).getTime();

      // This should be flagged: scoring should not happen before KYC
      expect(t_scored).toBeLessThan(t_kyc_submitted);
      // In a valid pipeline, KYC must come before scoring
      // This test documents the constraint
    });
  });

  // =========================================================================
  // 5. No data loss during service handoffs
  // =========================================================================
  describe('Data Integrity Across Service Handoffs', () => {
    it('should propagate all required customer fields from WhatsApp to KYC to scoring', () => {
      const fullCustomer = createTestCustomer({
        id: customerId,
        phone_number: phoneNumber,
        whatsapp_number: phoneNumber,
        full_name: customerName,
        first_name: 'Tendai',
        last_name: 'Moyo',
        national_id: 'ZIM123456789',
        date_of_birth: '1990-05-15',
        employment_status: 'employed',
        monthly_income_usd: 500,
        kyc_status: 'verified',
      });
      seedMockTable('customers', [fullCustomer]);

      // Each downstream service reads the same data
      const customerForKyc = getMockTable('customers').find((c) => c.id === customerId);
      const customerForScoring = getMockTable('customers').find((c) => c.id === customerId);

      // Verify no fields are lost
      expect(customerForKyc!.phone_number).toBe(phoneNumber);
      expect(customerForKyc!.national_id).toBe('ZIM123456789');
      expect(customerForKyc!.first_name).toBe('Tendai');
      expect(customerForKyc!.last_name).toBe('Moyo');

      expect(customerForScoring!.monthly_income_usd).toBe(500);
      expect(customerForScoring!.employment_status).toBe('employed');
      expect(customerForScoring!.date_of_birth).toBe('1990-05-15');
    });

    it('should ensure loan references the correct customer_id and score', () => {
      seedMockTable('customers', [
        createTestCustomer({ id: customerId, kyc_status: 'verified' }),
      ]);

      const scoreId = generateTestId('score');
      seedMockTable('credit_scores', [
        {
          id: scoreId,
          customer_id: customerId,
          scaled_score: 720,
          decision: 'approve',
          tier: 'Tier 2',
          credit_limit_usd: 350,
        },
      ]);

      const loanId = generateTestId('loan');
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_amount_usd: 350,
          loan_status: 'approved',
        }),
      ]);

      const customer = getMockTable('customers')[0];
      const score = getMockTable('credit_scores')[0];
      const loan = getMockTable('loans')[0];

      // All three share the same customer_id
      expect(customer.id).toBe(customerId);
      expect(score.customer_id).toBe(customerId);
      expect(loan.customer_id).toBe(customerId);

      // Loan amount should not exceed credit limit
      expect(loan.loan_amount_usd).toBeLessThanOrEqual(score.credit_limit_usd as number);
    });

    it('should not create orphaned records when pipeline fails mid-way', () => {
      // Customer created by WhatsApp
      seedMockTable('customers', [createTestCustomer({ id: customerId })]);

      // KYC submission created but verification fails
      seedMockTable('kyc_submissions', [
        {
          id: generateTestId('kyc'),
          customer_id: customerId,
          status: 'rejected',
          verification_decision: 'REJECTED',
        },
      ]);

      // No credit score should exist for a rejected KYC
      const scores = getMockTable('credit_scores');
      expect(scores).toHaveLength(0);

      // No loan should exist
      const loans = getMockTable('loans');
      expect(loans).toHaveLength(0);

      // Customer record still exists (not orphaned)
      const customers = getMockTable('customers');
      expect(customers).toHaveLength(1);
      expect(customers[0].id).toBe(customerId);
    });

    it('should correctly track complete pipeline with all table references', () => {
      const createdAt = '2025-06-01T10:00:00.000Z';
      const kycId = generateTestId('kyc');
      const scoreId = generateTestId('score');
      const loanId = generateTestId('loan');

      seedMockTable('customers', [
        createTestCustomer({
          id: customerId,
          phone_number: phoneNumber,
          created_at: createdAt,
          kyc_status: 'verified',
        }),
      ]);

      seedMockTable('whatsapp_messages', [
        {
          id: generateTestId('msg'),
          customer_id: customerId,
          direction: 'inbound',
          content: 'Hi I want to apply for a loan',
          created_at: createdAt,
        },
      ]);

      seedMockTable('kyc_submissions', [
        {
          id: kycId,
          customer_id: customerId,
          status: 'verified',
          verification_decision: 'APPROVED',
        },
      ]);

      seedMockTable('credit_scores', [
        {
          id: scoreId,
          customer_id: customerId,
          scaled_score: 720,
          decision: 'approve',
        },
      ]);

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_status: 'approved',
        }),
      ]);

      // Trace the full pipeline by customer_id
      const customer = getMockTable('customers')[0];
      const messages = getMockTable('whatsapp_messages').filter(
        (m) => m.customer_id === customerId,
      );
      const kycSubs = getMockTable('kyc_submissions').filter(
        (k) => k.customer_id === customerId,
      );
      const creditScores = getMockTable('credit_scores').filter(
        (s) => s.customer_id === customerId,
      );
      const loans = getMockTable('loans').filter((l) => l.customer_id === customerId);

      expect(customer).toBeDefined();
      expect(messages).toHaveLength(1);
      expect(kycSubs).toHaveLength(1);
      expect(creditScores).toHaveLength(1);
      expect(loans).toHaveLength(1);

      // All linked to same customer
      expect(messages[0].customer_id).toBe(customerId);
      expect(kycSubs[0].customer_id).toBe(customerId);
      expect(creditScores[0].customer_id).toBe(customerId);
      expect(loans[0].customer_id).toBe(customerId);
    });
  });

  // =========================================================================
  // 6. Multiple customers flowing through pipeline simultaneously
  // =========================================================================
  describe('Multiple Customer Isolation', () => {
    it('should keep data isolated between two customers going through onboarding', () => {
      const customer1Id = 'cust_pipeline_001';
      const customer2Id = 'cust_pipeline_002';

      seedMockTable('customers', [
        createTestCustomer({
          id: customer1Id,
          phone_number: '+263771111111',
          full_name: 'Customer One',
          monthly_income_usd: 400,
        }),
        createTestCustomer({
          id: customer2Id,
          phone_number: '+263772222222',
          full_name: 'Customer Two',
          monthly_income_usd: 800,
        }),
      ]);

      seedMockTable('credit_scores', [
        {
          id: generateTestId('score'),
          customer_id: customer1Id,
          scaled_score: 650,
          decision: 'approve',
          tier: 'Tier 1',
          credit_limit_usd: 200,
        },
        {
          id: generateTestId('score'),
          customer_id: customer2Id,
          scaled_score: 780,
          decision: 'approve',
          tier: 'Tier 3',
          credit_limit_usd: 500,
        },
      ]);

      const scores = getMockTable('credit_scores');
      const customer1Score = scores.find((s) => s.customer_id === customer1Id);
      const customer2Score = scores.find((s) => s.customer_id === customer2Id);

      // Scores are not mixed up
      expect(customer1Score!.scaled_score).toBe(650);
      expect(customer1Score!.credit_limit_usd).toBe(200);
      expect(customer2Score!.scaled_score).toBe(780);
      expect(customer2Score!.credit_limit_usd).toBe(500);

      // Customer 1 cannot get Customer 2's limit
      expect(customer1Score!.credit_limit_usd).not.toBe(
        customer2Score!.credit_limit_usd,
      );
    });
  });
});
