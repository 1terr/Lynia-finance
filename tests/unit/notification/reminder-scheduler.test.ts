/**
 * Unit tests for services/notification-service/src/reminder-scheduler.ts
 *
 * Payment Reminder Scheduler — automated reminders for upcoming and overdue
 * loan payments. Sends via WhatsApp with smart scheduling (CAT timezone window),
 * opt-out handling, and delivery analytics.
 *
 * Item 15 of the post-refactoring plan.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────

jest.mock('../../../services/shared/clients/database', () => {
  const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or', 'order', 'limit', 'single', 'maybeSingle', 'upsert'];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: { from: jest.fn().mockImplementation(() => createChain()) },
    __mockExecute: mockExecute,
  };
});

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

jest.mock('../../../services/shared/utils/sqs-publisher', () => ({
  SQSQueues: {
    sendNotification: jest.fn().mockResolvedValue('msg-id'),
    retryWhatsAppMessage: jest.fn().mockResolvedValue('msg-id'),
  },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({ data: { messageId: 'wa-msg-001' } }),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────

import {
  isWithinSendingWindow,
  getNextSendingTime,
  generatePaymentLink,
  generateReminderMessage,
  findPaymentsDueForReminders,
  processPaymentReminders,
  handleReminderOptOut,
  handleReminderOptIn,
  getReminderAnalytics,
  REMINDER_SCHEDULE,
  ReminderType,
  PaymentDue,
} from '../../../services/notification-service/src/reminder-scheduler';

const { db, __mockExecute } = require('../../../services/shared/clients/database');
const axios = require('axios').default;
import logger from '../../../services/shared/utils/logger';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build a mock PaymentDue for use in tests */
function makePayment(overrides: Partial<PaymentDue> = {}): PaymentDue {
  return {
    loan_id: 'loan-001',
    customer_id: 'cust-001',
    customer_name: 'Tendai Moyo',
    phone_number: '+263771234567',
    installment_number: 3,
    amount_due: 150.0,
    due_date: '2026-03-10',
    days_until_due: 7,
    currency: 'USD',
    ...overrides,
  };
}

/** Set the system clock to a specific UTC hour for sending-window tests */
function setUtcHour(hour: number): void {
  const fixed = new Date(`2026-03-01T${hour.toString().padStart(2, '0')}:00:00Z`);
  jest.useFakeTimers({ now: fixed });
}

// ── Test Suites ───────────────────────────────────────────────────────────

describe('ReminderScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
    __mockExecute.mockResolvedValue({ data: [], error: null });
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────
  // isWithinSendingWindow
  // ─────────────────────────────────────────────────────────────────────

  describe('isWithinSendingWindow', () => {
    it('should return true at 7am CAT (5am UTC)', () => {
      setUtcHour(5); // 5 UTC = 7 CAT
      expect(isWithinSendingWindow()).toBe(true);
    });

    it('should return true at noon CAT (10am UTC)', () => {
      setUtcHour(10); // 10 UTC = 12 CAT
      expect(isWithinSendingWindow()).toBe(true);
    });

    it('should return true at 8:30pm CAT (6:30pm UTC)', () => {
      const fixed = new Date('2026-03-01T18:30:00Z'); // 18:30 UTC = 20:30 CAT
      jest.useFakeTimers({ now: fixed });
      expect(isWithinSendingWindow()).toBe(true);
    });

    it('should return false at 9pm CAT exactly (7pm UTC)', () => {
      setUtcHour(19); // 19 UTC = 21 CAT (SEND_WINDOW_END is 21 — exclusive)
      expect(isWithinSendingWindow()).toBe(false);
    });

    it('should return false at 11pm CAT (9pm UTC)', () => {
      setUtcHour(21); // 21 UTC = 23 CAT
      expect(isWithinSendingWindow()).toBe(false);
    });

    it('should return false at 6am CAT (4am UTC)', () => {
      setUtcHour(4); // 4 UTC = 6 CAT
      expect(isWithinSendingWindow()).toBe(false);
    });

    it('should return false at midnight CAT (10pm UTC)', () => {
      setUtcHour(22); // 22 UTC = 0 CAT (next day)
      expect(isWithinSendingWindow()).toBe(false);
    });

    it('should return false at 3am CAT (1am UTC)', () => {
      setUtcHour(1); // 1 UTC = 3 CAT
      expect(isWithinSendingWindow()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getNextSendingTime
  // ─────────────────────────────────────────────────────────────────────

  describe('getNextSendingTime', () => {
    it('should return now when inside the sending window', () => {
      const now = new Date('2026-03-01T10:00:00Z'); // 12 CAT
      jest.useFakeTimers({ now });

      const result = getNextSendingTime();
      expect(result.getTime()).toBe(now.getTime());
    });

    it('should return 8am CAT next day when past the sending window', () => {
      const now = new Date('2026-03-01T20:00:00Z'); // 22 CAT => past window
      jest.useFakeTimers({ now });

      const result = getNextSendingTime();
      // Should be 6am UTC (8am CAT) on March 2nd
      expect(result.getUTCDate()).toBe(2);
      expect(result.getUTCHours()).toBe(6);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should return 8am CAT same day when before the sending window', () => {
      const now = new Date('2026-03-01T03:00:00Z'); // 5 CAT => before window
      jest.useFakeTimers({ now });

      const result = getNextSendingTime();
      // Should be 6am UTC (8am CAT) same day
      expect(result.getUTCDate()).toBe(1);
      expect(result.getUTCHours()).toBe(6);
      expect(result.getUTCMinutes()).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // generatePaymentLink
  // ─────────────────────────────────────────────────────────────────────

  describe('generatePaymentLink', () => {
    it('should generate a payment link with correct parameters', () => {
      const link = generatePaymentLink({
        loan_id: 'loan-abc',
        amount: 250,
        currency: 'USD',
      });
      expect(link).toBe('https://pay.lynia.finance/pay?ref=loan-abc&amount=250&currency=USD');
    });

    it('should URL-encode special characters in loan_id', () => {
      const link = generatePaymentLink({
        loan_id: 'loan abc/123',
        amount: 100,
        currency: 'ZWL',
      });
      expect(link).toContain('ref=loan%20abc%2F123');
      expect(link).toContain('amount=100');
      expect(link).toContain('currency=ZWL');
    });

    it('should use PAYMENT_LINK_BASE_URL env var when set', () => {
      const original = process.env.PAYMENT_LINK_BASE_URL;
      process.env.PAYMENT_LINK_BASE_URL = 'https://custom.lynia.co';
      try {
        const link = generatePaymentLink({ loan_id: 'loan-1', amount: 50, currency: 'USD' });
        expect(link).toMatch(/^https:\/\/custom\.lynia\.co\/pay\?/);
      } finally {
        if (original !== undefined) {
          process.env.PAYMENT_LINK_BASE_URL = original;
        } else {
          delete process.env.PAYMENT_LINK_BASE_URL;
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // generateReminderMessage
  // ─────────────────────────────────────────────────────────────────────

  describe('generateReminderMessage', () => {
    const payment = makePayment({ customer_name: 'Tendai Moyo', amount_due: 150 });
    const paymentLink = 'https://pay.lynia.finance/pay?ref=loan-001&amount=150&currency=USD';

    it('should use only the first name in the greeting', () => {
      const msg = generateReminderMessage('pre_due_7', payment, paymentLink);
      expect(msg).toContain('Tendai');
      expect(msg).not.toContain('Moyo');
    });

    it('should format the amount as $150.00', () => {
      const msg = generateReminderMessage('pre_due_7', payment, paymentLink);
      expect(msg).toContain('$150.00');
    });

    it('should include the payment link in the message', () => {
      const msg = generateReminderMessage('pre_due_7', payment, paymentLink);
      expect(msg).toContain(paymentLink);
    });

    it('should generate friendly pre_due_7 message mentioning 7 days', () => {
      const msg = generateReminderMessage('pre_due_7', payment, paymentLink);
      expect(msg).toContain('7 days');
      expect(msg).toContain('reminder');
    });

    it('should generate pre_due_3 message mentioning 3 days', () => {
      const msg = generateReminderMessage('pre_due_3', payment, paymentLink);
      expect(msg).toContain('3 days');
    });

    it('should generate urgent pre_due_1 message mentioning tomorrow', () => {
      const msg = generateReminderMessage('pre_due_1', payment, paymentLink);
      expect(msg).toContain('tomorrow');
    });

    it('should generate due_today message indicating payment is due today', () => {
      const msg = generateReminderMessage('due_today', payment, paymentLink);
      expect(msg).toContain('due today');
    });

    it('should generate overdue_1 message mentioning 1 day overdue', () => {
      const msg = generateReminderMessage('overdue_1', payment, paymentLink);
      expect(msg).toContain('1 day overdue');
    });

    it('should generate overdue_7 message mentioning device lock', () => {
      const msg = generateReminderMessage('overdue_7', payment, paymentLink);
      expect(msg).toContain('Device Lock');
      expect(msg).toContain('locked');
    });

    it('should generate overdue_14 collection notice', () => {
      const msg = generateReminderMessage('overdue_14', payment, paymentLink);
      expect(msg).toContain('Collection Notice');
    });

    it('should generate overdue_30 default notice mentioning credit record', () => {
      const msg = generateReminderMessage('overdue_30', payment, paymentLink);
      expect(msg).toContain('Default Notice');
      expect(msg).toContain('credit record');
    });

    it('should produce a unique message for every reminder type', () => {
      const types: ReminderType[] = [
        'pre_due_7', 'pre_due_3', 'pre_due_1', 'due_today',
        'overdue_1', 'overdue_3', 'overdue_5', 'overdue_7',
        'overdue_14', 'overdue_30',
      ];
      const messages = types.map((t) => generateReminderMessage(t, payment, paymentLink));
      const unique = new Set(messages);
      expect(unique.size).toBe(types.length);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // REMINDER_SCHEDULE constant
  // ─────────────────────────────────────────────────────────────────────

  describe('REMINDER_SCHEDULE', () => {
    it('should have 10 schedule entries covering pre-due through overdue', () => {
      expect(REMINDER_SCHEDULE).toHaveLength(10);
    });

    it('should have days_offset ordered from -7 to +30', () => {
      const offsets = REMINDER_SCHEDULE.map((s) => s.days_offset);
      expect(offsets).toEqual([-7, -3, -1, 0, 1, 3, 5, 7, 14, 30]);
    });

    it('should escalate tone from friendly to default_notice', () => {
      expect(REMINDER_SCHEDULE[0].tone).toBe('friendly');
      expect(REMINDER_SCHEDULE[REMINDER_SCHEDULE.length - 1].tone).toBe('default_notice');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // findPaymentsDueForReminders
  // ─────────────────────────────────────────────────────────────────────

  describe('findPaymentsDueForReminders', () => {
    it('should return an empty array when no loans exist', async () => {
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });
      const payments = await findPaymentsDueForReminders();
      expect(payments).toEqual([]);
    });

    it('should return an empty array on database error', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: new Error('DB error') });
      const payments = await findPaymentsDueForReminders();
      expect(payments).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should skip loans where the customer has no phone number', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          {
            id: 'loan-001',
            customer_id: 'cust-001',
            next_payment_date: '2026-03-10',
            monthly_installment_amount: 100,
            currency: 'USD',
            customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: null },
          },
        ],
        error: null,
      });

      const payments = await findPaymentsDueForReminders();
      expect(payments).toHaveLength(0);
    });

    it('should compute days_until_due correctly for upcoming payment', async () => {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      __mockExecute.mockResolvedValueOnce({
        data: [
          {
            id: 'loan-001',
            customer_id: 'cust-001',
            next_payment_date: futureDateStr,
            monthly_installment_amount: 200,
            currency: 'USD',
            customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
          },
        ],
        error: null,
      });

      const payments = await findPaymentsDueForReminders();
      expect(payments).toHaveLength(1);
      expect(payments[0].days_until_due).toBe(7);
      expect(payments[0].customer_name).toBe('Tendai Moyo');
    });

    it('should default currency to USD when not set on loan', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          {
            id: 'loan-001',
            customer_id: 'cust-001',
            next_payment_date: '2026-03-10',
            monthly_installment_amount: 100,
            currency: null,
            customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
          },
        ],
        error: null,
      });

      const payments = await findPaymentsDueForReminders();
      expect(payments[0].currency).toBe('USD');
    });

    it('should query only active and delinquent loans', async () => {
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      await findPaymentsDueForReminders();

      // The chain should have called .in('loan_status', ['active', 'delinquent'])
      const fromCall = db.from.mock.results[0].value;
      expect(fromCall.in).toHaveBeenCalledWith('loan_status', ['active', 'delinquent']);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // processPaymentReminders (main scheduler)
  // ─────────────────────────────────────────────────────────────────────

  describe('processPaymentReminders', () => {
    it('should skip processing outside the sending window and return zero stats', async () => {
      setUtcHour(22); // 0 CAT — outside window

      const stats = await processPaymentReminders();

      expect(stats).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Outside sending window'),
        expect.any(Object)
      );
    });

    it('should return zero stats when no active loans exist', async () => {
      setUtcHour(10); // 12 CAT — inside window

      // findPaymentsDueForReminders DB call returns empty
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const stats = await processPaymentReminders();

      expect(stats).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
    });

    it('should send a reminder for a payment matching a schedule entry', async () => {
      setUtcHour(10);

      const today = new Date('2026-03-01T10:00:00Z');
      const dueIn7Days = new Date(today);
      dueIn7Days.setDate(dueIn7Days.getDate() + 7);
      const dueDateStr = dueIn7Days.toISOString().split('T')[0];

      // Call 1: findPaymentsDueForReminders -> loans query
      __mockExecute.mockResolvedValueOnce({
        data: [
          {
            id: 'loan-001',
            customer_id: 'cust-001',
            next_payment_date: dueDateStr,
            monthly_installment_amount: 150,
            currency: 'USD',
            customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
          },
        ],
        error: null,
      });

      // Call 2: hasOptedOut -> customer_preferences query
      __mockExecute.mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null });

      // Call 3: hasReminderBeenSent -> payment_reminders query
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      // Call 4: sendReminder -> axios post succeeds (via axios mock)
      // Call 5: sendReminder -> insert reminder record
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const stats = await processPaymentReminders();

      expect(stats.processed).toBe(1);
      expect(stats.sent).toBe(1);
      expect(stats.failed).toBe(0);
      expect(axios.post).toHaveBeenCalled();
    });

    it('should skip customers who have opted out', async () => {
      setUtcHour(10);

      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);

      __mockExecute
        // findPaymentsDueForReminders
        .mockResolvedValueOnce({
          data: [
            {
              id: 'loan-001',
              customer_id: 'cust-001',
              next_payment_date: dueDate.toISOString().split('T')[0],
              monthly_installment_amount: 100,
              currency: 'USD',
              customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
            },
          ],
          error: null,
        })
        // hasOptedOut returns true
        .mockResolvedValueOnce({ data: { reminder_opt_out: true }, error: null });

      const stats = await processPaymentReminders();

      expect(stats.skipped).toBe(1);
      expect(stats.sent).toBe(0);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should skip reminders that have already been sent', async () => {
      setUtcHour(10);

      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);

      __mockExecute
        // findPaymentsDueForReminders
        .mockResolvedValueOnce({
          data: [
            {
              id: 'loan-001',
              customer_id: 'cust-001',
              next_payment_date: dueDate.toISOString().split('T')[0],
              monthly_installment_amount: 100,
              currency: 'USD',
              customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
            },
          ],
          error: null,
        })
        // hasOptedOut -> not opted out
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null })
        // hasReminderBeenSent -> already sent
        .mockResolvedValueOnce({ data: [{ id: 'reminder-existing' }], error: null });

      const stats = await processPaymentReminders();

      expect(stats.skipped).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('should count a failed send when WhatsApp API throws an error', async () => {
      setUtcHour(10);

      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);

      __mockExecute
        // findPaymentsDueForReminders
        .mockResolvedValueOnce({
          data: [
            {
              id: 'loan-001',
              customer_id: 'cust-001',
              next_payment_date: dueDate.toISOString().split('T')[0],
              monthly_installment_amount: 100,
              currency: 'USD',
              customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
            },
          ],
          error: null,
        })
        // hasOptedOut
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null })
        // hasReminderBeenSent -> not sent
        .mockResolvedValueOnce({ data: [], error: null })
        // insert reminder record
        .mockResolvedValueOnce({ data: null, error: null });

      // Make axios throw on this call
      axios.post.mockRejectedValueOnce(new Error('WhatsApp API timeout'));

      const stats = await processPaymentReminders();

      expect(stats.failed).toBe(1);
      expect(stats.sent).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send reminder',
        expect.objectContaining({ loanId: 'loan-001' })
      );
    });

    it('should process multiple payments and aggregate stats correctly', async () => {
      setUtcHour(10);

      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      __mockExecute
        // findPaymentsDueForReminders returns 2 loans
        .mockResolvedValueOnce({
          data: [
            {
              id: 'loan-001', customer_id: 'cust-001',
              next_payment_date: dueDateStr, monthly_installment_amount: 100, currency: 'USD',
              customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
            },
            {
              id: 'loan-002', customer_id: 'cust-002',
              next_payment_date: dueDateStr, monthly_installment_amount: 200, currency: 'USD',
              customers: { id: 'cust-002', first_name: 'Grace', last_name: 'Ndlovu', phone_number: '+263772345678' },
            },
          ],
          error: null,
        })
        // Payment 1: hasOptedOut -> not opted out
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null })
        // Payment 1: hasReminderBeenSent -> not sent
        .mockResolvedValueOnce({ data: [], error: null })
        // Payment 1: insert reminder record
        .mockResolvedValueOnce({ data: null, error: null })
        // Payment 2: hasOptedOut -> opted out
        .mockResolvedValueOnce({ data: { reminder_opt_out: true }, error: null });

      const stats = await processPaymentReminders();

      expect(stats.processed).toBe(2);
      expect(stats.sent).toBe(1);
      expect(stats.skipped).toBe(1); // cust-002 opted out
    });

    it('should not send reminders for payments that do not match any schedule offset', async () => {
      setUtcHour(10);

      // Payment is 4 days before due — no schedule entry for days_offset = -4
      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 4);

      __mockExecute
        .mockResolvedValueOnce({
          data: [
            {
              id: 'loan-001', customer_id: 'cust-001',
              next_payment_date: dueDate.toISOString().split('T')[0],
              monthly_installment_amount: 100, currency: 'USD',
              customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
            },
          ],
          error: null,
        })
        // hasOptedOut check still happens
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null });

      const stats = await processPaymentReminders();

      expect(stats.processed).toBe(1);
      expect(stats.sent).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should continue processing remaining payments after one fails', async () => {
      setUtcHour(10);

      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      __mockExecute
        // findPaymentsDueForReminders returns 2 loans
        .mockResolvedValueOnce({
          data: [
            {
              id: 'loan-001', customer_id: 'cust-001',
              next_payment_date: dueDateStr, monthly_installment_amount: 100, currency: 'USD',
              customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
            },
            {
              id: 'loan-002', customer_id: 'cust-002',
              next_payment_date: dueDateStr, monthly_installment_amount: 200, currency: 'USD',
              customers: { id: 'cust-002', first_name: 'Grace', last_name: 'Ndlovu', phone_number: '+263772345678' },
            },
          ],
          error: null,
        })
        // Payment 1: hasOptedOut
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null })
        // Payment 1: hasReminderBeenSent
        .mockResolvedValueOnce({ data: [], error: null })
        // Payment 1: insert reminder record
        .mockResolvedValueOnce({ data: null, error: null })
        // Payment 2: hasOptedOut
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null })
        // Payment 2: hasReminderBeenSent
        .mockResolvedValueOnce({ data: [], error: null })
        // Payment 2: insert reminder record
        .mockResolvedValueOnce({ data: null, error: null });

      // First WhatsApp call fails, second succeeds
      axios.post
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ data: { messageId: 'wa-msg-002' } });

      const stats = await processPaymentReminders();

      expect(stats.processed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.sent).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // handleReminderOptOut
  // ─────────────────────────────────────────────────────────────────────

  describe('handleReminderOptOut', () => {
    it('should upsert customer preference with reminder_opt_out = true', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await handleReminderOptOut('cust-123');

      expect(db.from).toHaveBeenCalledWith('customer_preferences');
      const chain = db.from.mock.results[0].value;
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'cust-123',
          reminder_opt_out: true,
        })
      );
    });

    it('should log the opt-out event', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await handleReminderOptOut('cust-456');

      expect(logger.info).toHaveBeenCalledWith(
        'Customer opted out of reminders',
        expect.objectContaining({ customerId: 'cust-456' })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // handleReminderOptIn
  // ─────────────────────────────────────────────────────────────────────

  describe('handleReminderOptIn', () => {
    it('should upsert customer preference with reminder_opt_out = false', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await handleReminderOptIn('cust-123');

      expect(db.from).toHaveBeenCalledWith('customer_preferences');
      const chain = db.from.mock.results[0].value;
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'cust-123',
          reminder_opt_out: false,
        })
      );
    });

    it('should log the opt-in event', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await handleReminderOptIn('cust-789');

      expect(logger.info).toHaveBeenCalledWith(
        'Customer opted in to reminders',
        expect.objectContaining({ customerId: 'cust-789' })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getReminderAnalytics
  // ─────────────────────────────────────────────────────────────────────

  describe('getReminderAnalytics', () => {
    it('should return all-zero stats when no reminders exist', async () => {
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const analytics = await getReminderAnalytics();

      expect(analytics).toEqual({
        total_sent: 0,
        total_delivered: 0,
        total_read: 0,
        total_failed: 0,
        delivery_rate: 0,
        read_rate: 0,
        by_type: {},
      });
    });

    it('should return all-zero stats when data is null', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const analytics = await getReminderAnalytics();

      expect(analytics.total_sent).toBe(0);
      expect(analytics.delivery_rate).toBe(0);
    });

    it('should count statuses correctly', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          { reminder_type: 'pre_due_7', status: 'sent' },
          { reminder_type: 'pre_due_7', status: 'delivered' },
          { reminder_type: 'pre_due_3', status: 'read' },
          { reminder_type: 'overdue_1', status: 'failed' },
          { reminder_type: 'pre_due_7', status: 'sent' },
        ],
        error: null,
      });

      const analytics = await getReminderAnalytics();

      expect(analytics.total_sent).toBe(2);
      expect(analytics.total_delivered).toBe(1);
      expect(analytics.total_read).toBe(1);
      expect(analytics.total_failed).toBe(1);
    });

    it('should calculate delivery_rate as (delivered / sent) * 100', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          { reminder_type: 'pre_due_7', status: 'sent' },
          { reminder_type: 'pre_due_7', status: 'sent' },
          { reminder_type: 'pre_due_3', status: 'delivered' },
          { reminder_type: 'due_today', status: 'sent' },
          { reminder_type: 'overdue_1', status: 'delivered' },
        ],
        error: null,
      });

      const analytics = await getReminderAnalytics();

      // 3 sent, 2 delivered => delivery_rate = (2/3)*100 ~= 66.67
      expect(analytics.delivery_rate).toBeCloseTo(66.67, 1);
    });

    it('should calculate read_rate as (read / delivered) * 100', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          { reminder_type: 'pre_due_7', status: 'delivered' },
          { reminder_type: 'pre_due_7', status: 'delivered' },
          { reminder_type: 'pre_due_3', status: 'read' },
          { reminder_type: 'overdue_1', status: 'delivered' },
        ],
        error: null,
      });

      const analytics = await getReminderAnalytics();

      // 3 delivered, 1 read => read_rate = (1/3)*100 ~= 33.33
      expect(analytics.read_rate).toBeCloseTo(33.33, 1);
    });

    it('should aggregate by_type correctly', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          { reminder_type: 'pre_due_7', status: 'sent' },
          { reminder_type: 'pre_due_7', status: 'delivered' },
          { reminder_type: 'pre_due_3', status: 'sent' },
          { reminder_type: 'overdue_1', status: 'failed' },
        ],
        error: null,
      });

      const analytics = await getReminderAnalytics();

      expect(analytics.by_type).toEqual({
        pre_due_7: 2,
        pre_due_3: 1,
        overdue_1: 1,
      });
    });

    it('should apply date range filters when provided', async () => {
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      await getReminderAnalytics({ from: '2026-02-01', to: '2026-02-28' });

      const chain = db.from.mock.results[0].value;
      expect(chain.gte).toHaveBeenCalledWith('sent_at', '2026-02-01');
      expect(chain.lte).toHaveBeenCalledWith('sent_at', '2026-02-28');
    });

    it('should not apply date filters when no range is provided', async () => {
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      await getReminderAnalytics();

      const chain = db.from.mock.results[0].value;
      expect(chain.gte).not.toHaveBeenCalled();
      expect(chain.lte).not.toHaveBeenCalled();
    });

    it('should return 0 delivery_rate when no reminders are sent', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          { reminder_type: 'pre_due_7', status: 'failed' },
          { reminder_type: 'pre_due_3', status: 'failed' },
        ],
        error: null,
      });

      const analytics = await getReminderAnalytics();

      expect(analytics.total_sent).toBe(0);
      expect(analytics.delivery_rate).toBe(0);
    });

    it('should return 0 read_rate when no reminders are delivered', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          { reminder_type: 'pre_due_7', status: 'sent' },
          { reminder_type: 'pre_due_3', status: 'sent' },
        ],
        error: null,
      });

      const analytics = await getReminderAnalytics();

      expect(analytics.total_delivered).toBe(0);
      expect(analytics.read_rate).toBe(0);
    });
  });
});
