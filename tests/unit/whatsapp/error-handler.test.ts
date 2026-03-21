/**
 * WhatsApp Conversation Error Handler - Unit Tests
 *
 * Covers:
 *   - sanitizeInput() - XSS and SQL injection detection
 *   - validateMessageLength() - message length enforcement
 *   - checkInappropriateLanguage() - profanity detection
 *   - detectGlobalCommand() - global command recognition
 *   - detectOutOfContextCommand() - active loan command detection
 *   - getExpectedInputType() - state-to-input-type mapping
 *   - handleUnexpectedMessageType() - message type mismatch handling
 *   - mapWhatsAppApiError() - WhatsApp Cloud API error mapping
 *   - trackError() / trackSecurityEvent() - error logging to database
 *   - checkRetryLimit() - retry escalation logic
 *   - getPreviousState() / getBackResponse() - state navigation
 *   - handleGlobalCommandResponse() - command response generation
 *   - handleOutOfContextResponse() - out-of-context command response
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

jest.mock('../../../services/shared/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  sanitizeInput,
  validateMessageLength,
  checkInappropriateLanguage,
  detectGlobalCommand,
  detectOutOfContextCommand,
  getExpectedInputType,
  handleUnexpectedMessageType,
  mapWhatsAppApiError,
  trackError,
  trackSecurityEvent,
  checkRetryLimit,
  getPreviousState,
  getBackResponse,
  handleGlobalCommandResponse,
  handleOutOfContextResponse,
  detectRapidMessages,
  getRapidMessageResponse,
  validateNationalId,
  validatePhoneNumber,
  validateIncome,
} from '../../../services/whatsapp-service/src/error-handler';
import type { ConversationError } from '../../../services/whatsapp-service/src/error-handler';

// ===================================================================
// TESTS
// ===================================================================

describe('WhatsApp Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });
  });

  // -----------------------------------------------------------------
  // sanitizeInput()
  // -----------------------------------------------------------------
  describe('sanitizeInput', () => {
    it('should pass through safe text unchanged', () => {
      const result = sanitizeInput('Hello, my name is Tendai');
      expect(result.safe).toBe(true);
      expect(result.sanitized).toBe('Hello, my name is Tendai');
    });

    it('should detect XSS script tags', () => {
      const result = sanitizeInput('<script>alert("xss")</script>');
      expect(result.safe).toBe(false);
    });

    it('should detect javascript: protocol injection', () => {
      const result = sanitizeInput('javascript:alert(1)');
      expect(result.safe).toBe(false);
    });

    it('should detect inline event handler injection', () => {
      const result = sanitizeInput('<img onerror=alert(1)>');
      expect(result.safe).toBe(false);
    });

    it('should detect SQL UNION SELECT injection', () => {
      const result = sanitizeInput("1' UNION SELECT * FROM users--");
      expect(result.safe).toBe(false);
    });

    it('should detect SQL DROP TABLE injection', () => {
      const result = sanitizeInput('DROP TABLE customers');
      expect(result.safe).toBe(false);
    });

    it('should detect SQL comment-based injection', () => {
      const result = sanitizeInput("admin'; --");
      expect(result.safe).toBe(false);
    });

    it('should detect SQL OR tautology injection', () => {
      const result = sanitizeInput("' or '1'='1");
      expect(result.safe).toBe(false);
    });

    it('should detect SQL DELETE injection', () => {
      const result = sanitizeInput("'; delete from users");
      expect(result.safe).toBe(false);
    });

    it('should strip control characters from input', () => {
      const result = sanitizeInput('Hello\x00World\x1F');
      expect(result.sanitized).toBe('HelloWorld');
      expect(result.safe).toBe(true);
    });

    it('should allow normal special characters that are not malicious', () => {
      const result = sanitizeInput("I'm from Harare, Zimbabwe! #blessed");
      expect(result.safe).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // validateMessageLength()
  // -----------------------------------------------------------------
  describe('validateMessageLength', () => {
    it('should accept a message under 500 characters', () => {
      const result = validateMessageLength('Short message');
      expect(result.valid).toBe(true);
      expect(result.userMessage).toBeUndefined();
    });

    it('should accept a message of exactly 500 characters', () => {
      const result = validateMessageLength('A'.repeat(500));
      expect(result.valid).toBe(true);
    });

    it('should reject a message over 500 characters', () => {
      const result = validateMessageLength('A'.repeat(501));
      expect(result.valid).toBe(false);
      expect(result.userMessage).toBeDefined();
      expect(result.userMessage).toContain('long');
    });
  });

  // -----------------------------------------------------------------
  // checkInappropriateLanguage()
  // -----------------------------------------------------------------
  describe('checkInappropriateLanguage', () => {
    it('should return null for clean text', () => {
      const result = checkInappropriateLanguage('I would like to apply for a loan');
      expect(result).toBeNull();
    });

    it('should detect profanity and return a warning message', () => {
      const result = checkInappropriateLanguage('This is shit');
      expect(result).not.toBeNull();
      expect(result).toContain('professional');
    });

    it('should detect scam accusation', () => {
      const result = checkInappropriateLanguage('This is a scam!');
      expect(result).not.toBeNull();
      expect(result).toContain('professional');
    });

    it('should detect fraud accusation', () => {
      const result = checkInappropriateLanguage('You are committing fraud');
      expect(result).not.toBeNull();
    });

    it('should be case-insensitive for profanity detection', () => {
      const result = checkInappropriateLanguage('DAMN this system');
      expect(result).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // detectGlobalCommand()
  // -----------------------------------------------------------------
  describe('detectGlobalCommand', () => {
    it('should detect HELP command (case-insensitive)', () => {
      expect(detectGlobalCommand('HELP')).toBe('help');
      expect(detectGlobalCommand('help')).toBe('help');
      expect(detectGlobalCommand('Help')).toBe('help');
    });

    it('should detect CANCEL command', () => {
      expect(detectGlobalCommand('CANCEL')).toBe('cancel');
    });

    it('should detect BACK command', () => {
      expect(detectGlobalCommand('BACK')).toBe('back');
    });

    it('should detect RESTART command', () => {
      expect(detectGlobalCommand('RESTART')).toBe('restart');
    });

    it('should detect CONTINUE command', () => {
      expect(detectGlobalCommand('CONTINUE')).toBe('continue');
    });

    it('should detect SUPPORT command', () => {
      expect(detectGlobalCommand('SUPPORT')).toBe('support');
    });

    it('should detect LANGUAGE command', () => {
      expect(detectGlobalCommand('LANGUAGE')).toBe('language');
    });

    it('should return null for non-command text', () => {
      expect(detectGlobalCommand('random text')).toBeNull();
      expect(detectGlobalCommand('hello world')).toBeNull();
    });

    it('should trim whitespace before matching', () => {
      expect(detectGlobalCommand('  help  ')).toBe('help');
    });
  });

  // -----------------------------------------------------------------
  // detectOutOfContextCommand()
  // -----------------------------------------------------------------
  describe('detectOutOfContextCommand', () => {
    it('should detect BALANCE command', () => {
      expect(detectOutOfContextCommand('BALANCE')).toBe('balance');
      expect(detectOutOfContextCommand('balance')).toBe('balance');
    });

    it('should detect PAY command', () => {
      expect(detectOutOfContextCommand('PAY')).toBe('pay');
    });

    it('should detect SCHEDULE command', () => {
      expect(detectOutOfContextCommand('SCHEDULE')).toBe('schedule');
    });

    it('should detect HISTORY command', () => {
      expect(detectOutOfContextCommand('HISTORY')).toBe('history');
    });

    it('should detect DEVICE command', () => {
      expect(detectOutOfContextCommand('DEVICE')).toBe('device');
    });

    it('should detect EXTENSION command', () => {
      expect(detectOutOfContextCommand('EXTENSION')).toBe('extension');
    });

    it('should return null for non-loan-command text', () => {
      expect(detectOutOfContextCommand('hello')).toBeNull();
      expect(detectOutOfContextCommand('apply')).toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // getExpectedInputType()
  // -----------------------------------------------------------------
  describe('getExpectedInputType', () => {
    it('should return "any" for kyc_id_upload (accepts text and image)', () => {
      expect(getExpectedInputType('kyc_id_upload')).toBe('any');
    });

    it('should return "image" for kyc_selfie_upload', () => {
      expect(getExpectedInputType('kyc_selfie_upload')).toBe('image');
    });

    it('should return "text" for welcome state', () => {
      expect(getExpectedInputType('welcome')).toBe('text');
    });

    it('should return "text" for collecting_personal_info state', () => {
      expect(getExpectedInputType('collecting_personal_info')).toBe('text');
    });

    it('should return "text" for collecting_employment state', () => {
      expect(getExpectedInputType('collecting_employment')).toBe('text');
    });

    it('should return "text" for product_selection state', () => {
      expect(getExpectedInputType('product_selection')).toBe('text');
    });
  });

  // -----------------------------------------------------------------
  // handleUnexpectedMessageType()
  // -----------------------------------------------------------------
  describe('handleUnexpectedMessageType', () => {
    it('should return null when expected type is "any"', () => {
      const result = handleUnexpectedMessageType('image', 'any', 'kyc_id_upload');
      expect(result).toBeNull();
    });

    it('should return null when received type matches expected type', () => {
      const result = handleUnexpectedMessageType('text', 'text', 'welcome');
      expect(result).toBeNull();
    });

    it('should return error when image expected but text received', () => {
      const result = handleUnexpectedMessageType('text', 'image', 'kyc_selfie_upload');
      expect(result).not.toBeNull();
      expect(result).toContain('photo');
    });

    it('should return error about voice message when audio sent instead of text', () => {
      const result = handleUnexpectedMessageType('audio', 'text', 'welcome');
      expect(result).not.toBeNull();
      expect(result).toContain('voice message');
      expect(result).toContain('text reply');
    });

    it('should return error when sticker sent instead of text', () => {
      const result = handleUnexpectedMessageType('sticker', 'text', 'welcome');
      expect(result).not.toBeNull();
      expect(result).toContain('sticker');
    });

    it('should return error when location sent instead of text', () => {
      const result = handleUnexpectedMessageType('location', 'text', 'welcome');
      expect(result).not.toBeNull();
      expect(result).toContain('location');
    });

    it('should return null when interactive message sent for text-expected state', () => {
      const result = handleUnexpectedMessageType('interactive', 'text', 'product_selection');
      expect(result).toBeNull();
    });

    it('should mention National ID when image expected at kyc_id_upload state', () => {
      const result = handleUnexpectedMessageType('text', 'image', 'kyc_id_upload');
      expect(result).not.toBeNull();
      expect(result).toContain('National ID');
    });

    it('should mention selfie when image expected at kyc_selfie_upload state', () => {
      const result = handleUnexpectedMessageType('text', 'image', 'kyc_selfie_upload');
      expect(result).not.toBeNull();
      expect(result).toContain('selfie');
    });
  });

  // -----------------------------------------------------------------
  // mapWhatsAppApiError()
  // -----------------------------------------------------------------
  describe('mapWhatsAppApiError', () => {
    it('should map error 131031 (rate limit) to queue action', () => {
      const result = mapWhatsAppApiError(131031);
      expect(result.retryable).toBe(true);
      expect(result.internalAction).toBe('queue');
    });

    it('should map error 131047 (undeliverable) to fallback SMS', () => {
      const result = mapWhatsAppApiError(131047);
      expect(result.retryable).toBe(false);
      expect(result.internalAction).toBe('fallback_sms');
    });

    it('should map error 130472 (user not on WhatsApp) to fallback SMS', () => {
      const result = mapWhatsAppApiError(130472);
      expect(result.retryable).toBe(false);
      expect(result.internalAction).toBe('fallback_sms');
    });

    it('should map error 133016 (24h window expired) to fallback SMS', () => {
      const result = mapWhatsAppApiError(133016);
      expect(result.retryable).toBe(false);
      expect(result.internalAction).toBe('fallback_sms');
    });

    it('should map unknown error codes to retry action', () => {
      const result = mapWhatsAppApiError(999999);
      expect(result.retryable).toBe(true);
      expect(result.internalAction).toBe('retry');
      expect(result.userMessage).toContain('try again');
    });
  });

  // -----------------------------------------------------------------
  // trackError()
  // -----------------------------------------------------------------
  describe('trackError', () => {
    it('should insert error record into whatsapp_error_log table', async () => {
      const error: ConversationError = {
        category: 'user_input',
        severity: 'low',
        code: 'INPUT_001',
        userMessage: 'Please try again',
        internalMessage: 'Invalid name format',
      };

      await trackError('+263771234567', error);

      expect(mockDb.from).toHaveBeenCalledWith('whatsapp_error_log');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          phone_number: '+263771234567',
          error_category: 'user_input',
          error_severity: 'low',
          error_code: 'INPUT_001',
        })
      );
    });

    it('should not throw when database insert fails', async () => {
      mockQueryBuilder.execute.mockRejectedValueOnce(new Error('DB error'));

      const error: ConversationError = {
        category: 'system',
        severity: 'high',
        code: 'SYS_001',
        userMessage: 'Error',
        internalMessage: 'System failure',
      };

      // Should not throw
      await expect(trackError('+263771234567', error)).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------
  // trackSecurityEvent()
  // -----------------------------------------------------------------
  describe('trackSecurityEvent', () => {
    it('should insert security event into whatsapp_error_log table', async () => {
      await trackSecurityEvent('+263771234567', 'suspicious_input', {
        input: '<script>',
        ip: '127.0.0.1',
      });

      expect(mockDb.from).toHaveBeenCalledWith('whatsapp_error_log');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          phone_number: '+263771234567',
          error_category: 'security',
          error_severity: 'high',
          error_code: 'SEC_SUSPICIOUS_INPUT',
        })
      );
    });

    it('should not throw when database insert fails', async () => {
      mockQueryBuilder.execute.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        trackSecurityEvent('+263771234567', 'abuse', { detail: 'spam' })
      ).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------
  // checkRetryLimit()
  // -----------------------------------------------------------------
  describe('checkRetryLimit', () => {
    it('should return null when retries are below the limit', () => {
      expect(checkRetryLimit(0)).toBeNull();
      expect(checkRetryLimit(1)).toBeNull();
      expect(checkRetryLimit(2)).toBeNull();
    });

    it('should return escalation message when retries reach the limit (3)', () => {
      const result = checkRetryLimit(3);
      expect(result).not.toBeNull();
      expect(result).toContain('human agent');
    });

    it('should return escalation message when retries exceed the limit', () => {
      const result = checkRetryLimit(5);
      expect(result).not.toBeNull();
      expect(result).toContain('human agent');
    });
  });

  // -----------------------------------------------------------------
  // getPreviousState() / getBackResponse()
  // -----------------------------------------------------------------
  describe('getPreviousState', () => {
    it('should return null for the welcome state (first in flow)', () => {
      expect(getPreviousState('welcome')).toBeNull();
    });

    it('should return welcome for collecting_personal_info', () => {
      expect(getPreviousState('collecting_personal_info')).toBe('welcome');
    });

    it('should return collecting_personal_info for collecting_employment', () => {
      expect(getPreviousState('collecting_employment')).toBe('collecting_personal_info');
    });

    it('should return collecting_employment for product_selection', () => {
      expect(getPreviousState('product_selection')).toBe('collecting_employment');
    });
  });

  describe('getBackResponse', () => {
    it('should return a message when at the beginning (cannot go back)', () => {
      const result = getBackResponse('welcome');
      expect(result).not.toBeNull();
      expect(result).toContain('beginning');
    });

    it('should return null for states that can go back (caller handles navigation)', () => {
      const result = getBackResponse('collecting_employment');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // handleGlobalCommandResponse()
  // -----------------------------------------------------------------
  describe('handleGlobalCommandResponse', () => {
    it('should return help menu for help command', () => {
      const result = handleGlobalCommandResponse('help');
      expect(result).toContain('Commands');
      expect(result).toContain('RESTART');
      expect(result).toContain('CANCEL');
    });

    it('should return pause message for cancel command', () => {
      const result = handleGlobalCommandResponse('cancel');
      expect(result).toContain('paused');
      expect(result).toContain('48 hours');
    });

    it('should return support message for support command', () => {
      const result = handleGlobalCommandResponse('support');
      expect(result).toContain('human agent');
      expect(result).toContain('support@lynia.finance');
    });

    it('should return language selection for language command', () => {
      const result = handleGlobalCommandResponse('language');
      expect(result).toContain('English');
      expect(result).toContain('Shona');
      expect(result).toContain('Ndebele');
    });
  });

  // -----------------------------------------------------------------
  // handleOutOfContextResponse()
  // -----------------------------------------------------------------
  describe('handleOutOfContextResponse', () => {
    it('should inform user they have no active loan for balance command', () => {
      const result = handleOutOfContextResponse('balance');
      expect(result).toContain('balance');
      expect(result).toContain("don't have an active loan");
    });

    it('should suggest finishing application first', () => {
      const result = handleOutOfContextResponse('pay');
      expect(result).toContain('finish your application');
    });
  });
});
