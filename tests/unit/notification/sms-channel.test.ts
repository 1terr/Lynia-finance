/**
 * Unit tests for services/notification-service/src/sms-sender.ts
 *
 * SMS Notification Channel — sends transactional SMS via AWS SNS
 * to Zimbabwe mobile numbers with rate limiting and phone validation.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PublishCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'PublishCommand' })),
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }),
  },
}));

import { sendSMS, checkSmsRateLimit, _resetRateLimitStore, SmsError } from '../../../services/notification-service/src/sms-sender';
import { PublishCommand } from '@aws-sdk/client-sns';

// ── Helpers ───────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  _resetRateLimitStore();
  mockSend.mockResolvedValue({ MessageId: 'sns-msg-12345' });
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('SMS Sender (AWS SNS)', () => {
  describe('sendSMS', () => {
    it('sends SMS to a valid Zimbabwe number in international format', async () => {
      const result = await sendSMS('+263771234567', 'Your payment of $50 is due tomorrow.');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sns-msg-12345');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = (PublishCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(command.PhoneNumber).toBe('+263771234567');
      expect(command.Message).toBe('Your payment of $50 is due tomorrow.');
    });

    it('normalizes local format (0771234567) to international before calling SNS', async () => {
      await sendSMS('0771234567', 'Test message');

      const command = (PublishCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(command.PhoneNumber).toBe('+263771234567');
    });

    it('rejects invalid Zimbabwe phone number', async () => {
      await expect(sendSMS('+263791234567', 'Test'))
        .rejects.toThrow(SmsError);

      await expect(sendSMS('+263791234567', 'Test'))
        .rejects.toMatchObject({ code: 'INVALID_PHONE' });

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('rejects non-Zimbabwe phone number', async () => {
      await expect(sendSMS('+1234567890', 'Test'))
        .rejects.toThrow(SmsError);

      await expect(sendSMS('+1234567890', 'Test'))
        .rejects.toMatchObject({ code: 'INVALID_PHONE' });

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles SNS API error gracefully', async () => {
      mockSend.mockRejectedValue(new Error('SNS throttling'));

      await expect(sendSMS('+263771234567', 'Test'))
        .rejects.toThrow(SmsError);

      _resetRateLimitStore();
      await expect(sendSMS('+263771234567', 'Test'))
        .rejects.toMatchObject({ code: 'SNS_ERROR' });
    });

    it('sets SMSType to Transactional', async () => {
      await sendSMS('+263771234567', 'Payment reminder');

      const command = (PublishCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(command.MessageAttributes['AWS.SNS.SMS.SMSType']).toEqual({
        DataType: 'String',
        StringValue: 'Transactional',
      });
    });

    it('sets SenderID to Lynia', async () => {
      await sendSMS('+263771234567', 'Payment reminder');

      const command = (PublishCommand as unknown as jest.Mock).mock.calls[0][0];
      expect(command.MessageAttributes['AWS.SNS.SMS.SenderID']).toEqual({
        DataType: 'String',
        StringValue: 'Lynia',
      });
    });
  });

  describe('SMS Rate Limiting', () => {
    it('allows the first 10 SMS to the same number', () => {
      const phone = '+263771234567';
      for (let i = 0; i < 10; i++) {
        expect(checkSmsRateLimit(phone)).toBe(false);
      }
    });

    it('blocks the 11th SMS to the same number within 24hr window', () => {
      const phone = '+263771234567';
      // First 10 are allowed
      for (let i = 0; i < 10; i++) {
        checkSmsRateLimit(phone);
      }
      // 11th should be blocked
      expect(checkSmsRateLimit(phone)).toBe(true);
    });

    it('allows SMS to a different number even when one is rate-limited', () => {
      const phone1 = '+263771234567';
      const phone2 = '+263772345678';

      // Exhaust phone1 limit
      for (let i = 0; i < 10; i++) {
        checkSmsRateLimit(phone1);
      }
      expect(checkSmsRateLimit(phone1)).toBe(true);

      // phone2 should still work
      expect(checkSmsRateLimit(phone2)).toBe(false);
    });

    it('sendSMS throws RATE_LIMITED when limit exceeded', async () => {
      const phone = '+263771234567';
      // Exhaust the rate limit (sendSMS calls checkSmsRateLimit internally, which increments)
      // We call checkSmsRateLimit 9 times, then sendSMS once (that's 10), then the next sendSMS should fail
      for (let i = 0; i < 9; i++) {
        checkSmsRateLimit(phone);
      }
      // 10th — allowed via sendSMS
      await sendSMS(phone, 'Message 10');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // 11th — should be rate limited
      await expect(sendSMS(phone, 'Message 11'))
        .rejects.toMatchObject({ code: 'RATE_LIMITED' });
      expect(mockSend).toHaveBeenCalledTimes(1); // SNS not called again
    });
  });
});

// Note: Full integration tests for sendNotification with channel='sms'
// are covered in tests/integration/notification-service.test.ts.
// The unit tests above validate the sms-sender module in isolation.
