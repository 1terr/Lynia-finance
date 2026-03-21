/**
 * Tests for WhatsApp PAY command (handlePay via routeLoanCommand)
 *
 * The handlePay function:
 *  1. Looks up customer by phone from customers table
 *  2. Gets active loan with specific fields from loans table
 *  3. Gets installment amount: loan.next_payment_amount_usd || loan.monthly_installment_amount
 *  4. Calls fetch() to payment API with x-api-key header and JSON body
 *  5. Calls auditLogEntry() for audit trail
 *  6. Returns USSD instructions with merchant code and amount
 */

// ===================================================================
// MOCKS
// ===================================================================

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
};
const mockDb = { from: jest.fn(() => ({ ...mockQueryBuilder })) };
jest.mock('../../../shared/clients/database', () => ({ db: mockDb }));

jest.mock('../../../shared/clients/fineract-sync', () => ({
  getFineractLoanBalance: jest.fn().mockResolvedValue(null),
  getFineractRepaymentSchedule: jest.fn().mockResolvedValue(null),
}));

const mockAuditLogEntry = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../shared/utils/audit', () => ({
  auditLogEntry: mockAuditLogEntry,
}));

import { routeLoanCommand } from '../loan-commands';

// ===================================================================
// HELPERS
// ===================================================================

function setupDbResponses(responses: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0;
  mockDb.from.mockImplementation(() => {
    const response = responses[callIndex] || { data: null, error: null };
    callIndex++;
    return {
      ...mockQueryBuilder,
      execute: jest.fn().mockResolvedValue(response),
    };
  });
}

const PHONE = '+263771234567';

const BASE_CUSTOMER = { id: 'cust-1', first_name: 'Tendai' };

const BASE_LOAN = {
  id: 'loan-1',
  loan_reference: 'LN-PAY-001',
  next_payment_amount_usd: 75.5,
  monthly_installment_amount: 50,
  total_amount_due: 600,
  total_amount_paid: 200,
  outstanding_balance_usd: 400,
};

// ===================================================================
// TESTS
// ===================================================================

describe('WhatsApp PAY Command', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;
    process.env.API_BASE_URL = 'https://api.test.lynia.finance';
    process.env.INTERNAL_API_KEY = 'test-api-key-secret';
    process.env.ECOCASH_MERCHANT_CODE = '123456';

    mockDb.from.mockImplementation(() => ({
      ...mockQueryBuilder,
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.API_BASE_URL;
    delete process.env.INTERNAL_API_KEY;
    delete process.env.ECOCASH_MERCHANT_CODE;
  });

  it('should return "Account not found" when customer is not in DB', async () => {
    setupDbResponses([
      { data: [], error: null },       // rate limit check
      { data: null, error: null },      // command log insert
      { data: null, error: null },      // customer lookup - not found
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain('Account not found');
  });

  it('should return "no active loans" when no loans match', async () => {
    setupDbResponses([
      { data: [], error: null },          // rate limit check
      { data: null, error: null },         // command log insert
      { data: BASE_CUSTOMER, error: null },// customer lookup
      { data: null, error: null },         // loan lookup - not found
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain('Tendai');
    expect(result).toContain("don't have any active loans");
  });

  it('should calculate installment from next_payment_amount_usd when available', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: { ...BASE_LOAN, next_payment_amount_usd: 75.5, monthly_installment_amount: 50 }, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain('$75.50');
    expect(result).not.toContain('$50.00');
  });

  it('should fall back to monthly_installment_amount when next_payment_amount_usd is null', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: { ...BASE_LOAN, next_payment_amount_usd: null, monthly_installment_amount: 50 }, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain('$50.00');
  });

  it('should return "couldn\'t determine payment amount" when both amounts are null', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      {
        data: { ...BASE_LOAN, next_payment_amount_usd: null, monthly_installment_amount: null },
        error: null,
      },
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain("couldn't determine");
    expect(result).toContain('support@lynia.finance');
  });

  it('should return "couldn\'t determine payment amount" when both amounts are zero', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      {
        data: { ...BASE_LOAN, next_payment_amount_usd: 0, monthly_installment_amount: 0 },
        error: null,
      },
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain("couldn't determine");
  });

  it('should call fetch with correct payment API URL and body', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    await routeLoanCommand(PHONE, 'PAY');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.lynia.finance/api/v1/payments/initiate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          loan_id: 'loan-1',
          customer_id: 'cust-1',
          amount: 75.5,
          customer_phone: PHONE,
          payment_type: 'repayment',
          currency: 'USD',
        }),
      })
    );
  });

  it('should include x-api-key header on fetch', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    await routeLoanCommand(PHONE, 'PAY');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'test-api-key-secret',
        }),
      })
    );
  });

  it('should show USSD instructions even when fetch fails (fallback)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain('EcoCash');
    expect(result).toContain('OneMoney');
    expect(result).toContain('$75.50');
  });

  it('should format amounts with 2 decimal places', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: { ...BASE_LOAN, next_payment_amount_usd: 100, outstanding_balance_usd: 350 }, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain('$100.00');
    expect(result).toContain('$350.00');
  });

  it('should use ECOCASH_MERCHANT_CODE env var in USSD string', async () => {
    process.env.ECOCASH_MERCHANT_CODE = '999888';

    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain('*151*2*1*999888*');
    expect(result).toContain('*111*3*999888*');
  });

  it('should default merchant code to 171717 when env var is not set', async () => {
    delete process.env.ECOCASH_MERCHANT_CODE;

    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    expect(result).toContain('*151*2*1*171717*');
    expect(result).toContain('*111*3*171717*');
  });

  it('should call auditLogEntry with correct params', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    await routeLoanCommand(PHONE, 'PAY');

    // auditLogEntry is fire-and-forget (.catch(() => {})), give it a tick
    await new Promise((r) => setTimeout(r, 10));

    expect(mockAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'cust-1',
        userType: 'customer',
        action: 'payment.initiated',
        entityType: 'loan',
        entityId: 'loan-1',
        description: expect.stringContaining('$75.50'),
        changes: expect.objectContaining({
          amount: 75.5,
          payment_type: 'repayment',
          channel: 'whatsapp',
        }),
      })
    );
  });

  it('should handle database errors gracefully on customer lookup', async () => {
    setupDbResponses([
      { data: [], error: null },       // rate limit
      { data: null, error: null },      // command log
      { data: null, error: { message: 'DB error' } }, // customer lookup fails
    ]);

    const result = await routeLoanCommand(PHONE, 'PAY');

    // When data is null, returns Account not found
    expect(result).toContain('Account not found');
  });
});
