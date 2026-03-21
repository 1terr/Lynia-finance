/**
 * Unit Tests: Amount Selection State Handler
 *
 * Tests the amount_selection onboarding state where digital credit
 * applicants choose their loan amount within approved limits.
 */

import { handleAmountSelection } from '../amount-selection';
import type { OnboardingSession, MessageContext } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateSession = jest.fn();
jest.mock('../../session', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

jest.mock('../../../../../shared/utils/loan-calculator', () => ({
  getAllowedTerms: jest.fn((tier: string) => {
    switch (tier) {
      case 'Tier 3': return [6, 12, 18];
      case 'Tier 2': return [6, 12];
      case 'Tier 1':
      default: return [6, 12];
    }
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'amount_selection',
    state_data: {
      selected_product: 'digital_credit',
      preferred_language: 'en',
      credit_limit_usd: 500,
      credit_tier: 'Tier 1',
      org_lending_limits: {
        max_loan_amount: 500,
        min_loan_amount: 20,
        interest_rate_monthly: 2,
        interest_rate_apr: 24,
        min_term_months: 1,
        max_term_months: 6,
      },
      ...overrides,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
  };
}

function makeContext(message: string): MessageContext {
  return { from: '+263771234567', message, messageId: 'msg-1', timestamp: Date.now() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleAmountSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Valid amount within range
  // -----------------------------------------------------------------------

  it('accepts valid amount within range and transitions to term_selection', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('250'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'term_selection',
        state_data: expect.objectContaining({
          requested_loan_amount: 250,
        }),
      })
    );

    expect(result).toContain('$250.00');
    expect(result).toContain('How long would you like to pay');
  });

  it('stores allowed_terms from tier+org range in state_data', async () => {
    await handleAmountSelection(makeSession(), makeContext('200'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          allowed_terms: expect.any(Array),
        }),
      })
    );

    const stateData = mockUpdateSession.mock.calls[0][1].state_data;
    // Tier 1 returns [6, 12], org range is 1-6, so only 6 fits
    expect(stateData.allowed_terms).toContain(6);
  });

  // -----------------------------------------------------------------------
  // Amount below minimum
  // -----------------------------------------------------------------------

  it('rejects amount below minimum ($20) with helpful message', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('10'));

    expect(result).toContain('minimum');
    expect(result).toContain('20.00');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('rejects amount below custom org minimum', async () => {
    const session = makeSession({
      org_lending_limits: {
        max_loan_amount: 500,
        min_loan_amount: 50,
        interest_rate_monthly: 2,
        interest_rate_apr: 24,
        min_term_months: 1,
        max_term_months: 6,
      },
    });

    const result = await handleAmountSelection(session, makeContext('30'));

    expect(result).toContain('minimum');
    expect(result).toContain('50.00');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Amount above credit limit
  // -----------------------------------------------------------------------

  it('rejects amount above credit limit with personalized max', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('600'));

    expect(result).toContain('maximum');
    expect(result).toContain('500.00');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('uses credit_limit_usd when lower than org max', async () => {
    const session = makeSession({
      credit_limit_usd: 300,
      org_lending_limits: {
        max_loan_amount: 500,
        min_loan_amount: 20,
        interest_rate_monthly: 2,
        interest_rate_apr: 24,
        min_term_months: 1,
        max_term_months: 6,
      },
    });

    const result = await handleAmountSelection(session, makeContext('400'));

    expect(result).toContain('maximum');
    expect(result).toContain('300.00');
  });

  // -----------------------------------------------------------------------
  // Amount above org-specific limit
  // -----------------------------------------------------------------------

  it('rejects amount above org-specific limit when no credit_limit_usd', async () => {
    const session = makeSession({
      credit_limit_usd: undefined,
      org_lending_limits: {
        max_loan_amount: 350,
        min_loan_amount: 20,
        interest_rate_monthly: 2,
        interest_rate_apr: 24,
        min_term_months: 1,
        max_term_months: 6,
      },
    });

    const result = await handleAmountSelection(session, makeContext('400'));

    expect(result).toContain('maximum');
    expect(result).toContain('350.00');
  });

  // -----------------------------------------------------------------------
  // Non-numeric input
  // -----------------------------------------------------------------------

  it('rejects non-numeric input with prompt', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('abc'));

    expect(result).toContain('How much');
    expect(result).toContain('500.00');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('rejects negative amounts', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('-50'));

    expect(result).toContain('How much');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('rejects zero amount', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('0'));

    expect(result).toContain('How much');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // BACK command
  // -----------------------------------------------------------------------

  it('returns to credit_scoring on BACK command', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('back'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'credit_scoring',
        state_data: expect.objectContaining({
          requested_loan_amount: undefined,
        }),
      })
    );

    expect(result).toContain('credit limit');
    expect(result).toContain('$500.00');
  });

  // -----------------------------------------------------------------------
  // Decimal amounts
  // -----------------------------------------------------------------------

  it('accepts decimal amounts and rounds to 2 decimal places', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('199.999'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          requested_loan_amount: 200, // 199.999 rounds to 200.00
        }),
      })
    );

    expect(result).toContain('$200.00');
  });

  it('accepts amount with dollar sign and commas stripped', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('$350'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          requested_loan_amount: 350,
        }),
      })
    );

    expect(result).toContain('$350.00');
  });

  // -----------------------------------------------------------------------
  // Boundary values
  // -----------------------------------------------------------------------

  it('accepts amount exactly at minimum boundary', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('20'));

    expect(mockUpdateSession).toHaveBeenCalled();
    expect(result).toContain('$20.00');
    expect(result).toContain('How long');
  });

  it('accepts amount exactly at maximum boundary', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('500'));

    expect(mockUpdateSession).toHaveBeenCalled();
    expect(result).toContain('$500.00');
    expect(result).toContain('How long');
  });

  // -----------------------------------------------------------------------
  // Currency formatting in response
  // -----------------------------------------------------------------------

  it('formats response with dollar sign and 2 decimal places', async () => {
    const result = await handleAmountSelection(makeSession(), makeContext('100'));

    expect(result).toContain('$100.00');
  });

  // -----------------------------------------------------------------------
  // Term list in response
  // -----------------------------------------------------------------------

  it('shows term options in response message', async () => {
    const session = makeSession({
      credit_tier: 'Tier 2',
      org_lending_limits: {
        max_loan_amount: 500,
        min_loan_amount: 20,
        interest_rate_monthly: 2,
        interest_rate_apr: 24,
        min_term_months: 1,
        max_term_months: 12,
      },
    });

    const result = await handleAmountSelection(session, makeContext('250'));

    expect(result).toContain('month');
    expect(result).toContain('Back');
  });

  // -----------------------------------------------------------------------
  // Fallback defaults
  // -----------------------------------------------------------------------

  it('uses default max 500 when no credit_limit_usd or org limits', async () => {
    const session = makeSession({
      credit_limit_usd: undefined,
      org_lending_limits: undefined,
    });

    const result = await handleAmountSelection(session, makeContext('600'));

    expect(result).toContain('maximum');
    expect(result).toContain('500.00');
  });

  it('uses default min 20 when org_lending_limits is undefined', async () => {
    const session = makeSession({
      org_lending_limits: undefined,
    });

    const result = await handleAmountSelection(session, makeContext('10'));

    expect(result).toContain('minimum');
    expect(result).toContain('20.00');
  });
});
