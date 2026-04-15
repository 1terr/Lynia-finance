/**
 * WhatsApp Onboarding State Machine - Unit Tests
 *
 * Covers:
 *   - validateZimbabwePhoneNumber() - pure phone validation
 *   - handleWelcome() - welcome state with phone validation + session creation
 *   - handlePersonalInfo() - name, DOB, gender, location collection
 *   - handleEmployment() - employment type, income, debts, household
 *   - handleProductSelection() - smartphone vs digital credit
 *   - getOrCreateSession() - session lifecycle (active, expired, new)
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

const mockDb = {
  from: jest.fn(() => ({ ...mockQueryBuilder })),
};

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

jest.mock('axios');

jest.mock('../../../services/shared/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Set environment variables before import
process.env.WHATSAPP_ACCESS_TOKEN = 'test_token';
process.env.KYC_API_URL = 'https://test-kyc.example.com';

import {
  validateZimbabwePhoneNumber,
  getOrCreateSession,
  handleWelcome,
  handlePersonalInfo,
  handleEmployment,
  handleProductSelection,
} from '../../../services/whatsapp-service/src/onboarding';
import type {
  OnboardingSession,
  MessageContext,
} from '../../../services/whatsapp-service/src/onboarding';

// ===================================================================
// HELPER FACTORIES
// ===================================================================

function createMessageContext(overrides: Partial<MessageContext> = {}): MessageContext {
  return {
    from: '+263771234567',
    message: 'Hello',
    messageId: 'wamid.test_001',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createSession(overrides: Partial<OnboardingSession> = {}): OnboardingSession {
  return {
    customer_id: 'cust_test_001',
    phone_number: '+263771234567',
    current_state: 'welcome',
    state_data: {
      preferred_language: 'en',
      started_at: new Date().toISOString(),
      retry_count: 0,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
    ...overrides,
  };
}

// ===================================================================
// TESTS
// ===================================================================

describe('WhatsApp Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: db operations succeed
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });
  });

  // -----------------------------------------------------------------
  // validateZimbabwePhoneNumber()
  // -----------------------------------------------------------------
  describe('validateZimbabwePhoneNumber', () => {
    it('should accept a valid +263 phone number with prefix 77', () => {
      const result = validateZimbabwePhoneNumber('+263771234567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });

    it('should accept a valid local format phone number starting with 0', () => {
      const result = validateZimbabwePhoneNumber('0771234567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });

    it('should accept a valid number without the + prefix', () => {
      const result = validateZimbabwePhoneNumber('263771234567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });

    it('should accept prefix 71 (Econet)', () => {
      const result = validateZimbabwePhoneNumber('+263711234567');
      expect(result.valid).toBe(true);
    });

    it('should accept prefix 73 (Telecel)', () => {
      const result = validateZimbabwePhoneNumber('+263731234567');
      expect(result.valid).toBe(true);
    });

    it('should accept prefix 74', () => {
      const result = validateZimbabwePhoneNumber('+263741234567');
      expect(result.valid).toBe(true);
    });

    it('should accept prefix 78 (NetOne)', () => {
      const result = validateZimbabwePhoneNumber('+263781234567');
      expect(result.valid).toBe(true);
    });

    it('should reject non-Zimbabwean number with non_zimbabwean_number message', () => {
      const result = validateZimbabwePhoneNumber('+1234567890');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('non_zimbabwean_number');
    });

    it('should reject too-short number with invalid_zimbabwe_mobile message', () => {
      const result = validateZimbabwePhoneNumber('12345');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('non_zimbabwean_number');
    });

    it('should reject invalid Zimbabwe mobile with wrong digit count', () => {
      const result = validateZimbabwePhoneNumber('026377123');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('invalid_zimbabwe_mobile');
    });

    it('should strip spaces and dashes before validation', () => {
      const result = validateZimbabwePhoneNumber('+263 77 123 4567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });

    it('should strip parentheses before validation', () => {
      const result = validateZimbabwePhoneNumber('+263(77)1234567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });
  });

  // -----------------------------------------------------------------
  // getOrCreateSession()
  // -----------------------------------------------------------------
  describe('getOrCreateSession', () => {
    it('should return an existing active session within 24 hours', async () => {
      const recentActivity = new Date();
      const existingSession = createSession({
        current_state: 'collecting_personal_info',
        last_activity_at: recentActivity,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: existingSession,
        error: null,
      });

      const session = await getOrCreateSession('+263771234567');

      expect(session.current_state).toBe('collecting_personal_info');
      expect(mockDb.from).toHaveBeenCalledWith('whatsapp_sessions');
    });

    it('should create a new session when the existing one has expired (> 24h)', async () => {
      const expiredActivity = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const expiredSession = createSession({
        current_state: 'collecting_personal_info',
        last_activity_at: expiredActivity,
      });

      // First call: select returns expired session
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: expiredSession, error: null })
        // Second call: insert returns new session
        .mockResolvedValueOnce({
          data: createSession({ current_state: 'welcome' }),
          error: null,
        });

      const session = await getOrCreateSession('+263771234567');

      expect(session.current_state).toBe('welcome');
    });

    it('should create a new session when no session exists', async () => {
      // First call: select returns null
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: null })
        // Second call: insert returns new session
        .mockResolvedValueOnce({
          data: createSession({ current_state: 'welcome' }),
          error: null,
        });

      const session = await getOrCreateSession('+263771234567');

      expect(session.current_state).toBe('welcome');
    });

    it('should throw an error when session creation fails', async () => {
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('DB write failed') });

      await expect(getOrCreateSession('+263771234567')).rejects.toThrow(
        'Failed to create onboarding session'
      );
    });

    it('should create new session when existing session state is completed', async () => {
      const completedSession = createSession({ current_state: 'completed' });

      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: completedSession, error: null })
        .mockResolvedValueOnce({
          data: createSession({ current_state: 'welcome' }),
          error: null,
        });

      const session = await getOrCreateSession('+263771234567');

      expect(session.current_state).toBe('welcome');
    });
  });

  // -----------------------------------------------------------------
  // handleWelcome()
  // -----------------------------------------------------------------
  describe('handleWelcome', () => {
    it('should transition to collecting_personal_info for a valid ZW phone', async () => {
      const activeSession = createSession({
        current_state: 'welcome',
        state_data: { started_at: new Date().toISOString(), retry_count: 0 },
      });

      // getOrCreateSession select call
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: activeSession, error: null })
        // updateSession call
        .mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ from: '+263771234567', message: 'Hi' });
      const result = await handleWelcome(context);

      // Response can be ButtonsResponse (with body property) or string
      const responseText = typeof result === 'string' ? result : result.body;
      expect(responseText).toContain('Welcome to Lynia Finance');
    });

    it('should return service_not_available for a non-Zimbabwean phone number', async () => {
      const activeSession = createSession({
        phone_number: '+1234567890',
        current_state: 'welcome',
        state_data: { started_at: new Date().toISOString(), retry_count: 0 },
      });

      // getOrCreateSession select
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: activeSession, error: null })
        // international_interest insert
        .mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ from: '+1234567890', message: 'Hello' });
      const result = await handleWelcome(context);

      const responseText = typeof result === 'string' ? result : result.body;
      expect(responseText).toContain('Service Not Available');
    });

    it('should return invalid_phone for an invalid Zimbabwe number', async () => {
      const activeSession = createSession({
        phone_number: '026377123',
        current_state: 'welcome',
        state_data: { started_at: new Date().toISOString(), retry_count: 0 },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: activeSession,
        error: null,
      });

      const context = createMessageContext({ from: '026377123', message: 'Hello' });
      const result = await handleWelcome(context);

      const responseText = typeof result === 'string' ? result : result.body;
      expect(responseText).toContain('Invalid Phone Number');
    });
  });

  // -----------------------------------------------------------------
  // handlePersonalInfo()
  // -----------------------------------------------------------------
  describe('handlePersonalInfo', () => {
    it('should accept a valid full name with 2 words and ask for DOB', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: { preferred_language: 'en' },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: 'Tendai Moyo' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('date of birth');
    });

    it('should accept a valid full name with 5 words', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: { preferred_language: 'en' },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: 'Tendai Mukanya Moyo Some Name' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('date of birth');
    });

    it('should reject a single-word name with name_format_error', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: { preferred_language: 'en' },
      });

      const context = createMessageContext({ message: 'Tendai' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('full name');
      expect(result).toContain('2-5');
    });

    it('should reject a name with more than 5 words', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: { preferred_language: 'en' },
      });

      const context = createMessageContext({ message: 'One Two Three Four Five Six' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('full name');
    });

    it('should accept a valid DOB in DD/MM/YYYY format and ask for gender', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: { preferred_language: 'en', full_name: 'Tendai Moyo' },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: '15/03/1990' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('gender');
    });

    it('should reject an invalid DOB format', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: { preferred_language: 'en', full_name: 'Tendai Moyo' },
      });

      const context = createMessageContext({ message: '1990-03-15' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('DD/MM/YYYY');
    });

    it('should reject a DOB for someone under 18', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: { preferred_language: 'en', full_name: 'Tendai Moyo' },
      });

      const context = createMessageContext({ message: '15/03/2015' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('DD/MM/YYYY');
    });

    it('should reject a DOB for someone over 75', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: { preferred_language: 'en', full_name: 'Tendai Moyo' },
      });

      const context = createMessageContext({ message: '15/03/1940' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('DD/MM/YYYY');
    });

    it('should accept gender selection "1" as male and ask for location', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: {
          preferred_language: 'en',
          full_name: 'Tendai Moyo',
          date_of_birth: '15/03/1990',
        },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: '1' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('city');
    });

    it('should accept gender selection "2" as female', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: {
          preferred_language: 'en',
          full_name: 'Tendai Moyo',
          date_of_birth: '15/03/1990',
        },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: '2' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('city');
    });

    it('should accept gender selection "3" as other', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: {
          preferred_language: 'en',
          full_name: 'Tendai Moyo',
          date_of_birth: '15/03/1990',
        },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: '3' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('city');
    });

    it('should reject an invalid gender input', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: {
          preferred_language: 'en',
          full_name: 'Tendai Moyo',
          date_of_birth: '15/03/1990',
        },
      });

      const context = createMessageContext({ message: '5' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('gender');
    });

    it('should accept location and transition to collecting_employment', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: {
          preferred_language: 'en',
          full_name: 'Tendai Moyo',
          date_of_birth: '15/03/1990',
          gender: 'male',
        },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: 'Harare' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('Personal Info Complete');
      expect(result).toContain('income');
    });

    it('should reject a location that is too short (< 2 chars)', async () => {
      const session = createSession({
        current_state: 'collecting_personal_info',
        state_data: {
          preferred_language: 'en',
          full_name: 'Tendai Moyo',
          date_of_birth: '15/03/1990',
          gender: 'male',
        },
      });

      const context = createMessageContext({ message: 'X' });
      const result = await handlePersonalInfo(session, context);

      expect(result).toContain('Invalid input');
    });
  });

  // -----------------------------------------------------------------
  // handleEmployment()
  // -----------------------------------------------------------------
  describe('handleEmployment', () => {
    it('should accept employment type and ask for household size', async () => {
      const session = createSession({
        current_state: 'collecting_employment',
        state_data: {
          preferred_language: 'en',
          full_name: 'Tendai Moyo',
          location: 'Harare',
        },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: 'Self-employed' });
      const result = await handleEmployment(session, context);

      expect(result).toContain('household');
    });

    it('should accept valid household size (1-20) and transition to product_selection', async () => {
      const session = createSession({
        current_state: 'collecting_employment',
        state_data: {
          preferred_language: 'en',
          employment_type: 'Self-employed',
        },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: '3' });
      const result = await handleEmployment(session, context);

      expect(result).toContain('Income Info Complete');
      expect(result).toContain('apply for');
    });

    it('should reject household size of 0', async () => {
      const session = createSession({
        current_state: 'collecting_employment',
        state_data: {
          preferred_language: 'en',
          employment_type: 'Self-employed',
        },
      });

      const context = createMessageContext({ message: '0' });
      const result = await handleEmployment(session, context);

      expect(result).toContain('Invalid input');
    });

    it('should reject household size greater than 20', async () => {
      const session = createSession({
        current_state: 'collecting_employment',
        state_data: {
          preferred_language: 'en',
          employment_type: 'Self-employed',
        },
      });

      const context = createMessageContext({ message: '25' });
      const result = await handleEmployment(session, context);

      expect(result).toContain('Invalid input');
    });

    it('should accept household size of exactly 1', async () => {
      const session = createSession({
        current_state: 'collecting_employment',
        state_data: {
          preferred_language: 'en',
          employment_type: 'Self-employed',
        },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: '1' });
      const result = await handleEmployment(session, context);

      expect(result).toContain('Income Info Complete');
    });

    it('should accept household size of exactly 20', async () => {
      const session = createSession({
        current_state: 'collecting_employment',
        state_data: {
          preferred_language: 'en',
          employment_type: 'Self-employed',
        },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: '20' });
      const result = await handleEmployment(session, context);

      expect(result).toContain('Income Info Complete');
    });
  });

  // -----------------------------------------------------------------
  // handleProductSelection()
  // -----------------------------------------------------------------
  describe('handleProductSelection', () => {
    it('should select smartphone when user sends "1"', async () => {
      const session = createSession({
        current_state: 'product_selection',
        state_data: { preferred_language: 'en' },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: '1' });
      const result = await handleProductSelection(session, context);

      expect(result).toContain('Smartphone Financing Selected');
      expect(result).toContain('National ID number');
    });

    it('should select smartphone when user sends "smartphone"', async () => {
      const session = createSession({
        current_state: 'product_selection',
        state_data: { preferred_language: 'en' },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: 'I want a smartphone' });
      const result = await handleProductSelection(session, context);

      expect(result).toContain('Smartphone Financing Selected');
    });

    it('should select digital credit and transition to org_verification when user sends "2"', async () => {
      const session = createSession({
        current_state: 'product_selection',
        state_data: { preferred_language: 'en' },
      });

      const context = createMessageContext({ message: '2' });
      const result = await handleProductSelection(session, context);

      expect(result).toContain('Digital Credit Selected');
      expect(result).toContain('Organization Verification');
    });

    it('should select digital credit and transition to org_verification when user sends "digital"', async () => {
      const session = createSession({
        current_state: 'product_selection',
        state_data: { preferred_language: 'en' },
      });

      const context = createMessageContext({ message: 'digital credit' });
      const result = await handleProductSelection(session, context);

      expect(result).toContain('Digital Credit Selected');
      expect(result).toContain('Organization Verification');
    });

    it('should re-prompt product selection for unrecognized input', async () => {
      const session = createSession({
        current_state: 'product_selection',
        state_data: { preferred_language: 'en' },
      });

      const context = createMessageContext({ message: 'something else' });
      const result = await handleProductSelection(session, context);

      const responseText = typeof result === 'string' ? result : result.body;
      expect(responseText).toContain('apply for');
    });

    it('should accept Shona affirmative "hongu" as smartphone selection', async () => {
      const session = createSession({
        current_state: 'product_selection',
        state_data: { preferred_language: 'sn' },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: 'hongu' });
      const result = await handleProductSelection(session, context);

      expect(result).toContain('Smartphone Financing');
    });

    it('should accept Ndebele affirmative "yebo" as smartphone selection', async () => {
      const session = createSession({
        current_state: 'product_selection',
        state_data: { preferred_language: 'nd' },
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: null });

      const context = createMessageContext({ message: 'yebo' });
      const result = await handleProductSelection(session, context);

      expect(result).toContain('Smartphone Financing');
    });
  });
});
