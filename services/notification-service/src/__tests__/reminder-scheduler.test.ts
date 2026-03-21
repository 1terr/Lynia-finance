/**
 * Unit tests for services/notification-service/src/reminder-scheduler.ts
 *
 * Tests reminder scheduling, smart timing (CAT timezone window),
 * 10-tier escalation, product-aware messages, and opt-out handling.
 */

// ── Mocks ────────────────────────────────────────────────────────────────

jest.mock('../../../shared/clients/database', () => {
  const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = [
      'select', 'insert', 'update', 'delete',
      'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not',
      'or', 'order', 'limit', 'single', 'maybeSingle', 'upsert',
    ];
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

jest.mock('../../../shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    setContext: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }),
  },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({ data: { messageId: 'wa-msg-001' } }),
  },
}));

// ── Imports ──────────────────────────────────────────────────────────────

import {
  isWithinSendingWindow,
  getNextSendingTime,
  generatePaymentLink,
  generateReminderMessage,
  processPaymentReminders,
  REMINDER_SCHEDULE,
  type ReminderType,
  type PaymentDue,
} from '../reminder-scheduler';

const { __mockExecute } = require('../../../shared/clients/database');
const axios = require('axios').default;

// ── Helpers ──────────────────────────────────────────────────────────────

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
    product_category: 'smartphone',
    ...overrides,
  };
}

function setUtcHour(hour: number): void {
  const fixed = new Date(`2026-03-01T${hour.toString().padStart(2, '0')}:00:00Z`);
  jest.useFakeTimers({ now: fixed });
}

// ── Test Suite ───────────────────────────────────────────────────────────

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

  // ═══════════════════════════════════════════════════════════════════════
  // Smart Timing — CAT Timezone Window
  // ═══════════════════════════════════════════════════════════════════════

  describe('isWithinSendingWindow', () => {
    it('should return true at 7am CAT (5am UTC)', () => {
      setUtcHour(5);
      expect(isWithinSendingWindow()).toBe(true);
    });

    it('should return true at noon CAT (10am UTC)', () => {
      setUtcHour(10);
      expect(isWithinSendingWindow()).toBe(true);
    });

    it('should return false at 9pm CAT (7pm UTC) — window closes', () => {
      setUtcHour(19);
      expect(isWithinSendingWindow()).toBe(false);
    });

    it('should return false at 6am CAT (4am UTC) — before window opens', () => {
      setUtcHour(4);
      expect(isWithinSendingWindow()).toBe(false);
    });

    it('should return false at midnight CAT (10pm UTC)', () => {
      setUtcHour(22);
      expect(isWithinSendingWindow()).toBe(false);
    });

    it('should return false at 3am CAT (1am UTC)', () => {
      setUtcHour(1);
      expect(isWithinSendingWindow()).toBe(false);
    });
  });

  describe('getNextSendingTime', () => {
    it('should return now when inside the sending window', () => {
      const now = new Date('2026-03-01T10:00:00Z');
      jest.useFakeTimers({ now });
      const result = getNextSendingTime();
      expect(result.getTime()).toBe(now.getTime());
    });

    it('should return 8am CAT next day when past the window', () => {
      jest.useFakeTimers({ now: new Date('2026-03-01T20:00:00Z') }); // 22 CAT
      const result = getNextSendingTime();
      expect(result.getUTCDate()).toBe(2);
      expect(result.getUTCHours()).toBe(6); // 6 UTC = 8 CAT
    });

    it('should return 8am CAT same day when before the window', () => {
      jest.useFakeTimers({ now: new Date('2026-03-01T03:00:00Z') }); // 5 CAT
      const result = getNextSendingTime();
      expect(result.getUTCDate()).toBe(1);
      expect(result.getUTCHours()).toBe(6);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // REMINDER_SCHEDULE — 10-Tier Escalation
  // ═══════════════════════════════════════════════════════════════════════

  describe('REMINDER_SCHEDULE', () => {
    it('should have exactly 10 schedule entries', () => {
      expect(REMINDER_SCHEDULE).toHaveLength(10);
    });

    it('should have days_offset from -7 to +30', () => {
      const offsets = REMINDER_SCHEDULE.map((s) => s.days_offset);
      expect(offsets).toEqual([-7, -3, -1, 0, 1, 3, 5, 7, 14, 30]);
    });

    it('should escalate tone from friendly to default_notice', () => {
      expect(REMINDER_SCHEDULE[0].tone).toBe('friendly');
      expect(REMINDER_SCHEDULE[REMINDER_SCHEDULE.length - 1].tone).toBe('default_notice');
    });

    it('should include all 10 reminder types', () => {
      const types = REMINDER_SCHEDULE.map((s) => s.type);
      expect(types).toContain('pre_due_7');
      expect(types).toContain('pre_due_3');
      expect(types).toContain('pre_due_1');
      expect(types).toContain('due_today');
      expect(types).toContain('overdue_1');
      expect(types).toContain('overdue_3');
      expect(types).toContain('overdue_5');
      expect(types).toContain('overdue_7');
      expect(types).toContain('overdue_14');
      expect(types).toContain('overdue_30');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // generatePaymentLink
  // ═══════════════════════════════════════════════════════════════════════

  describe('generatePaymentLink', () => {
    it('should generate a link with ref, amount, currency', () => {
      const link = generatePaymentLink({ loan_id: 'loan-abc', amount: 250, currency: 'USD' });
      expect(link).toBe('https://pay.lynia.finance/pay?ref=loan-abc&amount=250&currency=USD');
    });

    it('should URL-encode special characters in loan_id', () => {
      const link = generatePaymentLink({ loan_id: 'loan abc/123', amount: 100, currency: 'ZWL' });
      expect(link).toContain('ref=loan%20abc%2F123');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // generateReminderMessage — Product-Aware Messages
  // ═══════════════════════════════════════════════════════════════════════

  describe('generateReminderMessage', () => {
    const paymentLink = 'https://pay.lynia.finance/pay?ref=loan-001&amount=150&currency=USD';

    it('should use first name only in greeting', () => {
      const msg = generateReminderMessage('pre_due_7', makePayment(), paymentLink);
      expect(msg).toContain('Tendai');
      expect(msg).not.toContain('Moyo');
    });

    it('should format amount as $150.00', () => {
      const msg = generateReminderMessage('pre_due_7', makePayment(), paymentLink);
      expect(msg).toContain('$150.00');
    });

    it('should include the payment link', () => {
      const msg = generateReminderMessage('pre_due_7', makePayment(), paymentLink);
      expect(msg).toContain(paymentLink);
    });

    // ─── Smartphone overdue: references device lock ──────────────

    it('smartphone overdue_7 references device lock', () => {
      const msg = generateReminderMessage('overdue_7', makePayment({ product_category: 'smartphone' }), paymentLink);
      expect(msg).toContain('Device Lock');
      expect(msg).toContain('locked');
    });

    it('smartphone overdue_5 warns about device lock in 2 days', () => {
      const msg = generateReminderMessage('overdue_5', makePayment({ product_category: 'smartphone' }), paymentLink);
      expect(msg).toContain('device may be locked');
    });

    // ─── Digital overdue: references credit standing ─────────────

    it('digital overdue_5 references credit standing (no device lock)', () => {
      const msg = generateReminderMessage('overdue_5', makePayment({ product_category: 'digital' }), paymentLink);
      expect(msg).toContain('Credit Standing');
      expect(msg).toContain('credit score');
      expect(msg).not.toContain('device');
    });

    it('digital overdue_7 references collections (no device lock)', () => {
      const msg = generateReminderMessage('overdue_7', makePayment({ product_category: 'digital' }), paymentLink);
      expect(msg).toContain('Collections Notice');
      expect(msg).not.toContain('Device Lock');
    });

    it('digital overdue_14 warns about credit bureau reporting', () => {
      const msg = generateReminderMessage('overdue_14', makePayment({ product_category: 'digital' }), paymentLink);
      expect(msg).toContain('credit bureau');
    });

    // ─── Pre-due messages are same for both products ─────────────

    it('pre-due messages are identical for smartphone and digital', () => {
      const smartphoneMsg = generateReminderMessage('pre_due_7', makePayment({ product_category: 'smartphone' }), paymentLink);
      const digitalMsg = generateReminderMessage('pre_due_7', makePayment({ product_category: 'digital' }), paymentLink);
      expect(smartphoneMsg).toBe(digitalMsg);
    });

    // ─── All types produce unique messages ───────────────────────

    it('should produce a unique message for every reminder type', () => {
      const types: ReminderType[] = [
        'pre_due_7', 'pre_due_3', 'pre_due_1', 'due_today',
        'overdue_1', 'overdue_3', 'overdue_5', 'overdue_7',
        'overdue_14', 'overdue_30',
      ];
      const messages = types.map((t) => generateReminderMessage(t, makePayment(), paymentLink));
      const unique = new Set(messages);
      expect(unique.size).toBe(types.length);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // processPaymentReminders — Main Scheduler
  // ═══════════════════════════════════════════════════════════════════════

  describe('processPaymentReminders', () => {
    it('should skip processing outside the sending window', async () => {
      setUtcHour(22); // 0 CAT — outside window
      const stats = await processPaymentReminders();
      expect(stats).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
    });

    it('should return zero stats when no active loans exist', async () => {
      setUtcHour(10);
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });
      const stats = await processPaymentReminders();
      expect(stats).toEqual({ processed: 0, sent: 0, skipped: 0, failed: 0 });
    });

    it('should send a reminder for a payment matching a schedule entry', async () => {
      setUtcHour(10);
      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);

      __mockExecute
        .mockResolvedValueOnce({
          data: [{
            id: 'loan-001', customer_id: 'cust-001',
            next_payment_date: dueDate.toISOString().split('T')[0],
            monthly_installment_amount: 150, currency: 'USD',
            customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
          }],
          error: null,
        })
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const stats = await processPaymentReminders();
      expect(stats.processed).toBe(1);
      expect(stats.sent).toBe(1);
      expect(axios.post).toHaveBeenCalled();
    });

    it('should skip customers who have opted out', async () => {
      setUtcHour(10);
      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);

      __mockExecute
        .mockResolvedValueOnce({
          data: [{
            id: 'loan-001', customer_id: 'cust-001',
            next_payment_date: dueDate.toISOString().split('T')[0],
            monthly_installment_amount: 100, currency: 'USD',
            customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
          }],
          error: null,
        })
        .mockResolvedValueOnce({ data: { reminder_opt_out: true }, error: null });

      const stats = await processPaymentReminders();
      expect(stats.skipped).toBe(1);
      expect(stats.sent).toBe(0);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should count failed send when WhatsApp API throws', async () => {
      setUtcHour(10);
      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);

      __mockExecute
        .mockResolvedValueOnce({
          data: [{
            id: 'loan-001', customer_id: 'cust-001',
            next_payment_date: dueDate.toISOString().split('T')[0],
            monthly_installment_amount: 100, currency: 'USD',
            customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
          }],
          error: null,
        })
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      axios.post.mockRejectedValueOnce(new Error('WhatsApp API timeout'));

      const stats = await processPaymentReminders();
      expect(stats.failed).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('should include product_category in reminder data (smartphone default)', async () => {
      setUtcHour(10);
      const dueDate = new Date('2026-03-01T10:00:00Z');
      dueDate.setDate(dueDate.getDate() + 7);

      __mockExecute
        .mockResolvedValueOnce({
          data: [{
            id: 'loan-001', customer_id: 'cust-001',
            next_payment_date: dueDate.toISOString().split('T')[0],
            monthly_installment_amount: 100, currency: 'USD',
            product_category: null, // should default to smartphone
            customers: { id: 'cust-001', first_name: 'Tendai', last_name: 'Moyo', phone_number: '+263771234567' },
          }],
          error: null,
        })
        .mockResolvedValueOnce({ data: { reminder_opt_out: false }, error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const stats = await processPaymentReminders();
      expect(stats.sent).toBe(1);
    });
  });
});
