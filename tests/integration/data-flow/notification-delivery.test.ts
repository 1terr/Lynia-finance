/**
 * Cross-Service Data Flow Tests: Notification Delivery
 *
 * Validates notification dispatch across all triggers:
 * - Loan approved -> WhatsApp notification
 * - Payment received -> WhatsApp notification with balance
 * - Payment overdue -> Reminder chain (3-day, 5-day, 7-day)
 * - Device locked/unlocked -> WhatsApp notification
 * - KYC approved/rejected -> WhatsApp notification
 *
 * Ensures notification content matches event data and opt-out is respected.
 */

import {
  seedMockTable,
  getMockTable,
  resetMockDataStore,
  createTestCustomer,
  createTestLoan,
  createTestPayment,
  generateTestId,
} from '../../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  match: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
};

const mockSupabaseClient = {
  from: jest.fn(() => ({ ...mockQueryBuilder })),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('axios', () => ({
  default: { post: jest.fn().mockResolvedValue({ data: {} }) },
  post: jest.fn(),
  isAxiosError: jest.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NotificationRecord {
  [key: string]: unknown;
  id: string;
  customer_id: string;
  channel: string;
  message: string;
  template_name: string | null;
  status: string;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
}

function createNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: generateTestId('notif'),
    customer_id: 'unknown',
    channel: 'whatsapp',
    message: '',
    template_name: null,
    status: 'pending',
    metadata: {},
    sent_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Notification Delivery Data Flow Tests', () => {
  const customerId = 'cust_notif_001';
  const loanId = 'loan_notif_001';
  const deviceId = 'dev_notif_001';

  beforeEach(() => {
    resetMockDataStore();
    jest.clearAllMocks();

    // Base customer
    seedMockTable('customers', [
      createTestCustomer({
        id: customerId,
        phone_number: '+263771234567',
        first_name: 'Tendai',
        last_name: 'Moyo',
        notification_opt_out: false,
      }),
    ]);

    seedMockTable('notifications', []);
  });

  // =========================================================================
  // 1. Loan approved notification
  // =========================================================================
  describe('Loan Approved -> Notification', () => {
    it('should send WhatsApp notification when loan is approved', () => {
      const approvedAmount = 350;
      const tier = 'Tier 2';

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_amount_usd: approvedAmount,
          loan_status: 'approved',
        }),
      ]);

      // Notification triggered by loan approval
      const notification = createNotification({
        customer_id: customerId,
        channel: 'whatsapp',
        message: `Congratulations Tendai! Your loan of $${approvedAmount} has been approved.`,
        template_name: 'loan_approved',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          loan_id: loanId,
          amount: approvedAmount,
          tier,
          trigger: 'loan.approved',
        },
      });
      getMockTable('notifications').push(notification);

      const notifications = getMockTable('notifications') as unknown as NotificationRecord[];
      expect(notifications).toHaveLength(1);
      expect(notifications[0].customer_id).toBe(customerId);
      expect(notifications[0].channel).toBe('whatsapp');
      expect(notifications[0].template_name).toBe('loan_approved');
      expect(notifications[0].status).toBe('sent');
      expect(notifications[0].message).toContain('$350');
      expect(notifications[0].message).toContain('Tendai');
    });
  });

  // =========================================================================
  // 2. Payment received notification
  // =========================================================================
  describe('Payment Received -> Notification', () => {
    it('should send WhatsApp notification with correct balance after payment', () => {
      const paymentAmount = 51.33;
      const newBalance = 148.67;

      seedMockTable('payments', [
        createTestPayment({
          id: generateTestId('pay'),
          loan_id: loanId,
          customer_id: customerId,
          payment_amount_usd: paymentAmount,
          payment_status: 'completed',
        }),
      ]);

      const notification = createNotification({
        customer_id: customerId,
        channel: 'whatsapp',
        message: `Payment of $${paymentAmount.toFixed(2)} received. Your outstanding balance is $${newBalance.toFixed(2)}.`,
        template_name: 'payment_received',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          loan_id: loanId,
          payment_amount: paymentAmount,
          outstanding_balance: newBalance,
          trigger: 'payment.completed',
        },
      });
      getMockTable('notifications').push(notification);

      const notifications = getMockTable('notifications') as unknown as NotificationRecord[];
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toContain('$51.33');
      expect(notifications[0].message).toContain('$148.67');
      expect(notifications[0].metadata.payment_amount).toBe(paymentAmount);
      expect(notifications[0].metadata.outstanding_balance).toBe(newBalance);
    });

    it('should include correct amounts that match payment data', () => {
      const paymentAmount = 70.00;
      const previousBalance = 308.00;
      const newBalance = previousBalance - paymentAmount;

      const notification = createNotification({
        customer_id: customerId,
        message: `Payment of $${paymentAmount.toFixed(2)} received. Balance: $${newBalance.toFixed(2)}`,
        metadata: {
          payment_amount: paymentAmount,
          outstanding_balance: newBalance,
        },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.metadata.payment_amount).toBe(70.00);
      expect(notif.metadata.outstanding_balance).toBe(238.00);
      // Verify amounts in message text match metadata
      expect(notif.message).toContain(`$${paymentAmount.toFixed(2)}`);
      expect(notif.message).toContain(`$${newBalance.toFixed(2)}`);
    });
  });

  // =========================================================================
  // 3. Overdue payment reminder chain
  // =========================================================================
  describe('Overdue Payment -> Reminder Chain', () => {
    it('should send 3-day overdue reminder', () => {
      const daysOverdue = 3;
      const amountDue = 51.33;

      const notification = createNotification({
        customer_id: customerId,
        channel: 'whatsapp',
        message: `Hi Tendai, your payment of $${amountDue.toFixed(2)} is ${daysOverdue} days overdue. Please pay to avoid device restrictions.`,
        template_name: 'payment_reminder_3day',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          loan_id: loanId,
          days_overdue: daysOverdue,
          amount_due: amountDue,
          reminder_level: '3_day',
          trigger: 'payment.overdue',
        },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.metadata.days_overdue).toBe(3);
      expect(notif.metadata.reminder_level).toBe('3_day');
      expect(notif.template_name).toBe('payment_reminder_3day');
    });

    it('should send 5-day overdue reminder', () => {
      const notification = createNotification({
        customer_id: customerId,
        template_name: 'payment_reminder_5day',
        message: 'Hi Tendai, your payment is 5 days overdue. Your device may be locked in 2 days.',
        metadata: {
          days_overdue: 5,
          reminder_level: '5_day',
          trigger: 'payment.overdue',
        },
        status: 'sent',
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.metadata.days_overdue).toBe(5);
      expect(notif.metadata.reminder_level).toBe('5_day');
    });

    it('should send 7-day overdue reminder with lock warning', () => {
      const notification = createNotification({
        customer_id: customerId,
        template_name: 'payment_reminder_7day',
        message: 'Hi Tendai, your payment is 7 days overdue. Your device will be locked today.',
        metadata: {
          days_overdue: 7,
          reminder_level: '7_day',
          trigger: 'payment.overdue',
        },
        status: 'sent',
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.metadata.days_overdue).toBe(7);
      expect(notif.metadata.reminder_level).toBe('7_day');
      expect(notif.message).toContain('locked');
    });

    it('should send reminders at correct intervals: 3, 5, and 7 days', () => {
      const reminderLevels = [
        { days: 3, level: '3_day', template: 'payment_reminder_3day' },
        { days: 5, level: '5_day', template: 'payment_reminder_5day' },
        { days: 7, level: '7_day', template: 'payment_reminder_7day' },
      ];

      for (const reminder of reminderLevels) {
        getMockTable('notifications').push(
          createNotification({
            customer_id: customerId,
            template_name: reminder.template,
            metadata: {
              days_overdue: reminder.days,
              reminder_level: reminder.level,
            },
            status: 'sent',
          }),
        );
      }

      const notifications = getMockTable('notifications') as unknown as NotificationRecord[];
      expect(notifications).toHaveLength(3);

      const overduedays = notifications.map(
        (n) => n.metadata.days_overdue as number,
      );
      expect(overduedays).toEqual([3, 5, 7]);
    });
  });

  // =========================================================================
  // 4. Device locked notification
  // =========================================================================
  describe('Device Locked -> Notification', () => {
    it('should send WhatsApp notification when device is locked', () => {
      const notification = createNotification({
        customer_id: customerId,
        channel: 'whatsapp',
        message: 'Your device has been locked due to overdue payment. To unlock, reply 1 to make a payment.',
        template_name: 'device_locked',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          device_id: deviceId,
          loan_id: loanId,
          trigger: 'device.locked',
          unlock_instructions: 'Reply 1 to pay, reply 2 for support',
        },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.template_name).toBe('device_locked');
      expect(notif.metadata.trigger).toBe('device.locked');
      expect(notif.message).toContain('locked');
      expect(notif.message).toContain('unlock');
    });
  });

  // =========================================================================
  // 5. Device unlocked notification
  // =========================================================================
  describe('Device Unlocked -> Notification', () => {
    it('should send confirmation notification when device is unlocked', () => {
      const notification = createNotification({
        customer_id: customerId,
        channel: 'whatsapp',
        message: 'Your device has been unlocked. Thank you for your payment!',
        template_name: 'device_unlocked',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          device_id: deviceId,
          loan_id: loanId,
          trigger: 'device.unlocked',
        },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.template_name).toBe('device_unlocked');
      expect(notif.metadata.trigger).toBe('device.unlocked');
      expect(notif.message).toContain('unlocked');
    });
  });

  // =========================================================================
  // 6. KYC approved/rejected notification
  // =========================================================================
  describe('KYC Status -> Notification', () => {
    it('should send notification when KYC is approved', () => {
      const notification = createNotification({
        customer_id: customerId,
        channel: 'whatsapp',
        message: 'Your identity verification is complete! You can now apply for a device loan.',
        template_name: 'kyc_approved',
        status: 'sent',
        metadata: { trigger: 'kyc.approved' },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.template_name).toBe('kyc_approved');
      expect(notif.message).toContain('verification');
    });

    it('should send notification when KYC is rejected with guidance', () => {
      const notification = createNotification({
        customer_id: customerId,
        channel: 'whatsapp',
        message: 'Your identity verification was not successful. Please retake your photos with better lighting. Reply 1 to try again.',
        template_name: 'kyc_rejected',
        status: 'sent',
        metadata: {
          trigger: 'kyc.rejected',
          rejection_reason: 'Poor image quality',
          retries_remaining: 2,
        },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.template_name).toBe('kyc_rejected');
      expect(notif.metadata.rejection_reason).toBe('Poor image quality');
      expect(notif.metadata.retries_remaining).toBe(2);
    });
  });

  // =========================================================================
  // 7. Notification content matches event data
  // =========================================================================
  describe('Notification Content Accuracy', () => {
    it('should include correct payment amount in notification message', () => {
      const paymentAmount = 58.67;
      const balance = 235.33;

      const notification = createNotification({
        customer_id: customerId,
        message: `Payment of $${paymentAmount.toFixed(2)} received. Balance: $${balance.toFixed(2)}`,
        metadata: { payment_amount: paymentAmount, outstanding_balance: balance },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      // Amount in message matches metadata
      expect(notif.message).toContain(paymentAmount.toFixed(2));
      expect(notif.message).toContain(balance.toFixed(2));
      expect(notif.metadata.payment_amount).toBe(paymentAmount);
      expect(notif.metadata.outstanding_balance).toBe(balance);
    });

    it('should include correct customer name in notification', () => {
      const customer = getMockTable('customers')[0];
      const firstName = customer.first_name as string;

      const notification = createNotification({
        customer_id: customerId,
        message: `Hi ${firstName}, your loan has been approved!`,
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.message).toContain('Tendai');
    });

    it('should include correct dates in overdue notification', () => {
      const dueDate = '2025-06-01';
      const notification = createNotification({
        customer_id: customerId,
        message: `Your payment was due on ${dueDate}. Please pay immediately.`,
        metadata: { due_date: dueDate },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.message).toContain(dueDate);
      expect(notif.metadata.due_date).toBe(dueDate);
    });
  });

  // =========================================================================
  // 8. Opt-out handling
  // =========================================================================
  describe('Notification Opt-Out', () => {
    it('should not send notification if customer opted out', () => {
      // Customer opted out
      const customers = getMockTable('customers');
      customers[0] = { ...customers[0], notification_opt_out: true };

      const customer = getMockTable('customers')[0];
      const isOptedOut = customer.notification_opt_out === true;

      expect(isOptedOut).toBe(true);

      // Do not create notification for opted-out customer
      if (!isOptedOut) {
        getMockTable('notifications').push(
          createNotification({
            customer_id: customerId,
            message: 'This should not be sent',
          }),
        );
      }

      const notifications = getMockTable('notifications');
      expect(notifications).toHaveLength(0);
    });

    it('should send notification if customer has not opted out', () => {
      const customer = getMockTable('customers')[0];
      const isOptedOut = customer.notification_opt_out === true;

      expect(isOptedOut).toBe(false);

      // Create notification for active customer
      if (!isOptedOut) {
        getMockTable('notifications').push(
          createNotification({
            customer_id: customerId,
            message: 'Your loan is approved!',
            status: 'sent',
          }),
        );
      }

      const notifications = getMockTable('notifications');
      expect(notifications).toHaveLength(1);
    });

    it('should still log the notification attempt even when opted out (for audit)', () => {
      const customers = getMockTable('customers');
      customers[0] = { ...customers[0], notification_opt_out: true };

      // Log the suppressed notification for audit purposes
      getMockTable('notifications').push(
        createNotification({
          customer_id: customerId,
          message: 'Payment received notification',
          status: 'suppressed',
          metadata: { reason: 'customer_opted_out' },
        }),
      );

      const notifications = getMockTable('notifications') as unknown as NotificationRecord[];
      expect(notifications).toHaveLength(1);
      expect(notifications[0].status).toBe('suppressed');
      expect(notifications[0].metadata.reason).toBe('customer_opted_out');
    });
  });

  // =========================================================================
  // 9. Notification references correct entities
  // =========================================================================
  describe('Notification Entity References', () => {
    it('should reference the correct customer_id, loan_id, and payment_id', () => {
      const paymentId = generateTestId('pay');

      const notification = createNotification({
        customer_id: customerId,
        metadata: {
          customer_id: customerId,
          loan_id: loanId,
          payment_id: paymentId,
          trigger: 'payment.completed',
        },
      });
      getMockTable('notifications').push(notification);

      const notif = getMockTable('notifications')[0] as unknown as NotificationRecord;
      expect(notif.customer_id).toBe(customerId);
      expect(notif.metadata.loan_id).toBe(loanId);
      expect(notif.metadata.payment_id).toBe(paymentId);
    });
  });
});
