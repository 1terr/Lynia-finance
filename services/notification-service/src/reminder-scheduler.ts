/**
 * Payment Reminder Scheduler Service
 *
 * Automated payment reminder system with:
 * - Pre-due reminders (7, 3, 1 days before)
 * - Post-due escalation (1, 3, 5, 7, 14, 30 days after)
 * - Smart scheduling (avoids off-hours)
 * - Payment link generation
 * - Opt-out handling
 * - Delivery tracking
 *
 * Triggered by EventBridge cron: rate(1 hour)
 */

import { db } from '../../shared/clients/database';
import axios from 'axios';
import logger from '../../shared/utils/logger';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL!;

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type ReminderType =
  | 'pre_due_7'
  | 'pre_due_3'
  | 'pre_due_1'
  | 'due_today'
  | 'overdue_1'
  | 'overdue_3'
  | 'overdue_5'
  | 'overdue_7'
  | 'overdue_14'
  | 'overdue_30';

export type ReminderTone = 'friendly' | 'reminder' | 'urgent' | 'warning' | 'firm' | 'collection' | 'default_notice';

export type ReminderStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped' | 'opted_out';

export interface ReminderScheduleEntry {
  days_offset: number;
  type: ReminderType;
  tone: ReminderTone;
}

export type ProductCategory = 'smartphone' | 'digital';

export interface PaymentDue {
  loan_id: string;
  customer_id: string;
  customer_name: string;
  phone_number: string;
  installment_number: number;
  amount_due: number;
  due_date: string;
  days_until_due: number;
  currency: string;
  product_category: ProductCategory;
}

export interface ReminderRecord {
  id?: string;
  loan_id: string;
  customer_id: string;
  reminder_type: ReminderType;
  tone: ReminderTone;
  scheduled_for: Date;
  sent_at?: Date;
  status: ReminderStatus;
  message_content: string;
  whatsapp_message_id?: string;
  payment_link?: string;
}

// ===================================================================
// REMINDER SCHEDULE CONFIGURATION
// ===================================================================

export const REMINDER_SCHEDULE: ReminderScheduleEntry[] = [
  { days_offset: -7, type: 'pre_due_7', tone: 'friendly' },
  { days_offset: -3, type: 'pre_due_3', tone: 'reminder' },
  { days_offset: -1, type: 'pre_due_1', tone: 'urgent' },
  { days_offset: 0, type: 'due_today', tone: 'urgent' },
  { days_offset: 1, type: 'overdue_1', tone: 'reminder' },
  { days_offset: 3, type: 'overdue_3', tone: 'warning' },
  { days_offset: 5, type: 'overdue_5', tone: 'warning' },
  { days_offset: 7, type: 'overdue_7', tone: 'firm' },
  { days_offset: 14, type: 'overdue_14', tone: 'collection' },
  { days_offset: 30, type: 'overdue_30', tone: 'default_notice' },
];

/**
 * Central Africa Time (CAT) offset from UTC in hours.
 * Zimbabwe does NOT observe daylight saving time — CAT is always UTC+2.
 * This constant is safe to use without DST adjustments.
 */
const CAT_OFFSET_HOURS = 2;

/** Off-hours: do not send between 9pm and 7am local time (CAT = UTC+2) */
const SEND_WINDOW_START = 7;
const SEND_WINDOW_END = 21;

// ===================================================================
// SMART SCHEDULING
// ===================================================================

/**
 * Check if current time is within the sending window (CAT timezone)
 */
export function isWithinSendingWindow(): boolean {
  const now = new Date();
  const catHour = (now.getUTCHours() + CAT_OFFSET_HOURS) % 24;
  return catHour >= SEND_WINDOW_START && catHour < SEND_WINDOW_END;
}

/**
 * Get the next valid sending time
 */
export function getNextSendingTime(): Date {
  const now = new Date();
  const catHour = (now.getUTCHours() + CAT_OFFSET_HOURS) % 24;

  if (catHour >= SEND_WINDOW_START && catHour < SEND_WINDOW_END) {
    return now;
  }

  // Schedule for 8am CAT next day (6am UTC)
  const next = new Date(now);
  if (catHour >= SEND_WINDOW_END) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  next.setUTCHours(6, 0, 0, 0);
  return next;
}

// ===================================================================
// PAYMENT LINK GENERATION
// ===================================================================

/**
 * Generate payment deep link for mobile money
 */
export function generatePaymentLink(params: {
  loan_id: string;
  amount: number;
  currency: string;
}): string {
  const baseUrl = process.env.PAYMENT_LINK_BASE_URL || 'https://pay.lynia.finance';
  const encodedRef = encodeURIComponent(params.loan_id);
  return `${baseUrl}/pay?ref=${encodedRef}&amount=${params.amount}&currency=${params.currency}`;
}

// ===================================================================
// MESSAGE TEMPLATES
// ===================================================================

/**
 * Generate reminder message based on type and payment details
 */
export function generateReminderMessage(
  type: ReminderType,
  payment: PaymentDue,
  paymentLink: string
): string {
  const name = payment.customer_name.split(' ')[0];
  const amount = `$${payment.amount_due.toFixed(2)}`;
  const dueDate = new Date(payment.due_date).toLocaleDateString('en-ZW', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (payment.product_category === 'digital') {
    return generateDigitalReminderMessage(type, name, amount, dueDate, paymentLink);
  }

  return generateSmartphoneReminderMessage(type, name, amount, dueDate, paymentLink);
}

/**
 * Reminder messages for smartphone loans (existing behavior — includes device lock warnings)
 */
function generateSmartphoneReminderMessage(
  type: ReminderType,
  name: string,
  amount: string,
  dueDate: string,
  paymentLink: string
): string {
  const templates: Record<ReminderType, string> = {
    pre_due_7: `Hi ${name}! Just a reminder - your payment of ${amount} is due on ${dueDate} (7 days).\n\nPay early to stay on track:\n${paymentLink}\n\nReply BALANCE to check your account.`,

    pre_due_3: `Hi ${name}, your payment of ${amount} is due in 3 days (${dueDate}).\n\nTap to pay now:\n${paymentLink}\n\nReply:\n1 - Pay now\n2 - Check balance`,

    pre_due_1: `${name}, your payment of ${amount} is due *tomorrow* (${dueDate}).\n\nPlease pay today to avoid late fees:\n${paymentLink}`,

    due_today: `${name}, your payment of ${amount} is *due today*.\n\nPay now to stay current:\n${paymentLink}\n\nNeed help? Reply HELP`,

    overdue_1: `Hi ${name}, your payment of ${amount} was due yesterday and is now *1 day overdue*.\n\nPlease pay as soon as possible:\n${paymentLink}\n\nHaving trouble? Reply EXTENSION to request more time.`,

    overdue_3: `${name}, your payment of ${amount} is now *3 days overdue*.\n\nPlease pay promptly to avoid further action:\n${paymentLink}\n\nReply EXTENSION to request an extension.`,

    overdue_5: `*Payment Warning*\n\n${name}, your payment of ${amount} is *5 days overdue*. Your device may be locked in 2 days if payment is not received.\n\nPay now: ${paymentLink}\n\nContact us: Reply HELP`,

    overdue_7: `*Device Lock Notice*\n\n${name}, your payment of ${amount} is *7 days overdue*. Your device has been *locked* until payment is received.\n\nPay now to unlock: ${paymentLink}\n\nNeed help? Reply HELP or call support.`,

    overdue_14: `*Collection Notice*\n\n${name}, your account is *14 days overdue* (${amount}). Please contact us immediately to discuss payment options.\n\nPay now: ${paymentLink}\n\nReply CALL to request a callback from our team.`,

    overdue_30: `*Default Notice*\n\n${name}, your account is *30 days overdue* (${amount}). This will affect your credit record.\n\nPay now: ${paymentLink}\n\nPlease contact us urgently at support@lynia.finance or reply HELP.`,
  };

  return templates[type];
}

/**
 * Reminder messages for digital loans (no device lock — leverage is credit score impact and collections)
 */
function generateDigitalReminderMessage(
  type: ReminderType,
  name: string,
  amount: string,
  dueDate: string,
  paymentLink: string
): string {
  const templates: Record<ReminderType, string> = {
    pre_due_7: `Hi ${name}! Just a reminder - your payment of ${amount} is due on ${dueDate} (7 days).\n\nPay early to stay on track:\n${paymentLink}\n\nReply BALANCE to check your account.`,

    pre_due_3: `Hi ${name}, your payment of ${amount} is due in 3 days (${dueDate}).\n\nTap to pay now:\n${paymentLink}\n\nReply:\n1 - Pay now\n2 - Check balance`,

    pre_due_1: `${name}, your payment of ${amount} is due *tomorrow* (${dueDate}).\n\nPlease pay today to avoid late fees:\n${paymentLink}`,

    due_today: `${name}, your payment of ${amount} is *due today*.\n\nPay now to stay current:\n${paymentLink}\n\nNeed help? Reply HELP`,

    overdue_1: `Hi ${name}, your payment of ${amount} was due yesterday and is now *1 day overdue*.\n\nPlease pay as soon as possible:\n${paymentLink}\n\nHaving trouble? Reply EXTENSION to request more time.`,

    overdue_3: `${name}, your payment of ${amount} is now *3 days overdue*.\n\nPlease pay promptly to avoid further action:\n${paymentLink}\n\nReply EXTENSION to request an extension.`,

    overdue_5: `*Credit Standing Warning*\n\n${name}, your payment of ${amount} is *5 days overdue*. Late payments will lower your credit score and reduce your future loan limit.\n\nPay now to protect your credit standing:\n${paymentLink}\n\nContact us: Reply HELP`,

    overdue_7: `*Collections Notice*\n\n${name}, your payment of ${amount} is *7 days overdue*. Your account has been sent to our collections team.\n\nPay now to resolve this:\n${paymentLink}\n\nNeed help? Reply HELP or call support.`,

    overdue_14: `*Final Notice*\n\n${name}, your account is *14 days overdue* (${amount}). If payment is not received, your account may be reported to the credit bureau. This will affect your ability to get loans in the future.\n\nPay now: ${paymentLink}\n\nReply CALL to request a callback from our team.`,

    overdue_30: `*Default Notice*\n\n${name}, your account is *30 days overdue* (${amount}). Your account has been reported as in default and legal action may follow.\n\nPay now: ${paymentLink}\n\nPlease contact us urgently at support@lynia.finance or reply HELP.`,
  };

  return templates[type];
}

// ===================================================================
// CORE SCHEDULER LOGIC
// ===================================================================

/**
 * Find all payments that need reminders today
 */
export async function findPaymentsDueForReminders(): Promise<PaymentDue[]> {
  const today = new Date().toISOString().split('T')[0];

  // Look for loans with upcoming or overdue installments
  const { data: loans, error } = await db
    .from('loans')
    .select(`
      id,
      customer_id,
      next_payment_date,
      monthly_installment_amount,
      currency,
      product_category,
      customers (
        id,
        phone_number,
        first_name,
        last_name
      )
    `)
    .in('loan_status', ['active', 'delinquent'])
    .not('next_payment_date', 'is', null)
    .execute();

  if (error || !loans) {
    logger.error('Error fetching loans for reminders', { action: 'notification.reminder.fetch', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return [];
  }

  const payments: PaymentDue[] = [];

  for (const loan of loans) {
    const customer = loan.customers as Record<string, unknown>;
    if (!customer?.phone_number) continue;

    const dueDate = new Date(loan.next_payment_date);
    const todayDate = new Date(today);
    const diffMs = dueDate.getTime() - todayDate.getTime();
    const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));

    payments.push({
      loan_id: loan.id,
      customer_id: customer.id as string,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      phone_number: customer.phone_number as string,
      installment_number: 0, // determined from loan schedule
      amount_due: loan.monthly_installment_amount,
      due_date: loan.next_payment_date,
      days_until_due: daysUntilDue,
      currency: loan.currency || 'USD',
      product_category: (loan.product_category as ProductCategory) || 'smartphone',
    });
  }

  return payments;
}

/**
 * Check if a reminder has already been sent for this loan/type combination
 */
async function hasReminderBeenSent(loanId: string, reminderType: ReminderType): Promise<boolean> {
  const { data } = await db
    .from('payment_reminders')
    .select('id')
    .eq('loan_id', loanId)
    .eq('reminder_type', reminderType)
    .in('status', ['sent', 'delivered', 'read'])
    .limit(1)
    .execute();

  return !!data && data.length > 0;
}

/**
 * Check if customer has opted out of reminders
 */
async function hasOptedOut(customerId: string): Promise<boolean> {
  const { data } = await db
    .from('customer_preferences')
    .select('reminder_opt_out')
    .eq('customer_id', customerId)
    .single()
    .execute();

  return data?.reminder_opt_out === true;
}

/**
 * Send a single reminder via WhatsApp
 */
async function sendReminder(
  payment: PaymentDue,
  reminderType: ReminderType,
  tone: ReminderTone
): Promise<ReminderRecord> {
  const paymentLink = generatePaymentLink({
    loan_id: payment.loan_id,
    amount: payment.amount_due,
    currency: payment.currency,
  });

  const messageContent = generateReminderMessage(reminderType, payment, paymentLink);

  const record: ReminderRecord = {
    loan_id: payment.loan_id,
    customer_id: payment.customer_id,
    reminder_type: reminderType,
    tone,
    scheduled_for: new Date(),
    status: 'pending',
    message_content: messageContent,
    payment_link: paymentLink,
  };

  try {
    // Send via WhatsApp service
    const response = await axios.post(WHATSAPP_API_URL, {
      to: payment.phone_number,
      message: messageContent,
    });

    record.status = 'sent';
    record.sent_at = new Date();
    record.whatsapp_message_id = response.data.messageId;
  } catch (error) {
    logger.error('Failed to send reminder', { action: 'notification.reminder.send', loanId: payment.loan_id, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    record.status = 'failed';
  }

  // Store reminder record
  await db.from('payment_reminders').insert({
    loan_id: record.loan_id,
    customer_id: record.customer_id,
    reminder_type: record.reminder_type,
    tone: record.tone,
    scheduled_for: record.scheduled_for,
    sent_at: record.sent_at,
    status: record.status,
    message_content: record.message_content,
    whatsapp_message_id: record.whatsapp_message_id,
    payment_link: record.payment_link,
  }).execute();

  return record;
}

// ===================================================================
// MAIN SCHEDULER HANDLER
// ===================================================================

/**
 * Main scheduler function - called by EventBridge cron every hour
 */
export async function processPaymentReminders(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const stats = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  // Check sending window
  if (!isWithinSendingWindow()) {
    logger.info('Outside sending window (7am-9pm CAT). Skipping.', { action: 'notification.reminder.process' });
    return stats;
  }

  // Get all payments needing reminders
  const payments = await findPaymentsDueForReminders();
  logger.info('Found active loan payments to check', { action: 'notification.reminder.process', count: payments.length });

  for (const payment of payments) {
    stats.processed++;

    // Check opt-out
    if (await hasOptedOut(payment.customer_id)) {
      stats.skipped++;
      continue;
    }

    // Find which reminder to send based on days until due
    for (const schedule of REMINDER_SCHEDULE) {
      // Check if this schedule entry matches the current days offset
      if (payment.days_until_due !== -schedule.days_offset) continue;

      // Check if already sent
      if (await hasReminderBeenSent(payment.loan_id, schedule.type)) {
        stats.skipped++;
        continue;
      }

      // Send the reminder
      const result = await sendReminder(payment, schedule.type, schedule.tone);

      if (result.status === 'sent') {
        stats.sent++;
        logger.info('Sent reminder', { action: 'notification.reminder.send', reminderType: schedule.type, loanId: payment.loan_id });
      } else {
        stats.failed++;
        logger.error('Failed reminder', { action: 'notification.reminder.send', reminderType: schedule.type, loanId: payment.loan_id });
      }
    }
  }

  logger.info('Reminder processing complete', { action: 'notification.reminder.process', ...stats });
  return stats;
}

// ===================================================================
// OPT-OUT HANDLING
// ===================================================================

/**
 * Handle customer opt-out request
 */
export async function handleReminderOptOut(customerId: string): Promise<void> {
  await db
    .from('customer_preferences')
    .upsert({
      customer_id: customerId,
      reminder_opt_out: true,
      updated_at: new Date(),
    })
    .execute();

  logger.info('Customer opted out of reminders', { action: 'notification.reminder.opt-out', customerId });
}

/**
 * Handle customer opt-in request
 */
export async function handleReminderOptIn(customerId: string): Promise<void> {
  await db
    .from('customer_preferences')
    .upsert({
      customer_id: customerId,
      reminder_opt_out: false,
      updated_at: new Date(),
    })
    .execute();

  logger.info('Customer opted in to reminders', { action: 'notification.reminder.opt-in', customerId });
}

// ===================================================================
// REMINDER ANALYTICS
// ===================================================================

/**
 * Get reminder delivery statistics
 */
export async function getReminderAnalytics(dateRange?: { from: string; to: string }): Promise<{
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  delivery_rate: number;
  read_rate: number;
  by_type: Record<string, number>;
}> {
  let query = db
    .from('payment_reminders')
    .select('reminder_type, status');

  if (dateRange) {
    query = query.gte('sent_at', dateRange.from).lte('sent_at', dateRange.to);
  }

  const { data: reminders } = await query.execute();

  if (!reminders || reminders.length === 0) {
    return {
      total_sent: 0, total_delivered: 0, total_read: 0, total_failed: 0,
      delivery_rate: 0, read_rate: 0, by_type: {},
    };
  }

  const total_sent = reminders.filter((r: { status: string }) => r.status === 'sent').length;
  const total_delivered = reminders.filter((r: { status: string }) => r.status === 'delivered').length;
  const total_read = reminders.filter((r: { status: string }) => r.status === 'read').length;
  const total_failed = reminders.filter((r: { status: string }) => r.status === 'failed').length;

  const by_type: Record<string, number> = {};
  for (const r of reminders) {
    by_type[r.reminder_type] = (by_type[r.reminder_type] || 0) + 1;
  }

  return {
    total_sent,
    total_delivered,
    total_read,
    total_failed,
    delivery_rate: total_sent > 0 ? (total_delivered / total_sent) * 100 : 0,
    read_rate: total_delivered > 0 ? (total_read / total_delivered) * 100 : 0,
    by_type,
  };
}
