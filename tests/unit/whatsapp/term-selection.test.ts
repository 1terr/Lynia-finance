import { handleTermSelection } from '../../../services/whatsapp-service/src/onboarding/states/term-selection';
import type { OnboardingSession, MessageContext } from '../../../services/whatsapp-service/src/onboarding/types';

jest.mock('../../../services/whatsapp-service/src/onboarding/session', () => ({
  updateSession: jest.fn(),
}));

function makeSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'term_selection',
    state_data: {
      credit_tier: 'Standard Product',
      matched_product_min_term: 6,
      matched_product_max_term: 12,
      credit_limit_usd: 500,
      down_payment_percentage: 20,
      interest_rate_apr: 4,
      selected_device_id: 'dev-2',
      selected_device_price: 180,
      selected_device_name: 'Samsung A15',
      allowed_terms: [6, 12],
      ...overrides,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
  };
}

function makeContext(message: string): MessageContext {
  return { from: '+263771234567', message, messageId: 'msg-1', timestamp: Date.now() };
}

describe('handleTermSelection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns error if no allowed_terms in session', async () => {
    const session = makeSession({ allowed_terms: undefined });
    const result = await handleTermSelection(session, makeContext('1'));
    expect(result).toContain('Restart');
  });

  it('re-shows term list for invalid input', async () => {
    const result = await handleTermSelection(makeSession(), makeContext('abc'));
    expect(result).toContain('Please reply with a number');
    expect(result).toContain('6 months');
  });

  it('re-shows term list for out-of-range number', async () => {
    const result = await handleTermSelection(makeSession(), makeContext('5'));
    expect(result).toContain('between 1 and 2');
  });

  it('calculates correct declining balance payment for 6 months', async () => {
    const { updateSession } = require('../../../services/whatsapp-service/src/onboarding/session');

    // Device: $180, 20% down = $36 deposit, $144 financed
    // $144 at 4% APR for 6 months (declining balance)
    const result = await handleTermSelection(makeSession(), makeContext('1'));

    expect(updateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
      current_state: 'loan_summary',
      state_data: expect.objectContaining({
        selected_term_months: 6,
        deposit_amount: 36,
        financed_amount: 144,
      }),
    }));

    expect(result).toContain('Samsung A15');
    expect(result).toContain('$180.00');
    expect(result).toContain('$36.00');
    expect(result).toContain('6 months');
    expect(result).toContain('Monthly Payment');
    expect(result).toContain('Reply *Yes*');
  });

  it('calculates correct declining balance payment for 12 months', async () => {
    const { updateSession } = require('../../../services/whatsapp-service/src/onboarding/session');

    // $144 financed at 4% APR for 12 months
    const result = await handleTermSelection(makeSession(), makeContext('2'));

    expect(updateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
      current_state: 'loan_summary',
      state_data: expect.objectContaining({
        selected_term_months: 12,
        deposit_amount: 36,
        financed_amount: 144,
      }),
    }));

    expect(result).toContain('12 months');
  });

  it('uses device price for calculations, not credit limit', async () => {
    const { updateSession } = require('../../../services/whatsapp-service/src/onboarding/session');

    // Credit limit is $500 but device is $180 — deposit should be based on $180
    await handleTermSelection(makeSession(), makeContext('1'));

    const callArgs = updateSession.mock.calls[0][1];
    expect(callArgs.state_data.deposit_amount).toBe(36); // 20% of $180, not $100 (20% of $500)
    expect(callArgs.state_data.financed_amount).toBe(144); // $180 - $36
  });
});
