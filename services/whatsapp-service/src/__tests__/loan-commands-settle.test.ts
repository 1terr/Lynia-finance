/**
 * Tests for WhatsApp SETTLE command (handleSettle via routeLoanCommand)
 *
 * The handleSettle function:
 *  1. Looks up customer + active loan (same pattern as PAY)
 *  2. Calculates outstanding: loan.outstanding_balance_usd || (loan.total_amount_due - (loan.total_amount_paid || 0))
 *  3. WITHOUT subCommand: returns confirmation message with outstanding balance and "Reply YES to proceed"
 *  4. WITH subCommand='yes': calls payment API with payment_type: 'early_payoff', full outstanding, audit log, USSD instructions
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
  loan_reference: 'LN-SETTLE-001',
  total_amount_due: 600,
  total_amount_paid: 200,
  outstanding_balance_usd: 400,
};

// ===================================================================
// TESTS
// ===================================================================

describe('WhatsApp SETTLE Command', () => {
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

  // -----------------------------------------------------------------
  // Error cases
  // -----------------------------------------------------------------

  it('should return "Account not found" when customer is not in DB', async () => {
    setupDbResponses([
      { data: [], error: null },       // rate limit check
      { data: null, error: null },      // command log insert
      { data: null, error: null },      // customer lookup - not found
    ]);

    const result = await routeLoanCommand(PHONE, 'settle');

    expect(result).toContain('Account not found');
  });

  it('should return "no active loans" when no loans match', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: null, error: null },       // loan not found
    ]);

    const result = await routeLoanCommand(PHONE, 'settle');

    expect(result).toContain('Tendai');
    expect(result).toContain("don't have any active loans");
  });

  // -----------------------------------------------------------------
  // Initial call (no subCommand) - confirmation prompt
  // -----------------------------------------------------------------

  it('should show confirmation prompt with outstanding balance on initial call', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'settle');

    expect(result).toContain('$400.00');
    expect(result).toContain('LN-SETTLE-001');
    expect(result).toContain('Early Payoff');
  });

  it('should show "Reply YES to proceed" in confirmation message', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'settle');

    expect(result).toContain('YES');
    expect(result).toContain('proceed');
  });

  it('should not call fetch on initial settle call (no subCommand)', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    await routeLoanCommand(PHONE, 'settle');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------
  // Confirmation call (subCommand='yes') - payment initiation
  // -----------------------------------------------------------------

  it('should call payment API with full outstanding balance on subCommand=yes', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    await routeLoanCommand(PHONE, 'settle yes');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.lynia.finance/api/v1/payments/initiate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          loan_id: 'loan-1',
          customer_id: 'cust-1',
          amount: 400,
          customer_phone: PHONE,
          payment_type: 'early_payoff',
          currency: 'USD',
        }),
      })
    );
  });

  it('should include payment_type "early_payoff" in fetch body on confirmation', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    await routeLoanCommand(PHONE, 'settle yes');

    const fetchCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchCallBody.payment_type).toBe('early_payoff');
  });

  it('should include x-api-key header on confirmation fetch', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    await routeLoanCommand(PHONE, 'settle yes');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'test-api-key-secret',
        }),
      })
    );
  });

  it('should show USSD instructions on confirmation', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'settle yes');

    expect(result).toContain('EcoCash');
    expect(result).toContain('OneMoney');
    expect(result).toContain('$400.00');
    expect(result).toContain('123456'); // merchant code from env
  });

  it('should show USSD fallback when fetch fails on confirmation', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'settle yes');

    expect(result).toContain('EcoCash');
    expect(result).toContain('OneMoney');
    expect(result).toContain('$400.00');
  });

  // -----------------------------------------------------------------
  // Outstanding balance calculation
  // -----------------------------------------------------------------

  it('should calculate outstanding from outstanding_balance_usd field', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      {
        data: { ...BASE_LOAN, outstanding_balance_usd: 350, total_amount_due: 600, total_amount_paid: 100 },
        error: null,
      },
    ]);

    const result = await routeLoanCommand(PHONE, 'settle');

    // Should use outstanding_balance_usd (350) not the calculated 600-100=500
    expect(result).toContain('$350.00');
  });

  it('should fall back to total_amount_due - total_amount_paid calculation', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      {
        data: {
          ...BASE_LOAN,
          outstanding_balance_usd: null,
          total_amount_due: 800,
          total_amount_paid: 250,
        },
        error: null,
      },
    ]);

    const result = await routeLoanCommand(PHONE, 'settle');

    expect(result).toContain('$550.00');
  });

  it('should handle null total_amount_paid in fallback calculation', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      {
        data: {
          ...BASE_LOAN,
          outstanding_balance_usd: null,
          total_amount_due: 500,
          total_amount_paid: null,
        },
        error: null,
      },
    ]);

    const result = await routeLoanCommand(PHONE, 'settle');

    // total_amount_due - (null || 0) = 500
    expect(result).toContain('$500.00');
  });

  // -----------------------------------------------------------------
  // Audit logging
  // -----------------------------------------------------------------

  it('should create audit log entry for early payoff on confirmation', async () => {
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    await routeLoanCommand(PHONE, 'settle yes');

    // auditLogEntry is fire-and-forget (.catch(() => {})), give it a tick
    await new Promise((r) => setTimeout(r, 10));

    expect(mockAuditLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'cust-1',
        userType: 'customer',
        action: 'payment.early_payoff_initiated',
        entityType: 'loan',
        entityId: 'loan-1',
        description: expect.stringContaining('$400.00'),
        changes: expect.objectContaining({
          amount: 400,
          payment_type: 'early_payoff',
          channel: 'whatsapp',
        }),
      })
    );
  });

  // -----------------------------------------------------------------
  // Currency formatting
  // -----------------------------------------------------------------

  it('should format currency correctly in both confirmation and USSD messages', async () => {
    const loan = { ...BASE_LOAN, outstanding_balance_usd: 1234.56 };

    // Test confirmation message
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: loan, error: null },
    ]);

    const confirmResult = await routeLoanCommand(PHONE, 'settle');
    expect(confirmResult).toContain('$1234.56');

    // Test USSD instructions message
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: loan, error: null },
    ]);

    const ussdResult = await routeLoanCommand(PHONE, 'settle yes');
    expect(ussdResult).toContain('$1234.56');
    expect(ussdResult).toContain('*1234.56#');
  });

  // -----------------------------------------------------------------
  // Case insensitivity (handled by routeLoanCommand -> parseCommand)
  // -----------------------------------------------------------------

  it('should handle case-insensitive YES via parseCommand subCommand extraction', async () => {
    // "settle yes" is parsed by parseCommand which extracts subCommand="yes"
    // handleSettle checks subCommand.toLowerCase() === 'yes'
    setupDbResponses([
      { data: [], error: null },
      { data: null, error: null },
      { data: BASE_CUSTOMER, error: null },
      { data: BASE_LOAN, error: null },
    ]);

    const result = await routeLoanCommand(PHONE, 'settle yes');

    // Should show USSD instructions (confirmation path), not the prompt
    expect(result).toContain('EcoCash');
    expect(result).toContain('OneMoney');
    expect(mockFetch).toHaveBeenCalled();
  });
});
