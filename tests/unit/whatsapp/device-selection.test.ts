import { handleDeviceSelection } from '../../../services/whatsapp-service/src/onboarding/states/device-selection';
import type { OnboardingSession, MessageContext } from '../../../services/whatsapp-service/src/onboarding/types';

// Mock session update
jest.mock('../../../services/whatsapp-service/src/onboarding/session', () => ({
  updateSession: jest.fn(),
}));

const mockDevices = [
  { id: 'dev-1', brand: 'Tecno', model_name: 'Spark 20', retail_price_usd: 150 },
  { id: 'dev-2', brand: 'Samsung', model_name: 'A15', retail_price_usd: 180 },
  { id: 'dev-3', brand: 'Infinix', model_name: 'Note 30', retail_price_usd: 195 },
];

function makeSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'device_selection',
    state_data: {
      credit_tier: 'Standard Product',
      credit_limit_usd: 500,
      down_payment_percentage: 20,
      interest_rate_apr: 4,
      matched_product_min_term: 6,
      matched_product_max_term: 12,
      available_devices: mockDevices,
      ...overrides,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
  };
}

function makeContext(message: string): MessageContext {
  return { from: '+263771234567', message, messageId: 'msg-1', timestamp: Date.now() };
}

describe('handleDeviceSelection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns error if no devices in session', async () => {
    const session = makeSession({ available_devices: undefined });
    const result = await handleDeviceSelection(session, makeContext('1'));
    expect(result).toContain('Restart');
  });

  it('re-shows device list for invalid input', async () => {
    const result = await handleDeviceSelection(makeSession(), makeContext('abc'));
    expect(result).toContain('Please reply with a number');
    expect(result).toContain('*Tecno:*');
    expect(result).toContain('Spark 20 - $150.00');
  });

  it('re-shows device list for out-of-range number', async () => {
    const result = await handleDeviceSelection(makeSession(), makeContext('5'));
    expect(result).toContain('between 1 and 3');
  });

  it('transitions to term_selection on valid choice', async () => {
    const { updateSession } = require('../../../services/whatsapp-service/src/onboarding/session');
    const result = await handleDeviceSelection(makeSession(), makeContext('2'));

    expect(updateSession).toHaveBeenCalledWith('+263771234567', expect.objectContaining({
      current_state: 'term_selection',
      state_data: expect.objectContaining({
        selected_device_id: 'dev-2',
        selected_device_price: 180,
        selected_device_name: 'Samsung A15',
      }),
    }));

    expect(result).toContain('Samsung A15');
    expect(result).toContain('How long would you like to pay');
    expect(result).toContain('6 months');
    expect(result).toContain('12 months');
  });

  it('shows 18-month option for products with max_term 18', async () => {
    const session = makeSession({ matched_product_min_term: 6, matched_product_max_term: 18 });
    const result = await handleDeviceSelection(session, makeContext('1'));
    expect(result).toContain('18 months');
  });
});
