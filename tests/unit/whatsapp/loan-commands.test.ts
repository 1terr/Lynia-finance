/**
 * Tests for WhatsApp Loan Management Commands (P3-T015)
 *
 * Covers:
 *   - parseCommand() - Exact match, alias, fuzzy matching, case insensitivity
 *   - checkRateLimit() - Database-backed rate limiting with fail-open behavior
 *   - routeLoanCommand() - Main command router with rate limiting
 *   - handleBalance() - Customer/loan lookup and formatted balance response
 *   - handleHelp() - Static help menu response
 */

// ===================================================================
// MOCKS
// ===================================================================

// Mock database client
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
jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

// Mock Fineract sync client (not needed for most tests)
jest.mock('../../../services/shared/clients/fineract-sync', () => ({
  getFineractLoanBalance: jest.fn().mockResolvedValue(null),
  getFineractRepaymentSchedule: jest.fn().mockResolvedValue(null),
}));

import {
  parseCommand,
  checkRateLimit,
  routeLoanCommand,
} from '../../../services/whatsapp-service/src/loan-commands';

// ===================================================================
// HELPERS
// ===================================================================

/**
 * Configure mockDb.from to return specific data for sequential calls.
 * Each entry in the array represents one chained query result.
 */
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

// ===================================================================
// TESTS
// ===================================================================

describe('WhatsApp Loan Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock behavior
    mockDb.from.mockImplementation(() => ({
      ...mockQueryBuilder,
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));
  });

  // -----------------------------------------------------------------
  // parseCommand()
  // -----------------------------------------------------------------
  describe('parseCommand', () => {
    it('should match exact command "BALANCE" (case insensitive)', () => {
      expect(parseCommand('BALANCE')).toEqual({ command: 'BALANCE' });
    });

    it('should match lowercase command "balance"', () => {
      expect(parseCommand('balance')).toEqual({ command: 'BALANCE' });
    });

    it('should match mixed case "Balance"', () => {
      expect(parseCommand('Balance')).toEqual({ command: 'BALANCE' });
    });

    it('should match alias "bal" to BALANCE', () => {
      expect(parseCommand('bal')).toEqual({ command: 'BALANCE' });
    });

    it('should match alias "check" to BALANCE', () => {
      expect(parseCommand('check')).toEqual({ command: 'BALANCE' });
    });

    it('should match alias "owe" to BALANCE', () => {
      expect(parseCommand('owe')).toEqual({ command: 'BALANCE' });
    });

    it('should match fuzzy input "balence" (typo) to BALANCE via Levenshtein', () => {
      // "balence" vs "balance" has Levenshtein distance of 1
      expect(parseCommand('balence')).toEqual({ command: 'BALANCE' });
    });

    it('should fuzzy-match "hello" to HELP (Levenshtein distance 2)', () => {
      // "hello" -> first word "hello", fuzzy match to "help" (distance 2)
      expect(parseCommand('hello world')).toEqual({ command: 'HELP', subCommand: 'world' });
    });

    it('should return null for completely unrecognized input', () => {
      // "xyz" has distance >= 3 to all command aliases
      expect(parseCommand('xyzqwert')).toBeNull();
    });

    it('should extract subCommand when input has extra words', () => {
      // "help me please" -> command: HELP, subCommand: "me please"
      expect(parseCommand('help me please')).toEqual({ command: 'HELP', subCommand: 'me please' });
    });

    it('should extract subCommand for SETTLE YES', () => {
      expect(parseCommand('settle yes')).toEqual({ command: 'SETTLE', subCommand: 'yes' });
    });

    it('should extract subCommand for EXTENSION YES', () => {
      expect(parseCommand('extension yes')).toEqual({ command: 'EXTENSION', subCommand: 'yes' });
    });

    it('should match multi-word alias "pay off" to SETTLE', () => {
      expect(parseCommand('pay off')).toEqual({ command: 'SETTLE' });
    });

    it('should match multi-word alias "early payoff" to SETTLE', () => {
      expect(parseCommand('early payoff')).toEqual({ command: 'SETTLE' });
    });

    it('should match "history" to HISTORY', () => {
      expect(parseCommand('history')).toEqual({ command: 'HISTORY' });
    });

    it('should match alias "payments" to HISTORY', () => {
      expect(parseCommand('payments')).toEqual({ command: 'HISTORY' });
    });

    it('should match "schedule" to SCHEDULE', () => {
      expect(parseCommand('schedule')).toEqual({ command: 'SCHEDULE' });
    });

    it('should match "?" to HELP', () => {
      expect(parseCommand('?')).toEqual({ command: 'HELP' });
    });

    it('should trim whitespace before matching', () => {
      expect(parseCommand('  balance  ')).toEqual({ command: 'BALANCE' });
    });
  });

  // -----------------------------------------------------------------
  // checkRateLimit()
  // -----------------------------------------------------------------
  describe('checkRateLimit', () => {
    it('should allow command when under rate limit (< 10 messages)', async () => {
      setupDbResponses([
        { data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null },
      ]);

      const allowed = await checkRateLimit('+263771234567');
      expect(allowed).toBe(true);
    });

    it('should deny command when at rate limit (>= 10 messages)', async () => {
      const tenMessages = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      setupDbResponses([{ data: tenMessages, error: null }]);

      const allowed = await checkRateLimit('+263771234567');
      expect(allowed).toBe(false);
    });

    it('should fail open when database query throws an error', async () => {
      mockDb.from.mockImplementation(() => ({
        ...mockQueryBuilder,
        execute: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      }));

      const allowed = await checkRateLimit('+263771234567');
      expect(allowed).toBe(true);
    });

    it('should allow command when no messages found (null data)', async () => {
      setupDbResponses([{ data: null, error: null }]);

      const allowed = await checkRateLimit('+263771234567');
      expect(allowed).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // routeLoanCommand()
  // -----------------------------------------------------------------
  describe('routeLoanCommand', () => {
    it('should return null for unrecognized messages', async () => {
      // Use a string whose first word has Levenshtein distance >= 3 from all commands
      const result = await routeLoanCommand('+263771234567', 'xyzqwert something');
      expect(result).toBeNull();
    });

    it('should return help menu for HELP command', async () => {
      // First call: rate limit check (allow), second call: log insert
      setupDbResponses([
        { data: [], error: null },
        { data: null, error: null },
      ]);

      const result = await routeLoanCommand('+263771234567', 'HELP');

      expect(result).not.toBeNull();
      expect(result).toContain('BALANCE');
      expect(result).toContain('HISTORY');
      expect(result).toContain('SCHEDULE');
      expect(result).toContain('DEVICE');
      expect(result).toContain('HELP');
    });

    it('should return rate limit warning when over limit', async () => {
      const tenMessages = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      setupDbResponses([{ data: tenMessages, error: null }]);

      const result = await routeLoanCommand('+263771234567', 'BALANCE');

      expect(result).not.toBeNull();
      expect(result).toContain('too many commands');
    });

    it('should return "Account not found" when customer does not exist for BALANCE', async () => {
      // Call 1: rate limit (allow)
      // Call 2: log command insert
      // Call 3: customer lookup (not found)
      setupDbResponses([
        { data: [], error: null },
        { data: null, error: null },
        { data: null, error: null },
      ]);

      const result = await routeLoanCommand('+263771234567', 'BALANCE');

      expect(result).toContain('Account not found');
    });

    it('should return formatted balance when customer has active loan', async () => {
      // Call 1: rate limit (allow)
      // Call 2: log command insert
      // Call 3: customer lookup
      // Call 4: loan lookup
      setupDbResponses([
        { data: [], error: null },
        { data: null, error: null },
        {
          data: { id: 'cust-1', first_name: 'Tendai' },
          error: null,
        },
        {
          data: {
            id: 'loan-1',
            loan_reference: 'LN-001',
            device_model: 'Samsung A14',
            total_amount_due: 500,
            total_amount_paid: 200,
            monthly_installment_amount: 50,
            next_payment_date: '2026-03-15',
          },
          error: null,
        },
      ]);

      const result = await routeLoanCommand('+263771234567', 'BALANCE');

      expect(result).not.toBeNull();
      expect(result).toContain('Tendai');
      expect(result).toContain('LN-001');
      expect(result).toContain('$500.00');
      expect(result).toContain('$200.00');
      expect(result).toContain('$300.00');
    });

    it('should return no active loans message when customer has no loan', async () => {
      setupDbResponses([
        { data: [], error: null },
        { data: null, error: null },
        {
          data: { id: 'cust-1', first_name: 'Tendai' },
          error: null,
        },
        { data: null, error: null },
      ]);

      const result = await routeLoanCommand('+263771234567', 'BALANCE');

      expect(result).not.toBeNull();
      expect(result).toContain('Tendai');
      expect(result).toContain("don't have any active loans");
    });
  });

  // -----------------------------------------------------------------
  // handleHelp() (via routeLoanCommand)
  // -----------------------------------------------------------------
  describe('handleHelp', () => {
    it('should include all available command names in help output', async () => {
      setupDbResponses([
        { data: [], error: null },
        { data: null, error: null },
      ]);

      const result = await routeLoanCommand('+263771234567', 'help');

      expect(result).toContain('BALANCE');
      expect(result).toContain('HISTORY');
      expect(result).toContain('SCHEDULE');
      expect(result).toContain('DEVICE');
      expect(result).toContain('UPDATE');
      expect(result).toContain('EXTENSION');
      expect(result).toContain('HELP');
    });
  });
});
