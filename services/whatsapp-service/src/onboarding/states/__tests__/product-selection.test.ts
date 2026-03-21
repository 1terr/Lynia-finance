/**
 * Unit Tests: Product Selection State Handler
 *
 * Tests the product_selection onboarding state where customers choose
 * between smartphone financing and digital credit.
 */

import { handleProductSelection } from '../product-selection';
import type { OnboardingSession, MessageContext } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateSession = jest.fn();
jest.mock('../../session', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

jest.mock('../../../i18n', () => ({
  t: (key: string, _lang?: string) => {
    const map: Record<string, string> = {
      smartphone_selected: 'Smartphone Financing Selected!',
      kyc_id_number: 'Enter your National ID number',
      digital_credit_selected: 'Digital Credit Selected!',
      org_verification_prompt: 'Please enter your National ID number so we can verify your employment.',
      product_selection: 'What would you like to apply for?\n\n1 - Smartphone Financing\n2 - Digital Credit',
    };
    return map[key] || key;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'product_selection',
    state_data: {
      preferred_language: 'en',
      ...overrides,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
  };
}

function makeContext(message: string): MessageContext {
  return {
    from: '+263771234567',
    message,
    messageId: 'msg-test-001',
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleProductSelection', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Smartphone selection ────────────────────────────────────────────

  describe('smartphone selection (option 1)', () => {
    it('selects smartphone when user replies "1"', async () => {
      const result = await handleProductSelection(makeSession(), makeContext('1'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'kyc_id_upload',
        state_data: expect.objectContaining({
          selected_product: 'smartphone',
          requested_loan_amount: 250,
        }),
      }));

      expect(result).toContain('Smartphone Financing Selected!');
      expect(result).toContain('Enter your National ID number');
    });

    it('selects smartphone when message includes "smartphone"', async () => {
      await handleProductSelection(makeSession(), makeContext('I want a smartphone'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'kyc_id_upload',
        state_data: expect.objectContaining({
          selected_product: 'smartphone',
        }),
      }));
    });

    it('handles case-insensitive "SMARTPHONE"', async () => {
      await handleProductSelection(makeSession(), makeContext('SMARTPHONE'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'kyc_id_upload',
      }));
    });

    it('selects smartphone for "yes" response', async () => {
      await handleProductSelection(makeSession(), makeContext('yes'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'kyc_id_upload',
        state_data: expect.objectContaining({ selected_product: 'smartphone' }),
      }));
    });

    it('selects smartphone for Shona "hongu" (yes)', async () => {
      await handleProductSelection(makeSession(), makeContext('hongu'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'kyc_id_upload',
      }));
    });

    it('selects smartphone for Ndebele "yebo" (yes)', async () => {
      await handleProductSelection(makeSession(), makeContext('yebo'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'kyc_id_upload',
      }));
    });

    it('preserves existing state_data when selecting smartphone', async () => {
      const session = makeSession({
        full_name: 'Tendai Moyo',
        monthly_income_usd: 350,
      });

      await handleProductSelection(session, makeContext('1'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        state_data: expect.objectContaining({
          full_name: 'Tendai Moyo',
          monthly_income_usd: 350,
          selected_product: 'smartphone',
        }),
      }));
    });
  });

  // ── Digital credit selection ────────────────────────────────────────

  describe('digital credit selection (option 2)', () => {
    it('selects digital credit when user replies "2"', async () => {
      const result = await handleProductSelection(makeSession(), makeContext('2'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'org_verification',
        state_data: expect.objectContaining({
          selected_product: 'digital_credit',
        }),
      }));

      expect(result).toContain('Digital Credit Selected!');
      expect(result).toContain('verify your employment');
    });

    it('selects digital credit when message includes "digital"', async () => {
      await handleProductSelection(makeSession(), makeContext('digital credit'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'org_verification',
        state_data: expect.objectContaining({ selected_product: 'digital_credit' }),
      }));
    });

    it('selects digital credit for Shona "mari" (money)', async () => {
      await handleProductSelection(makeSession(), makeContext('mari'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'org_verification',
      }));
    });

    it('selects digital credit for Ndebele "imali" (money)', async () => {
      await handleProductSelection(makeSession(), makeContext('imali'));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'org_verification',
      }));
    });

    it('does NOT set requested_loan_amount for digital credit', async () => {
      await handleProductSelection(makeSession(), makeContext('2'));

      const callArgs = mockUpdateSession.mock.calls[0][1];
      // Digital credit does not pre-set a loan amount — it's determined later
      expect(callArgs.state_data.requested_loan_amount).toBeUndefined();
    });
  });

  // ── Invalid input ───────────────────────────────────────────────────

  describe('invalid input', () => {
    it('returns product selection prompt for invalid input', async () => {
      const result = await handleProductSelection(makeSession(), makeContext('3'));

      expect(result).toContain('What would you like to apply for');
      expect(result).toContain('Smartphone Financing');
      expect(result).toContain('Digital Credit');
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it('returns prompt for empty message', async () => {
      const result = await handleProductSelection(makeSession(), makeContext(''));

      expect(result).toContain('What would you like to apply for');
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it('returns prompt for random text', async () => {
      const result = await handleProductSelection(makeSession(), makeContext('hello world'));

      expect(result).toContain('What would you like to apply for');
      expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it('trims whitespace before matching', async () => {
      await handleProductSelection(makeSession(), makeContext('  1  '));

      expect(mockUpdateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
        current_state: 'kyc_id_upload',
      }));
    });
  });

  // ── Language support ────────────────────────────────────────────────

  describe('language preference', () => {
    it('passes preferred language to translation function', async () => {
      const session = makeSession({ preferred_language: 'sn' });
      // The mock always returns English but we verify no errors occur
      const result = await handleProductSelection(session, makeContext('1'));
      expect(result).toBeTruthy();
    });

    it('defaults to English when no language is set', async () => {
      const session = makeSession({ preferred_language: undefined });
      const result = await handleProductSelection(session, makeContext('1'));
      expect(result).toBeTruthy();
    });
  });
});
