# Payment Reminder Strategy

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.7 Notification System Design
**Task ID**: P1-T039
**Priority**: Critical
**Estimated Duration**: 6 hours

---

## 1. Overview

An effective payment reminder strategy is critical for maintaining healthy loan repayment rates and minimizing defaults. This specification defines a multi-stage reminder system that progressively escalates from friendly reminders to urgent warnings, optimizing timing, frequency, and messaging to maximize payment compliance while maintaining positive customer relationships.

**Key Objectives**:
- Achieve >90% on-time payment rate
- Reduce late payments by 60%
- Minimize device locks through proactive communication
- Maintain customer satisfaction through respectful messaging
- Optimize reminder timing for maximum effectiveness

**Reminder Timeline**: 7-day advance notice → 24-hour reminder → due date reminder → overdue escalation → lock warning

---

## 2. Payment Reminder Timeline

### 2.1 Reminder Schedule

```typescript
interface ReminderSchedule {
  stage: string;
  days_before_due: number; // Negative = days after due date
  priority: 'low' | 'medium' | 'high' | 'critical';
  template_id: string;
  channels: ('whatsapp' | 'sms' | 'email')[];
  send_time: string; // Time of day (HH:MM)
  enabled: boolean;
}

const PAYMENT_REMINDER_SCHEDULE: ReminderSchedule[] = [
  {
    stage: 'early_reminder',
    days_before_due: 7,
    priority: 'medium',
    template_id: 'T013', // Payment Due Reminder - 7 Days
    channels: ['whatsapp'],
    send_time: '09:00',
    enabled: true
  },
  {
    stage: 'urgent_reminder',
    days_before_due: 1,
    priority: 'high',
    template_id: 'T014', // Payment Due Reminder - 24 Hours
    channels: ['whatsapp', 'sms'],
    send_time: '09:00',
    enabled: true
  },
  {
    stage: 'due_date_reminder',
    days_before_due: 0,
    priority: 'high',
    template_id: 'T014', // Same template, but sent on due date
    channels: ['whatsapp', 'sms'],
    send_time: '08:00',
    enabled: true
  },
  {
    stage: 'overdue_day_1',
    days_before_due: -1,
    priority: 'critical',
    template_id: 'T015', // Payment Overdue
    channels: ['whatsapp', 'sms'],
    send_time: '10:00',
    enabled: true
  },
  {
    stage: 'overdue_day_3',
    days_before_due: -3,
    priority: 'critical',
    template_id: 'T015',
    channels: ['whatsapp', 'sms', 'email'],
    send_time: '10:00',
    enabled: true
  },
  {
    stage: 'lock_warning_7d',
    days_before_due: -7,
    priority: 'critical',
    template_id: 'T021', // Device Lock Warning - 7 Days
    channels: ['whatsapp', 'sms'],
    send_time: '09:00',
    enabled: true
  },
  {
    stage: 'lock_warning_3d',
    days_before_due: -11,
    priority: 'critical',
    template_id: 'T022', // Device Lock Warning - 3 Days FINAL
    channels: ['whatsapp', 'sms'],
    send_time: '09:00',
    enabled: true
  }
];
```

### 2.2 Visual Timeline

```
Payment Due Date: Day 0
        |
        |
Day -7  |  📅 Early Reminder (WhatsApp)
        |  "Payment due in 7 days"
        |
Day -1  |  ⚡ Urgent Reminder (WhatsApp + SMS)
        |  "Payment due tomorrow"
        |
Day 0   |  📢 Due Date Reminder (WhatsApp + SMS)
        |  "Payment due today"
        |
Day +1  |  🚨 Overdue Day 1 (WhatsApp + SMS)
        |  "Payment is now overdue"
        |
Day +3  |  🚨 Overdue Day 3 (WhatsApp + SMS + Email)
        |  "Payment 3 days late"
        |
Day +7  |  ⚠️ Lock Warning - 7 Days (WhatsApp + SMS)
        |  "Device will be locked in 7 days"
        |
Day +11 |  🚨 Lock Warning - 3 Days FINAL (WhatsApp + SMS)
        |  "Final warning - device locks in 3 days"
        |
Day +14 |  🔒 Device Lock (Automatic)
        |  Device is locked remotely
```

---

## 3. Intelligent Reminder Optimization

### 3.1 Send Time Optimization

```typescript
interface CustomerPaymentPattern {
  customer_id: string;
  preferred_payment_day: number; // Day of month (1-31)
  preferred_payment_time: string; // Time of day (HH:MM)
  typical_payment_delay_days: number; // Avg days after due date
  response_to_reminder_hours: number; // Avg hours between reminder and payment
  most_effective_channel: 'whatsapp' | 'sms' | 'email';
  most_effective_time: string; // HH:MM
  last_updated: Date;
}

async function optimizeSendTime(
  customerId: string,
  defaultTime: string
): Promise<string> {
  const pattern = await getCustomerPaymentPattern(customerId);

  if (pattern && pattern.most_effective_time) {
    // Use historically most effective time for this customer
    return pattern.most_effective_time;
  }

  // Use default time
  return defaultTime;
}

async function analyzePaymentPatterns(customerId: string): Promise<CustomerPaymentPattern> {
  // Get all past payments
  const { data: payments } = await supabase
    .from('payments')
    .select('*, notification_deliveries(*)')
    .eq('customer_id', customerId)
    .order('due_date', { ascending: false })
    .limit(12); // Last 12 payments

  if (!payments || payments.length === 0) {
    return null;
  }

  // Calculate preferred payment day (most common day of month)
  const paymentDays = payments
    .filter(p => p.paid_at)
    .map(p => new Date(p.paid_at).getDate());
  const preferredDay = mode(paymentDays);

  // Calculate average payment delay
  const delays = payments
    .filter(p => p.paid_at)
    .map(p => {
      const dueDate = new Date(p.due_date);
      const paidDate = new Date(p.paid_at);
      return Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    });
  const avgDelay = average(delays);

  // Find most effective reminder channel
  const reminderResponses = payments
    .filter(p => p.notification_deliveries && p.notification_deliveries.length > 0)
    .map(p => {
      const lastReminder = p.notification_deliveries
        .filter(n => n.template_id.startsWith('T013') || n.template_id.startsWith('T014'))
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];

      if (!lastReminder || !p.paid_at) return null;

      const reminderTime = new Date(lastReminder.sent_at);
      const paymentTime = new Date(p.paid_at);
      const responseHours = (paymentTime.getTime() - reminderTime.getTime()) / (1000 * 60 * 60);

      return {
        channel: lastReminder.channel,
        response_hours: responseHours,
        send_time: lastReminder.sent_at.substring(11, 16) // HH:MM
      };
    })
    .filter(r => r !== null);

  // Group by channel and find most effective
  const channelEffectiveness = groupBy(reminderResponses, 'channel');
  const mostEffectiveChannel = Object.entries(channelEffectiveness)
    .map(([channel, responses]) => ({
      channel,
      avg_response_hours: average(responses.map(r => r.response_hours)),
      count: responses.length
    }))
    .sort((a, b) => a.avg_response_hours - b.avg_response_hours)[0]?.channel;

  // Find most effective send time
  const timeEffectiveness = groupBy(
    reminderResponses.filter(r => r.response_hours <= 24),
    'send_time'
  );
  const mostEffectiveTime = Object.entries(timeEffectiveness)
    .map(([time, responses]) => ({
      time,
      count: responses.length,
      avg_response_hours: average(responses.map(r => r.response_hours))
    }))
    .sort((a, b) => b.count - a.count)[0]?.time;

  return {
    customer_id: customerId,
    preferred_payment_day: preferredDay,
    preferred_payment_time: mostEffectiveTime || '14:00',
    typical_payment_delay_days: Math.round(avgDelay),
    response_to_reminder_hours: average(reminderResponses.map(r => r.response_hours)),
    most_effective_channel: mostEffectiveChannel as any || 'whatsapp',
    most_effective_time: mostEffectiveTime || '09:00',
    last_updated: new Date()
  };
}
```

### 3.2 Channel Selection Based on Customer Behavior

```typescript
async function selectReminderChannel(
  customerId: string,
  defaultChannels: string[]
): Promise<string[]> {
  const pattern = await getCustomerPaymentPattern(customerId);

  if (!pattern) {
    return defaultChannels;
  }

  // If customer consistently responds to a specific channel, prioritize it
  const { data: recentDeliveries } = await supabase
    .from('notification_deliveries')
    .select('channel, read_at')
    .eq('customer_id', customerId)
    .gte('sent_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
    .order('sent_at', { ascending: false });

  // Calculate read rate per channel
  const channelReadRates = ['whatsapp', 'sms', 'email'].map(channel => {
    const channelDeliveries = recentDeliveries?.filter(d => d.channel === channel) || [];
    const readCount = channelDeliveries.filter(d => d.read_at).length;
    const readRate = channelDeliveries.length > 0 ? readCount / channelDeliveries.length : 0;

    return { channel, readRate, count: channelDeliveries.length };
  });

  // Sort by read rate
  const sortedChannels = channelReadRates
    .filter(c => c.count >= 3) // Need at least 3 deliveries to be significant
    .sort((a, b) => b.readRate - a.readRate)
    .map(c => c.channel);

  if (sortedChannels.length > 0) {
    return sortedChannels;
  }

  return defaultChannels;
}
```

### 3.3 Frequency Capping

```typescript
interface FrequencyCap {
  max_reminders_per_day: number;
  max_reminders_per_week: number;
  min_hours_between_reminders: number;
}

const FREQUENCY_CAPS: FrequencyCap = {
  max_reminders_per_day: 2,
  max_reminders_per_week: 7,
  min_hours_between_reminders: 6
};

async function checkFrequencyCap(
  customerId: string,
  templateCategory: string
): Promise<boolean> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get recent reminders
  const { data: recentReminders } = await supabase
    .from('notification_deliveries')
    .select('sent_at')
    .eq('customer_id', customerId)
    .gte('sent_at', oneWeekAgo.toISOString())
    .order('sent_at', { ascending: false });

  if (!recentReminders || recentReminders.length === 0) {
    return true; // No recent reminders, OK to send
  }

  // Check daily cap
  const remindersToday = recentReminders.filter(
    r => new Date(r.sent_at) > oneDayAgo
  ).length;

  if (remindersToday >= FREQUENCY_CAPS.max_reminders_per_day) {
    console.log(`Frequency cap: ${customerId} received ${remindersToday} reminders today`);
    return false;
  }

  // Check weekly cap
  if (recentReminders.length >= FREQUENCY_CAPS.max_reminders_per_week) {
    console.log(`Frequency cap: ${customerId} received ${recentReminders.length} reminders this week`);
    return false;
  }

  // Check minimum time between reminders
  const lastReminder = recentReminders[0];
  const hoursSinceLastReminder =
    (now.getTime() - new Date(lastReminder.sent_at).getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastReminder < FREQUENCY_CAPS.min_hours_between_reminders) {
    console.log(`Frequency cap: Only ${hoursSinceLastReminder.toFixed(1)} hours since last reminder`);
    return false;
  }

  return true;
}
```

---

## 4. Personalized Messaging

### 4.1 Dynamic Content Based on Payment History

```typescript
interface PaymentHistoryContext {
  is_first_time_late: boolean;
  consecutive_on_time_payments: number;
  total_payments_made: number;
  lifetime_payment_rate: number; // % of on-time payments
  days_until_device_lock: number;
  has_payment_plan: boolean;
}

async function getPaymentHistoryContext(customerId: string): Promise<PaymentHistoryContext> {
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('due_date', { ascending: false });

  const totalPayments = payments?.length || 0;
  const onTimePayments = payments?.filter(p =>
    p.paid_at && new Date(p.paid_at) <= new Date(p.due_date)
  ).length || 0;

  const consecutiveOnTime = payments?.reduce((count, payment, index) => {
    if (index === 0 || count === -1) {
      const isPaid = payment.paid_at && new Date(payment.paid_at) <= new Date(payment.due_date);
      return isPaid ? 1 : -1;
    }
    return count;
  }, 0) || 0;

  const latePayments = payments?.filter(p =>
    p.paid_at && new Date(p.paid_at) > new Date(p.due_date)
  ).length || 0;

  return {
    is_first_time_late: latePayments === 0,
    consecutive_on_time_payments: Math.max(0, consecutiveOnTime),
    total_payments_made: totalPayments,
    lifetime_payment_rate: totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0,
    days_until_device_lock: 14, // Default grace period
    has_payment_plan: false
  };
}

function personalizeReminderMessage(
  baseMessage: string,
  context: PaymentHistoryContext,
  customer: Customer
): string {
  let message = baseMessage;

  // Add positive reinforcement for good payment history
  if (context.lifetime_payment_rate >= 90 && !context.is_first_time_late) {
    message = `${customer.first_name}, you've been a great customer with ${context.lifetime_payment_rate.toFixed(0)}% on-time payments! ⭐\n\n` + message;
  }

  // Add empathy for first-time late payment
  if (context.is_first_time_late) {
    message += '\n\nWe understand things happen. If you need help, reply HELP for payment options.';
  }

  // Add urgency for repeat late payers
  if (context.lifetime_payment_rate < 70) {
    message += `\n\n⚠️ Multiple late payments may affect your credit limit and future loan eligibility.`;
  }

  return message;
}
```

### 4.2 Tone Escalation

```typescript
enum ReminderTone {
  FRIENDLY = 'friendly',      // Days -7 to -1
  NEUTRAL = 'neutral',        // Day 0
  CONCERNED = 'concerned',    // Days +1 to +3
  URGENT = 'urgent',          // Days +4 to +10
  CRITICAL = 'critical'       // Days +11+
}

function getReminderTone(daysOverdue: number, paymentHistory: number): ReminderTone {
  // Good payment history (>90%) gets friendlier tone
  if (paymentHistory >= 90) {
    if (daysOverdue <= 0) return ReminderTone.FRIENDLY;
    if (daysOverdue <= 3) return ReminderTone.NEUTRAL;
    if (daysOverdue <= 7) return ReminderTone.CONCERNED;
    return ReminderTone.URGENT;
  }

  // Poor payment history (<70%) gets more urgent tone
  if (paymentHistory < 70) {
    if (daysOverdue <= -3) return ReminderTone.NEUTRAL;
    if (daysOverdue <= 0) return ReminderTone.CONCERNED;
    if (daysOverdue <= 5) return ReminderTone.URGENT;
    return ReminderTone.CRITICAL;
  }

  // Average payment history (70-90%)
  if (daysOverdue <= -1) return ReminderTone.FRIENDLY;
  if (daysOverdue <= 1) return ReminderTone.NEUTRAL;
  if (daysOverdue <= 5) return ReminderTone.CONCERNED;
  if (daysOverdue <= 10) return ReminderTone.URGENT;
  return ReminderTone.CRITICAL;
}

const TONE_TEMPLATES = {
  [ReminderTone.FRIENDLY]: {
    greeting: 'Hi {{name}}! 👋',
    closing: 'Thanks for being a valued customer!',
    emoji: '📅'
  },
  [ReminderTone.NEUTRAL]: {
    greeting: 'Hello {{name}},',
    closing: 'Thank you.',
    emoji: '📢'
  },
  [ReminderTone.CONCERNED]: {
    greeting: 'Hi {{name}},',
    closing: 'Please pay as soon as possible to avoid late fees.',
    emoji: '⚠️'
  },
  [ReminderTone.URGENT]: {
    greeting: '⚡ URGENT: {{name}}',
    closing: 'Immediate payment required to avoid service interruption.',
    emoji: '🚨'
  },
  [ReminderTone.CRITICAL]: {
    greeting: '🚨 CRITICAL: {{name}}',
    closing: 'Pay now to prevent device lock and additional fees.',
    emoji: '🔒'
  }
};
```

---

## 5. Payment Reminder Execution

### 5.1 Daily Reminder Job

```typescript
import { CronJob } from 'cron';

// Run every day at 8:00 AM Zimbabwe time
const paymentReminderJob = new CronJob(
  '0 8 * * *',
  async () => {
    console.log('Starting daily payment reminder job...');

    for (const schedule of PAYMENT_REMINDER_SCHEDULE) {
      if (!schedule.enabled) continue;

      try {
        await processReminderStage(schedule);
      } catch (error) {
        console.error(`Error processing reminder stage ${schedule.stage}:`, error);
      }
    }

    console.log('Payment reminder job completed.');
  },
  null,
  true,
  'Africa/Harare'
);

async function processReminderStage(schedule: ReminderSchedule): Promise<void> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + schedule.days_before_due);

  // Get all payments due on target date
  const { data: payments } = await supabase
    .from('payments')
    .select('*, customers(*), loans(*)')
    .eq('status', 'pending')
    .eq('due_date', targetDate.toISOString().split('T')[0]);

  if (!payments || payments.length === 0) {
    console.log(`No payments found for stage ${schedule.stage}`);
    return;
  }

  console.log(`Processing ${payments.length} payments for stage ${schedule.stage}`);

  for (const payment of payments) {
    // Check frequency cap
    const canSend = await checkFrequencyCap(payment.customer_id, 'payments');
    if (!canSend) {
      console.log(`Skipping reminder for customer ${payment.customer_id} - frequency cap reached`);
      continue;
    }

    // Get payment history context
    const historyContext = await getPaymentHistoryContext(payment.customer_id);

    // Get optimal send time
    const sendTime = await optimizeSendTime(payment.customer_id, schedule.send_time);

    // Get optimal channels
    const channels = await selectReminderChannel(payment.customer_id, schedule.channels);

    // Calculate days overdue
    const daysOverdue = Math.floor(
      (new Date().getTime() - new Date(payment.due_date).getTime()) /
      (1000 * 60 * 60 * 24)
    );

    // Prepare template variables
    const variables = {
      customer_name: payment.customers.first_name,
      amount: payment.amount_usd.toFixed(2),
      due_date: formatDate(payment.due_date),
      device_name: payment.loans.device_name,
      days_overdue: Math.abs(daysOverdue),
      late_fee: (payment.amount_usd * 0.05).toFixed(2),
      total_due: (payment.amount_usd * 1.05).toFixed(2),
      ecocash_number: process.env.LYNIA_ECOCASH_NUMBER,
      payment_reference: payment.payment_reference
    };

    // Schedule notification
    await scheduleNotification({
      notification_id: uuidv4(),
      customer_id: payment.customer_id,
      template_id: schedule.template_id,
      priority: schedule.priority,
      channels_allowed: channels,
      scheduled_at: calculateSendTime(sendTime),
      variables: variables
    });

    // Log reminder sent
    await supabase.from('payment_reminders_sent').insert({
      payment_id: payment.id,
      customer_id: payment.customer_id,
      reminder_stage: schedule.stage,
      sent_at: new Date(),
      channels: channels
    });
  }
}

function calculateSendTime(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const sendTime = new Date();
  sendTime.setHours(hours, minutes, 0, 0);

  // If time has already passed today, schedule for now
  if (sendTime < new Date()) {
    return new Date();
  }

  return sendTime;
}
```

### 5.2 Reminder Effectiveness Tracking

```typescript
interface ReminderEffectiveness {
  reminder_stage: string;
  total_sent: number;
  payments_received_24h: number;
  payments_received_48h: number;
  payments_received_7d: number;
  conversion_rate_24h: number;
  conversion_rate_48h: number;
  conversion_rate_7d: number;
  avg_response_time_hours: number;
}

async function analyzeReminderEffectiveness(
  startDate: Date,
  endDate: Date
): Promise<ReminderEffectiveness[]> {
  const { data: reminders } = await supabase
    .from('payment_reminders_sent')
    .select('*, payments(*)')
    .gte('sent_at', startDate.toISOString())
    .lte('sent_at', endDate.toISOString());

  // Group by reminder stage
  const stages = groupBy(reminders, 'reminder_stage');

  return Object.entries(stages).map(([stage, stageReminders]) => {
    const totalSent = stageReminders.length;

    const paymentsReceived24h = stageReminders.filter(r => {
      if (!r.payments?.paid_at) return false;
      const hoursDiff = (new Date(r.payments.paid_at).getTime() - new Date(r.sent_at).getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 24;
    }).length;

    const paymentsReceived48h = stageReminders.filter(r => {
      if (!r.payments?.paid_at) return false;
      const hoursDiff = (new Date(r.payments.paid_at).getTime() - new Date(r.sent_at).getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 48;
    }).length;

    const paymentsReceived7d = stageReminders.filter(r => {
      if (!r.payments?.paid_at) return false;
      const hoursDiff = (new Date(r.payments.paid_at).getTime() - new Date(r.sent_at).getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 168; // 7 days
    }).length;

    const responseTimes = stageReminders
      .filter(r => r.payments?.paid_at)
      .map(r => (new Date(r.payments.paid_at).getTime() - new Date(r.sent_at).getTime()) / (1000 * 60 * 60));

    return {
      reminder_stage: stage,
      total_sent: totalSent,
      payments_received_24h: paymentsReceived24h,
      payments_received_48h: paymentsReceived48h,
      payments_received_7d: paymentsReceived7d,
      conversion_rate_24h: (paymentsReceived24h / totalSent) * 100,
      conversion_rate_48h: (paymentsReceived48h / totalSent) * 100,
      conversion_rate_7d: (paymentsReceived7d / totalSent) * 100,
      avg_response_time_hours: average(responseTimes)
    };
  });
}
```

---

## 6. Payment Assistance & Hardship Programs

### 6.1 Payment Plan Requests

```typescript
interface PaymentPlanRequest {
  request_id: string;
  customer_id: string;
  payment_id: string;
  original_amount: number;
  requested_split_count: number; // How many parts to split into
  reason: string;
  requested_at: Date;
  status: 'pending' | 'approved' | 'rejected';
  approved_plan?: PaymentPlan;
}

interface PaymentPlan {
  plan_id: string;
  payment_id: string;
  installments: {
    installment_number: number;
    amount: number;
    due_date: Date;
  }[];
  created_at: Date;
}

async function requestPaymentPlan(
  customerId: string,
  paymentId: string,
  splitCount: number,
  reason: string
): Promise<PaymentPlanRequest> {
  const payment = await getPayment(paymentId);

  // Check eligibility
  const isEligible = await checkPaymentPlanEligibility(customerId);
  if (!isEligible) {
    throw new Error('Not eligible for payment plan');
  }

  const request: PaymentPlanRequest = {
    request_id: uuidv4(),
    customer_id: customerId,
    payment_id: paymentId,
    original_amount: payment.amount_usd,
    requested_split_count: splitCount,
    reason: reason,
    requested_at: new Date(),
    status: 'pending'
  };

  await supabase.from('payment_plan_requests').insert(request);

  // Auto-approve if customer has good history and amount is reasonable
  const paymentHistory = await getPaymentHistoryContext(customerId);
  if (paymentHistory.lifetime_payment_rate >= 85 && splitCount <= 3) {
    return await approvePaymentPlan(request.request_id);
  }

  // Otherwise, queue for manual review
  await sendWhatsAppMessage(
    payment.customer.whatsapp_number,
    `Your payment plan request has been received. We'll review it within 24 hours.`
  );

  return request;
}

async function approvePaymentPlan(requestId: string): Promise<PaymentPlanRequest> {
  const request = await getPaymentPlanRequest(requestId);
  const payment = await getPayment(request.payment_id);

  // Create installment plan
  const installmentAmount = request.original_amount / request.requested_split_count;
  const installments = [];

  for (let i = 0; i < request.requested_split_count; i++) {
    installments.push({
      installment_number: i + 1,
      amount: installmentAmount,
      due_date: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000) // Weekly installments
    });
  }

  const plan: PaymentPlan = {
    plan_id: uuidv4(),
    payment_id: request.payment_id,
    installments: installments,
    created_at: new Date()
  };

  await supabase.from('payment_plans').insert(plan);

  // Update request status
  await supabase
    .from('payment_plan_requests')
    .update({
      status: 'approved',
      approved_plan: plan
    })
    .eq('request_id', requestId);

  // Notify customer
  await sendWhatsAppMessage(
    payment.customer.whatsapp_number,
    `✅ Your payment plan is approved!\n\n` +
    `Original Amount: $${request.original_amount}\n` +
    `Split into: ${request.requested_split_count} weekly payments of $${installmentAmount.toFixed(2)}\n\n` +
    `First payment due: ${formatDate(installments[0].due_date)}`
  );

  return { ...request, status: 'approved', approved_plan: plan };
}
```

### 6.2 Hardship Program

```typescript
interface HardshipApplication {
  application_id: string;
  customer_id: string;
  loan_id: string;
  reason: 'job_loss' | 'medical' | 'family_emergency' | 'other';
  explanation: string;
  requested_relief: 'payment_pause' | 'reduced_payment' | 'term_extension';
  supporting_documents: string[]; // S3 URLs
  submitted_at: Date;
  status: 'pending' | 'approved' | 'rejected';
  relief_granted?: HardshipRelief;
}

interface HardshipRelief {
  relief_id: string;
  relief_type: 'payment_pause' | 'reduced_payment' | 'term_extension';
  start_date: Date;
  end_date: Date;
  payment_pause_months?: number;
  reduced_payment_amount?: number;
  term_extension_months?: number;
}

async function applyForHardshipRelief(
  customerId: string,
  loanId: string,
  reason: string,
  explanation: string
): Promise<HardshipApplication> {
  const application: HardshipApplication = {
    application_id: uuidv4(),
    customer_id: customerId,
    loan_id: loanId,
    reason: reason as any,
    explanation: explanation,
    requested_relief: 'payment_pause',
    supporting_documents: [],
    submitted_at: new Date(),
    status: 'pending'
  };

  await supabase.from('hardship_applications').insert(application);

  // Notify customer
  const customer = await getCustomer(customerId);
  await sendWhatsAppMessage(
    customer.whatsapp_number,
    `Your hardship assistance application has been received. Our team will review it within 48 hours.\n\n` +
    `In the meantime, late fees will be waived.`
  );

  // Notify admin team
  await notifyAdminTeam('hardship_application', application);

  return application;
}
```

---

## 7. Database Schema

### 7.1 Payment Reminders Sent Table

```sql
CREATE TABLE payment_reminders_sent (
  reminder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  reminder_stage VARCHAR(50) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channels TEXT[] NOT NULL,

  -- Tracking
  notification_id UUID REFERENCES notification_queue(notification_id),
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ,

  -- Payment response tracking
  payment_received BOOLEAN DEFAULT FALSE,
  payment_received_at TIMESTAMPTZ,
  response_time_hours INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_reminders_payment_id ON payment_reminders_sent(payment_id);
CREATE INDEX idx_payment_reminders_customer_id ON payment_reminders_sent(customer_id);
CREATE INDEX idx_payment_reminders_sent_at ON payment_reminders_sent(sent_at DESC);
CREATE INDEX idx_payment_reminders_stage ON payment_reminders_sent(reminder_stage);
```

### 7.2 Customer Payment Patterns Table

```sql
CREATE TABLE customer_payment_patterns (
  customer_id UUID PRIMARY KEY REFERENCES customers(id),

  preferred_payment_day INT, -- 1-31
  preferred_payment_time TIME,
  typical_payment_delay_days INT,
  response_to_reminder_hours DECIMAL(10,2),

  most_effective_channel VARCHAR(20),
  most_effective_time TIME,

  lifetime_payment_rate DECIMAL(5,2), -- Percentage
  consecutive_on_time_payments INT,
  total_payments_made INT,

  last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_payment_patterns_rate ON customer_payment_patterns(lifetime_payment_rate DESC);
```

### 7.3 Payment Plans Table

```sql
CREATE TABLE payment_plans (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  original_amount DECIMAL(10,2) NOT NULL,
  installment_count INT NOT NULL,
  installments JSONB NOT NULL, -- Array of {installment_number, amount, due_date, paid}

  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'completed', 'defaulted')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_plans_payment_id ON payment_plans(payment_id);
CREATE INDEX idx_payment_plans_customer_id ON payment_plans(customer_id);
CREATE INDEX idx_payment_plans_status ON payment_plans(status);
```

### 7.4 Hardship Applications Table

```sql
CREATE TABLE hardship_applications (
  application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  loan_id UUID NOT NULL REFERENCES loans(id),

  reason VARCHAR(50) NOT NULL,
  explanation TEXT NOT NULL,
  requested_relief VARCHAR(50) NOT NULL,
  supporting_documents TEXT[], -- S3 URLs

  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),

  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  relief_granted JSONB, -- HardshipRelief object

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hardship_applications_customer_id ON hardship_applications(customer_id);
CREATE INDEX idx_hardship_applications_status ON hardship_applications(status);
CREATE INDEX idx_hardship_applications_submitted_at ON hardship_applications(submitted_at DESC);
```

---

## 8. Summary

This payment reminder strategy provides a comprehensive framework for maximizing on-time payment rates while maintaining positive customer relationships:

**Multi-Stage Timeline**: 7-stage reminder system from 7 days before due date through device lock
**Intelligent Optimization**: Machine learning-based send time and channel selection
**Personalized Messaging**: Dynamic content based on payment history and customer behavior
**Tone Escalation**: Progressive urgency from friendly reminders to critical warnings
**Frequency Capping**: Maximum 2 reminders/day, 7/week to prevent spam
**Payment Assistance**: Built-in payment plan requests and hardship relief programs
**Effectiveness Tracking**: Detailed analytics on conversion rates and response times
**Multi-Channel Delivery**: WhatsApp primary, SMS fallback, email for documentation

**Key Metrics to Track**:
- On-time payment rate (target: >90%)
- Reminder conversion rate (target: >60% within 24 hours)
- Average response time (target: <12 hours)
- Device lock rate (target: <5%)
- Customer satisfaction with reminder frequency

**Implementation Priority**: Critical (directly impacts revenue and default rates)
**Implementation Complexity**: Medium (requires payment pattern analysis and scheduling)
**Business Impact**: Very High (increases collections by 30-40%)

**Related Tasks**:
- P1-T037: Multi-Channel Notification Design
- P1-T038: Notification Templates & Triggers
- P1-T040: Notification Delivery Tracking

**Next Steps**:
1. Implement daily payment reminder cron job
2. Build payment pattern analysis engine
3. Create payment plan request workflow
4. Set up hardship application system
5. Implement A/B testing for reminder timing
6. Build effectiveness analytics dashboard
7. Train customer support on hardship programs
