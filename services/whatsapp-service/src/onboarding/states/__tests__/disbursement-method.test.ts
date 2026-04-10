/**
 * Unit Tests: Disbursement Method Selection State Handler
 *
 * Tests the disbursement_method_selection onboarding state where
 * digital credit applicants choose how to receive their funds.
 */

import { handleDisbursementMethodSelection } from '../disbursement-method';
import type { OnboardingSession, MessageContext, ButtonsResponse } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateSession = jest.fn();
jest.mock('../../session', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'disbursement_method_selection',
    state_data: {
      selected_product: 'digital_credit',
      preferred_language: 'en',
      requested_loan_amount: 300,
      financed_amount: 300,
      selected_term_months: 6,
      monthly_payment: 55.0,
      total_repayment: 330.0,
      interest_rate_apr: 24,
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

describe('handleDisbursementMethodSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Method selection
  // -----------------------------------------------------------------------

  it('selects EcoCash when user replies "1"', async () => {
    const result = await handleDisbursementMethodSelection(makeSession(), makeContext('1'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          disbursement_method: 'ecocash',
        }),
      })
    );

    expect(result).toContain('EcoCash');
    expect(result).toContain('+263771234567');
  });

  it('selects EcoCash when user types "ecocash"', async () => {
    const result = await handleDisbursementMethodSelection(makeSession(), makeContext('ecocash'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          disbursement_method: 'ecocash',
        }),
      })
    );

    expect(result).toContain('EcoCash');
  });

  it('selects OneMoney when user replies "2"', async () => {
    const result = await handleDisbursementMethodSelection(makeSession(), makeContext('2'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          disbursement_method: 'onemoney',
        }),
      })
    );

    expect(result).toContain('OneMoney');
  });

  it('selects OneMoney when user types "one money"', async () => {
    await handleDisbursementMethodSelection(makeSession(), makeContext('one money'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          disbursement_method: 'onemoney',
        }),
      })
    );
  });

  it('selects InnBucks when user replies "3"', async () => {
    const result = await handleDisbursementMethodSelection(makeSession(), makeContext('3'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          disbursement_method: 'innbucks',
        }),
      })
    );

    expect(result).toContain('InnBucks');
  });

  it('selects InnBucks when user types "innbucks"', async () => {
    await handleDisbursementMethodSelection(makeSession(), makeContext('innbucks'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          disbursement_method: 'innbucks',
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // Invalid method selection — now returns interactive buttons
  // -----------------------------------------------------------------------

  it('returns interactive method buttons for invalid option', async () => {
    const result = await handleDisbursementMethodSelection(makeSession(), makeContext('4')) as ButtonsResponse;

    expect(result).toMatchObject({
      type: 'buttons',
      body: expect.stringContaining('How would you like to receive'),
      buttons: expect.arrayContaining([
        expect.objectContaining({ title: 'EcoCash' }),
        expect.objectContaining({ title: 'OneMoney' }),
        expect.objectContaining({ title: 'InnBucks' }),
      ]),
    });
    // Should NOT update session for invalid input
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('returns interactive buttons for random text (paypal)', async () => {
    const result = await handleDisbursementMethodSelection(makeSession(), makeContext('paypal'));

    expect(result).toMatchObject({ type: 'buttons' });
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Phone confirmation: "Yes" uses session phone
  // -----------------------------------------------------------------------

  it('confirms with session phone when user replies "Yes"', async () => {
    const session = makeSession({
      disbursement_method: 'ecocash',
      // No disbursement_phone yet — triggers phone confirmation sub-state
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('Yes'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'terms_acceptance',
        state_data: expect.objectContaining({
          disbursement_phone: '+263771234567',
        }),
      })
    );

    // Should show digital terms
    expect(result).toContain('Loan Terms');
  });

  it('confirms with session phone when user replies "hongu" (Shona)', async () => {
    const session = makeSession({
      disbursement_method: 'ecocash',
      preferred_language: 'sn',
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('hongu'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'terms_acceptance',
        state_data: expect.objectContaining({
          disbursement_phone: '+263771234567',
        }),
      })
    );
  });

  it('confirms with session phone when user replies "yebo" (Ndebele)', async () => {
    const session = makeSession({
      disbursement_method: 'onemoney',
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('yebo'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'terms_acceptance',
        state_data: expect.objectContaining({
          disbursement_phone: '+263771234567',
        }),
      })
    );
  });

  it('confirms with session phone when user replies "confirm"', async () => {
    const session = makeSession({
      disbursement_method: 'innbucks',
    });

    await handleDisbursementMethodSelection(session, makeContext('confirm'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'terms_acceptance',
        state_data: expect.objectContaining({
          disbursement_phone: '+263771234567',
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // Phone confirmation: entering a different phone number
  // -----------------------------------------------------------------------

  it('stores different phone number when valid Zimbabwe number entered', async () => {
    const session = makeSession({
      disbursement_method: 'ecocash',
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('+263779876543'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'terms_acceptance',
        state_data: expect.objectContaining({
          disbursement_phone: '+263779876543',
        }),
      })
    );

    expect(result).toContain('Loan Terms');
  });

  it('accepts local format phone number (07XXXXXXXX)', async () => {
    const session = makeSession({
      disbursement_method: 'onemoney',
    });

    await handleDisbursementMethodSelection(session, makeContext('0779876543'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'terms_acceptance',
        state_data: expect.objectContaining({
          disbursement_phone: '0779876543',
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // Invalid phone number format
  // -----------------------------------------------------------------------

  it('rejects invalid phone number format and re-prompts', async () => {
    const session = makeSession({
      disbursement_method: 'ecocash',
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('12345'));

    // Should re-show the phone confirmation prompt
    expect(result).toContain('+263771234567');
    expect(result).toContain('correct');
    // Should NOT transition
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('rejects non-Zimbabwe phone number', async () => {
    const session = makeSession({
      disbursement_method: 'ecocash',
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('+27821234567'));

    expect(result).toContain('+263771234567');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // BACK command from method selection
  // -----------------------------------------------------------------------

  it('returns to loan_summary on BACK command from method selection', async () => {
    const session = makeSession({
      financed_amount: 300,
      selected_term_months: 6,
      monthly_payment: 55.0,
      total_repayment: 330.0,
      interest_rate_apr: 24,
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('back'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'loan_summary',
        state_data: expect.objectContaining({
          disbursement_method: undefined,
          disbursement_phone: undefined,
        }),
      })
    );

    // Should re-show the loan summary
    expect(result).toContain('Loan Summary');
    expect(result).toContain('$300.00');
    expect(result).toContain('$55.00');
  });

  // -----------------------------------------------------------------------
  // BACK command from phone confirmation sub-state — returns interactive buttons
  // -----------------------------------------------------------------------

  it('returns interactive method buttons on BACK from phone confirmation', async () => {
    const session = makeSession({
      disbursement_method: 'ecocash',
      // No disbursement_phone — in phone confirmation sub-state
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('back')) as ButtonsResponse;

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          disbursement_method: undefined,
        }),
      })
    );

    // Should show interactive method selection buttons
    expect(result).toMatchObject({
      type: 'buttons',
      body: expect.stringContaining('How would you like to receive'),
    });
  });

  // -----------------------------------------------------------------------
  // Digital terms content
  // -----------------------------------------------------------------------

  it('shows loan terms with correct amount and method after phone confirmation', async () => {
    const session = makeSession({
      disbursement_method: 'ecocash',
      financed_amount: 300,
      selected_term_months: 6,
      monthly_payment: 55.0,
      interest_rate_apr: 24,
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('yes'));

    expect(result).toContain('300.00');
    expect(result).toContain('EcoCash');
    expect(result).toContain('6');
    expect(result).toContain('55.00');
    expect(result).toContain('24');
    expect(result).toContain('I Accept');
  });

  // -----------------------------------------------------------------------
  // Loan summary content on BACK
  // -----------------------------------------------------------------------

  it('re-shows loan summary with interest rate on BACK', async () => {
    const session = makeSession({
      financed_amount: 500,
      selected_term_months: 12,
      monthly_payment: 46.67,
      total_repayment: 560.0,
      interest_rate_apr: 24,
    });

    const result = await handleDisbursementMethodSelection(session, makeContext('back'));

    expect(result).toContain('$500.00');
    expect(result).toContain('12 months');
    expect(result).toContain('24% APR');
    expect(result).toContain('$46.67');
    expect(result).toContain('$560.00');
  });
});
