# Multi-Channel Notification Design

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.7 Notification System Design
**Task ID**: P1-T037
**Priority**: High
**Estimated Duration**: 8 hours

---

## 1. Overview

The notification system is the primary communication backbone for Lynia Finance, ensuring customers receive timely updates about their loan application, payment reminders, device lock warnings, and other critical events. Given that the platform is WhatsApp-first, the notification architecture must support multiple channels with intelligent fallback mechanisms while maintaining high delivery rates and tracking capabilities.

**Primary Channels**:
1. **WhatsApp** (Primary) - 95% of notifications
2. **SMS** (Fallback) - When WhatsApp fails or for critical alerts
3. **Email** (Optional) - For document delivery and receipts
4. **Push Notifications** (Future) - For device lock app

**Key Requirements**:
- Delivery rate >95% for critical notifications
- Support for scheduled/delayed delivery
- Template management with variable substitution
- Multi-language support (English, Shona, Ndebele)
- Delivery tracking and retry logic
- Cost optimization (prefer WhatsApp over SMS)

---

## 2. Notification Channel Architecture

### 2.1 Channel Hierarchy & Fallback Logic

```typescript
interface NotificationChannel {
  channel: 'whatsapp' | 'sms' | 'email' | 'push';
  priority: number; // 1=highest, 4=lowest
  cost_per_message_usd: number;
  avg_delivery_rate: number; // 0-1
  avg_delivery_time_seconds: number;
  enabled: boolean;
}

const CHANNEL_CONFIG: NotificationChannel[] = [
  {
    channel: 'whatsapp',
    priority: 1,
    cost_per_message_usd: 0.005, // $0.005 per message
    avg_delivery_rate: 0.98,
    avg_delivery_time_seconds: 3,
    enabled: true
  },
  {
    channel: 'sms',
    priority: 2,
    cost_per_message_usd: 0.02, // $0.02 per SMS in Zimbabwe
    avg_delivery_rate: 0.95,
    avg_delivery_time_seconds: 5,
    enabled: true
  },
  {
    channel: 'email',
    priority: 3,
    cost_per_message_usd: 0.001,
    avg_delivery_rate: 0.90,
    avg_delivery_time_seconds: 10,
    enabled: true
  },
  {
    channel: 'push',
    priority: 4,
    cost_per_message_usd: 0,
    avg_delivery_rate: 0.85,
    avg_delivery_time_seconds: 1,
    enabled: false // Phase 2
  }
];
```

### 2.2 Channel Selection Logic

```typescript
interface NotificationRequest {
  notification_id: string;
  customer_id: string;
  template_id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  channels_allowed: ('whatsapp' | 'sms' | 'email' | 'push')[];
  scheduled_at?: Date;
  expires_at?: Date;
  variables: Record<string, any>;
}

async function selectChannel(
  request: NotificationRequest,
  customer: Customer
): Promise<'whatsapp' | 'sms' | 'email' | 'push'> {
  const allowedChannels = CHANNEL_CONFIG
    .filter(c => c.enabled && request.channels_allowed.includes(c.channel))
    .sort((a, b) => a.priority - b.priority); // Sort by priority

  // Check customer preferences
  const customerPreferences = await getCustomerNotificationPreferences(customer.id);

  for (const channel of allowedChannels) {
    // Check if customer has disabled this channel
    if (!customerPreferences[channel.channel]) continue;

    // Check if customer has contact info for this channel
    if (channel.channel === 'whatsapp' && !customer.whatsapp_number) continue;
    if (channel.channel === 'sms' && !customer.phone_number) continue;
    if (channel.channel === 'email' && !customer.email) continue;

    // Check recent delivery success rate for this customer
    const recentSuccessRate = await getRecentDeliveryRate(
      customer.id,
      channel.channel,
      7 // last 7 days
    );

    // If channel has >80% recent success for this customer, use it
    if (recentSuccessRate > 0.80) {
      return channel.channel;
    }
  }

  // Default to first allowed channel if no good match
  return allowedChannels[0]?.channel || 'whatsapp';
}
```

### 2.3 Automatic Fallback Strategy

```typescript
interface ChannelAttempt {
  attempt_number: number;
  channel: string;
  attempted_at: Date;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'expired';
  error_code?: string;
  error_message?: string;
}

async function sendWithFallback(
  request: NotificationRequest
): Promise<NotificationDelivery> {
  const customer = await getCustomer(request.customer_id);
  const attempts: ChannelAttempt[] = [];

  // Attempt 1: Primary channel (usually WhatsApp)
  let channel = await selectChannel(request, customer);
  let attempt = await attemptSend(request, customer, channel, 1);
  attempts.push(attempt);

  // If critical priority and first attempt failed, try fallback
  if (
    request.priority === 'critical' &&
    (attempt.status === 'failed' || attempt.status === 'expired')
  ) {
    // Wait 30 seconds before fallback
    await sleep(30000);

    // Try SMS fallback
    if (channel !== 'sms' && customer.phone_number) {
      channel = 'sms';
      attempt = await attemptSend(request, customer, channel, 2);
      attempts.push(attempt);
    }
  }

  // If still failed and critical, escalate
  if (
    request.priority === 'critical' &&
    !attempts.some(a => a.status === 'delivered')
  ) {
    await escalateFailedNotification(request, attempts);
  }

  return {
    notification_id: request.notification_id,
    customer_id: request.customer_id,
    template_id: request.template_id,
    final_channel: channel,
    final_status: attempts[attempts.length - 1].status,
    attempts: attempts,
    delivered_at: attempts.find(a => a.status === 'delivered')?.attempted_at,
    total_attempts: attempts.length
  };
}

async function attemptSend(
  request: NotificationRequest,
  customer: Customer,
  channel: string,
  attemptNumber: number
): Promise<ChannelAttempt> {
  const attempt: ChannelAttempt = {
    attempt_number: attemptNumber,
    channel: channel,
    attempted_at: new Date(),
    status: 'pending'
  };

  try {
    // Get rendered template
    const template = await getTemplate(request.template_id);
    const rendered = await renderTemplate(template, request.variables, customer.language);

    // Send via appropriate channel
    let result;
    switch (channel) {
      case 'whatsapp':
        result = await sendWhatsAppMessage(customer.whatsapp_number, rendered);
        break;
      case 'sms':
        result = await sendSMS(customer.phone_number, rendered.text);
        break;
      case 'email':
        result = await sendEmail(customer.email, rendered);
        break;
      case 'push':
        result = await sendPushNotification(customer.device_id, rendered);
        break;
    }

    attempt.status = result.success ? 'sent' : 'failed';
    if (!result.success) {
      attempt.error_code = result.error_code;
      attempt.error_message = result.error_message;
    }
  } catch (error) {
    attempt.status = 'failed';
    attempt.error_message = error.message;
  }

  return attempt;
}
```

---

## 3. WhatsApp Channel Implementation

### 3.1 WhatsApp Cloud API Integration

```typescript
interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string; // Phone number in international format
  type: 'text' | 'template' | 'interactive' | 'document' | 'image';
  text?: { body: string };
  template?: WhatsAppTemplate;
  interactive?: WhatsAppInteractive;
}

interface WhatsAppTemplate {
  name: string; // Template name registered in Meta Business Manager
  language: { code: string }; // e.g., "en", "sn" (Shona)
  components: WhatsAppTemplateComponent[];
}

interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: { type: string; text?: string }[];
}

async function sendWhatsAppMessage(
  phoneNumber: string,
  message: RenderedMessage
): Promise<{ success: boolean; message_id?: string; error_code?: string; error_message?: string }> {
  try {
    const whatsappMessage: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: message.use_template ? 'template' : 'text'
    };

    if (message.use_template) {
      // Use pre-approved WhatsApp template
      whatsappMessage.template = {
        name: message.template_name,
        language: { code: message.language_code },
        components: message.template_variables.map(v => ({
          type: 'body',
          parameters: [{ type: 'text', text: v }]
        }))
      };
    } else {
      // Use free-form text (only in active 24-hour window)
      whatsappMessage.text = { body: message.text };
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(whatsappMessage)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error_code: result.error?.code?.toString(),
        error_message: result.error?.message
      };
    }

    return {
      success: true,
      message_id: result.messages[0]?.id
    };
  } catch (error) {
    return {
      success: false,
      error_message: error.message
    };
  }
}
```

### 3.2 WhatsApp Template Management

WhatsApp requires pre-approval for template messages sent outside 24-hour conversation windows:

```typescript
interface WhatsAppTemplateRegistration {
  template_id: string;
  template_name: string; // Unique name in Meta Business Manager
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;

  header?: {
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    content: string;
  };

  body: {
    text: string; // Can include {{1}}, {{2}} placeholders
    examples?: string[]; // Example values for placeholders
  };

  footer?: {
    text: string;
  };

  buttons?: {
    type: 'QUICK_REPLY' | 'CALL_TO_ACTION' | 'URL';
    text: string;
    url?: string;
    phone_number?: string;
  }[];

  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: Date;
  approved_at?: Date;
}

// Example: Payment reminder template
const PAYMENT_REMINDER_TEMPLATE: WhatsAppTemplateRegistration = {
  template_id: 'payment_reminder_24h',
  template_name: 'lynia_payment_reminder',
  category: 'UTILITY',
  language: 'en',

  body: {
    text: 'Hi {{1}}, your payment of ${{2}} is due tomorrow ({{3}}). Reply PAY to make payment via EcoCash/Innbucks.',
    examples: ['John', '25.00', '15 Jan 2025']
  },

  footer: {
    text: 'Lynia Finance - Device Financing Made Easy'
  },

  buttons: [
    { type: 'QUICK_REPLY', text: 'Pay Now' },
    { type: 'QUICK_REPLY', text: 'Need Help' }
  ],

  approval_status: 'APPROVED',
  submitted_at: new Date('2024-12-01'),
  approved_at: new Date('2024-12-02')
};
```

---

## 4. SMS Channel Implementation

### 4.1 SMS Provider Integration (Africa's Talking / Twilio)

```typescript
interface SMSMessage {
  to: string; // Phone number in international format (+263...)
  message: string; // Max 160 chars for single SMS, 1530 for concatenated
  from?: string; // Sender ID (e.g., "LYNIA")
}

async function sendSMS(
  phoneNumber: string,
  messageText: string
): Promise<{ success: boolean; message_id?: string; error_code?: string; error_message?: string }> {
  try {
    // Using Africa's Talking for Zimbabwe
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': process.env.AFRICASTALKING_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        username: process.env.AFRICASTALKING_USERNAME,
        to: phoneNumber,
        message: messageText,
        from: 'LYNIA' // Sender ID
      })
    });

    const result = await response.json();

    if (result.SMSMessageData?.Recipients?.[0]?.status === 'Success') {
      return {
        success: true,
        message_id: result.SMSMessageData.Recipients[0].messageId
      };
    } else {
      return {
        success: false,
        error_code: result.SMSMessageData?.Recipients?.[0]?.statusCode,
        error_message: result.SMSMessageData?.Recipients?.[0]?.status
      };
    }
  } catch (error) {
    return {
      success: false,
      error_message: error.message
    };
  }
}
```

### 4.2 SMS Length Optimization

```typescript
function optimizeSMSLength(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) return text;

  // Abbreviations for common terms to fit in 160 chars
  const abbreviations: Record<string, string> = {
    'payment': 'pmt',
    'tomorrow': 'tmrw',
    'please': 'pls',
    'application': 'app',
    'approved': 'aprvd',
    'rejected': 'rjctd',
    'device': 'dvc',
    'WhatsApp': 'WA'
  };

  let optimized = text;
  for (const [full, abbr] of Object.entries(abbreviations)) {
    optimized = optimized.replace(new RegExp(full, 'gi'), abbr);
    if (optimized.length <= maxLength) break;
  }

  // If still too long, truncate with "..."
  if (optimized.length > maxLength) {
    optimized = optimized.substring(0, maxLength - 3) + '...';
  }

  return optimized;
}

// SMS cost calculation
function calculateSMSCost(messageText: string): { parts: number; cost_usd: number } {
  const COST_PER_PART = 0.02; // $0.02 per SMS part in Zimbabwe

  let parts: number;
  if (messageText.length <= 160) {
    parts = 1;
  } else if (messageText.length <= 1530) {
    parts = Math.ceil(messageText.length / 153); // Concatenated SMS uses 153 chars per part
  } else {
    parts = 10; // Max 10 parts
  }

  return {
    parts: parts,
    cost_usd: parts * COST_PER_PART
  };
}
```

---

## 5. Email Channel Implementation

### 5.1 Email Service Integration (SendGrid / AWS SES)

```typescript
interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  text: string; // Plain text version
  html: string; // HTML version
  attachments?: {
    filename: string;
    content: Buffer | string;
    type: string;
  }[];
}

async function sendEmail(
  emailAddress: string,
  message: RenderedMessage
): Promise<{ success: boolean; message_id?: string; error_message?: string }> {
  try {
    // Using SendGrid
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg: EmailMessage = {
      to: emailAddress,
      from: 'noreply@lynia.finance',
      subject: message.subject || 'Lynia Finance Notification',
      text: message.text,
      html: message.html || `<p>${message.text.replace(/\n/g, '<br>')}</p>`
    };

    const response = await sgMail.send(msg);

    return {
      success: true,
      message_id: response[0]?.headers?.['x-message-id']
    };
  } catch (error) {
    return {
      success: false,
      error_message: error.message
    };
  }
}
```

### 5.2 Email Templates

```typescript
interface EmailTemplate {
  template_id: string;
  subject: string;
  html_body: string;
  text_body: string;
  variables: string[]; // List of {{variable}} placeholders
}

// Example: Loan approval email
const LOAN_APPROVAL_EMAIL: EmailTemplate = {
  template_id: 'loan_approval',
  subject: 'Congratulations! Your Loan Application is Approved',
  html_body: `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Loan Approved!</h1>
          </div>
          <div class="content">
            <p>Hi {{customer_name}},</p>
            <p>Great news! Your loan application for a <strong>{{device_name}}</strong> has been approved.</p>
            <h3>Loan Details:</h3>
            <ul>
              <li><strong>Loan Amount:</strong> ${{loan_amount}}</li>
              <li><strong>Deposit Required:</strong> ${{deposit_amount}}</li>
              <li><strong>Monthly Payment:</strong> ${{monthly_payment}}</li>
              <li><strong>Loan Term:</strong> {{loan_term}} months</li>
            </ul>
            <p>Next steps: Pay your deposit to receive your device.</p>
            <a href="{{payment_link}}" class="button">Pay Deposit Now</a>
          </div>
          <div class="footer">
            <p>Lynia Finance | Device Financing Made Easy</p>
            <p>Contact: +263 771 234 567 | support@lynia.finance</p>
          </div>
        </div>
      </body>
    </html>
  `,
  text_body: `
Hi {{customer_name}},

Great news! Your loan application for a {{device_name}} has been approved.

Loan Details:
- Loan Amount: ${{loan_amount}}
- Deposit Required: ${{deposit_amount}}
- Monthly Payment: ${{monthly_payment}}
- Loan Term: {{loan_term}} months

Next steps: Pay your deposit to receive your device.
Payment Link: {{payment_link}}

Lynia Finance | Device Financing Made Easy
Contact: +263 771 234 567 | support@lynia.finance
  `,
  variables: [
    'customer_name',
    'device_name',
    'loan_amount',
    'deposit_amount',
    'monthly_payment',
    'loan_term',
    'payment_link'
  ]
};
```

---

## 6. Multi-Language Support

### 6.1 Language Detection & Selection

```typescript
interface CustomerLanguagePreference {
  customer_id: string;
  primary_language: 'en' | 'sn' | 'nd'; // English, Shona, Ndebele
  detected_language?: string;
  manually_set: boolean;
  updated_at: Date;
}

async function detectLanguage(messageText: string): Promise<'en' | 'sn' | 'nd'> {
  // Simple keyword-based detection
  const shonaKeywords = ['ndiri', 'tirikuti', 'musangano', 'mari', 'rugare'];
  const ndebeleKeywords = ['ngiyacela', 'ngikhona', 'imali', 'ukuthula'];

  const lowerText = messageText.toLowerCase();

  const shonaMatches = shonaKeywords.filter(k => lowerText.includes(k)).length;
  const ndebeleMatches = ndebeleKeywords.filter(k => lowerText.includes(k)).length;

  if (shonaMatches > ndebeleMatches && shonaMatches > 0) return 'sn';
  if (ndebeleMatches > shonaMatches && ndebeleMatches > 0) return 'nd';

  return 'en'; // Default to English
}

async function getCustomerLanguage(customerId: string): Promise<'en' | 'sn' | 'nd'> {
  const { data: pref } = await supabase
    .from('customer_language_preferences')
    .select('*')
    .eq('customer_id', customerId)
    .single();

  return pref?.primary_language || 'en';
}
```

### 6.2 Translation System

```typescript
interface Translation {
  key: string;
  en: string;
  sn?: string; // Shona
  nd?: string; // Ndebele
}

const TRANSLATIONS: Translation[] = [
  {
    key: 'payment_reminder',
    en: 'Hi {{name}}, your payment of ${{amount}} is due on {{date}}.',
    sn: 'Mhoro {{name}}, kubhadhara kwenyu kwe ${{amount}} kunofanira kuitwa pa {{date}}.',
    nd: 'Sawubona {{name}}, inkokhelo yakho ye ${{amount}} ifuneka nge {{date}}.'
  },
  {
    key: 'payment_received',
    en: 'Thank you! We received your payment of ${{amount}}.',
    sn: 'Mazvita! Takagamuchira kubhadhara kwenyu kwe ${{amount}}.',
    nd: 'Siyabonga! Samukela inkokhelo yakho ye ${{amount}}.'
  },
  {
    key: 'device_lock_warning',
    en: 'URGENT: Your device will be locked in {{days}} days due to missed payment. Please pay immediately.',
    sn: 'CHAKAKOSHA: Mudziyo wenyu uchavharwa mumazuva {{days}} nekuda kwekusabhadhara. Bhadharai nekukurumidza.',
    nd: 'OKUPHUTHUMAYO: Idivaysi yakho izovalwa ezinsukwini ze {{days}} ngenxa yokungakhokheli. Uyacelwa ukuthi ukhokhele khathesi.'
  }
];

function translate(key: string, language: 'en' | 'sn' | 'nd', variables: Record<string, any>): string {
  const translation = TRANSLATIONS.find(t => t.key === key);
  if (!translation) return key;

  let text = translation[language] || translation.en;

  // Replace variables
  for (const [varName, varValue] of Object.entries(variables)) {
    text = text.replace(new RegExp(`{{${varName}}}`, 'g'), varValue);
  }

  return text;
}
```

---

## 7. Notification Scheduling & Queuing

### 7.1 Queue Management (BullMQ / SQS)

```typescript
import { Queue, Worker } from 'bullmq';

// Create notification queue
const notificationQueue = new Queue('notifications', {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

interface NotificationJob {
  notification_id: string;
  customer_id: string;
  template_id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  channels_allowed: string[];
  scheduled_at?: Date;
  expires_at?: Date;
  variables: Record<string, any>;
}

// Add notification to queue
async function scheduleNotification(job: NotificationJob): Promise<void> {
  const delay = job.scheduled_at
    ? job.scheduled_at.getTime() - Date.now()
    : 0;

  await notificationQueue.add(
    'send-notification',
    job,
    {
      delay: Math.max(0, delay),
      priority: getPriorityValue(job.priority),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000 // Start with 5 second delay
      },
      removeOnComplete: false, // Keep for tracking
      removeOnFail: false
    }
  );
}

function getPriorityValue(priority: string): number {
  const mapping: Record<string, number> = {
    'critical': 1,
    'high': 2,
    'medium': 3,
    'low': 4
  };
  return mapping[priority] || 3;
}

// Process notification queue
const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    console.log(`Processing notification ${job.data.notification_id}`);

    const result = await sendWithFallback(job.data);

    // Store delivery record
    await supabase.from('notification_deliveries').insert({
      notification_id: job.data.notification_id,
      customer_id: job.data.customer_id,
      template_id: job.data.template_id,
      channel: result.final_channel,
      status: result.final_status,
      delivered_at: result.delivered_at,
      attempts: result.total_attempts
    });

    return result;
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379')
    },
    concurrency: 10 // Process 10 notifications concurrently
  }
);
```

### 7.2 Rate Limiting

```typescript
interface RateLimitConfig {
  channel: string;
  max_per_minute: number;
  max_per_hour: number;
  max_per_day: number;
}

const RATE_LIMITS: RateLimitConfig[] = [
  {
    channel: 'whatsapp',
    max_per_minute: 20,
    max_per_hour: 1000,
    max_per_day: 10000
  },
  {
    channel: 'sms',
    max_per_minute: 10,
    max_per_hour: 500,
    max_per_day: 5000
  },
  {
    channel: 'email',
    max_per_minute: 50,
    max_per_hour: 2000,
    max_per_day: 20000
  }
];

async function checkRateLimit(channel: string): Promise<boolean> {
  const config = RATE_LIMITS.find(r => r.channel === channel);
  if (!config) return true;

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: recent } = await supabase
    .from('notification_deliveries')
    .select('created_at')
    .eq('channel', channel)
    .gte('created_at', oneDayAgo.toISOString());

  const lastMinute = recent?.filter(r => new Date(r.created_at) > oneMinuteAgo).length || 0;
  const lastHour = recent?.filter(r => new Date(r.created_at) > oneHourAgo).length || 0;
  const lastDay = recent?.length || 0;

  if (lastMinute >= config.max_per_minute) return false;
  if (lastHour >= config.max_per_hour) return false;
  if (lastDay >= config.max_per_day) return false;

  return true;
}
```

---

## 8. Database Schema

### 8.1 Notification Templates Table

```sql
CREATE TABLE notification_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL UNIQUE,
  template_category VARCHAR(50) NOT NULL CHECK (template_category IN (
    'onboarding', 'loan_application', 'payments', 'device_management', 'alerts'
  )),

  -- Multi-language content
  content_en TEXT NOT NULL,
  content_sn TEXT, -- Shona
  content_nd TEXT, -- Ndebele

  subject_en VARCHAR(200),
  subject_sn VARCHAR(200),
  subject_nd VARCHAR(200),

  -- Channel-specific settings
  whatsapp_template_name VARCHAR(100), -- Name in Meta Business Manager
  whatsapp_approved BOOLEAN DEFAULT FALSE,
  use_sms BOOLEAN DEFAULT TRUE,
  use_email BOOLEAN DEFAULT TRUE,

  -- Variables in template (JSON array)
  variables JSONB NOT NULL DEFAULT '[]',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_notification_templates_name ON notification_templates(template_name);
CREATE INDEX idx_notification_templates_category ON notification_templates(template_category);
```

### 8.2 Notification Queue Table

```sql
CREATE TABLE notification_queue (
  queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  template_id UUID NOT NULL REFERENCES notification_templates(template_id),

  priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'expired')),

  channels_allowed TEXT[] NOT NULL DEFAULT '{whatsapp, sms, email}',
  selected_channel VARCHAR(20),

  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Template variables (JSON object)
  variables JSONB NOT NULL DEFAULT '{}',

  -- Processing
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_queue_customer_id ON notification_queue(customer_id);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority);
```

### 8.3 Notification Deliveries Table

```sql
CREATE TABLE notification_deliveries (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notification_queue(notification_id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  template_id UUID NOT NULL REFERENCES notification_templates(template_id),

  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'push')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'expired')),

  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  provider_message_id VARCHAR(200), -- External provider's ID
  error_code VARCHAR(50),
  error_message TEXT,

  -- Cost tracking
  cost_usd DECIMAL(10,4),

  -- Content snapshot
  content_sent TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX idx_notification_deliveries_customer_id ON notification_deliveries(customer_id);
CREATE INDEX idx_notification_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX idx_notification_deliveries_sent_at ON notification_deliveries(sent_at DESC);
```

### 8.4 Customer Notification Preferences Table

```sql
CREATE TABLE customer_notification_preferences (
  customer_id UUID PRIMARY KEY REFERENCES customers(id),

  -- Channel opt-in/opt-out
  whatsapp_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT FALSE,

  -- Category preferences
  marketing_notifications BOOLEAN DEFAULT TRUE,
  payment_reminders BOOLEAN DEFAULT TRUE,
  loan_updates BOOLEAN DEFAULT TRUE,
  device_alerts BOOLEAN DEFAULT TRUE,

  -- Language preference
  preferred_language VARCHAR(5) DEFAULT 'en',

  -- Quiet hours (no notifications during this time)
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME, -- e.g., '22:00:00'
  quiet_hours_end TIME,   -- e.g., '08:00:00'

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9. Notification Cost Tracking

```typescript
interface NotificationCostReport {
  period_start: Date;
  period_end: Date;

  total_notifications: number;
  total_cost_usd: number;

  by_channel: {
    channel: string;
    count: number;
    cost_usd: number;
    avg_cost_per_message: number;
  }[];

  by_category: {
    category: string;
    count: number;
    cost_usd: number;
  }[];

  cost_per_customer_usd: number;
}

async function generateCostReport(
  startDate: Date,
  endDate: Date
): Promise<NotificationCostReport> {
  const { data: deliveries } = await supabase
    .from('notification_deliveries')
    .select('*, notification_queue(*), notification_templates(*)')
    .gte('sent_at', startDate.toISOString())
    .lte('sent_at', endDate.toISOString());

  const totalCost = deliveries?.reduce((sum, d) => sum + (d.cost_usd || 0), 0) || 0;
  const totalCount = deliveries?.length || 0;

  // Group by channel
  const channelStats = ['whatsapp', 'sms', 'email'].map(channel => {
    const channelDeliveries = deliveries?.filter(d => d.channel === channel) || [];
    const channelCost = channelDeliveries.reduce((sum, d) => sum + (d.cost_usd || 0), 0);
    return {
      channel,
      count: channelDeliveries.length,
      cost_usd: channelCost,
      avg_cost_per_message: channelDeliveries.length > 0 ? channelCost / channelDeliveries.length : 0
    };
  });

  // Group by category
  const categoryStats = ['onboarding', 'loan_application', 'payments', 'device_management', 'alerts'].map(category => {
    const categoryDeliveries = deliveries?.filter(
      d => d.notification_templates?.template_category === category
    ) || [];
    const categoryCost = categoryDeliveries.reduce((sum, d) => sum + (d.cost_usd || 0), 0);
    return {
      category,
      count: categoryDeliveries.length,
      cost_usd: categoryCost
    };
  });

  // Unique customers
  const uniqueCustomers = new Set(deliveries?.map(d => d.customer_id)).size;

  return {
    period_start: startDate,
    period_end: endDate,
    total_notifications: totalCount,
    total_cost_usd: totalCost,
    by_channel: channelStats,
    by_category: categoryStats,
    cost_per_customer_usd: uniqueCustomers > 0 ? totalCost / uniqueCustomers : 0
  };
}
```

---

## 10. Summary

This multi-channel notification design provides a robust, cost-effective communication system for Lynia Finance with the following key features:

**Channel Strategy**: WhatsApp-first with automatic SMS fallback for critical notifications
**Cost Optimization**: Prefer WhatsApp ($0.005/msg) over SMS ($0.02/msg) to reduce costs by 75%
**High Delivery Rates**: Multi-channel fallback ensures >95% delivery for critical notifications
**Multi-Language**: Support for English, Shona, and Ndebele with automatic detection
**Scalability**: Queue-based architecture with BullMQ handles 10,000+ daily notifications
**Template Management**: Pre-approved WhatsApp templates with variable substitution
**Rate Limiting**: Channel-specific limits to comply with provider restrictions
**Cost Tracking**: Detailed cost reports by channel and category

**Implementation Priority**: High (required for all customer communications)
**Implementation Complexity**: Medium (requires WhatsApp, SMS, and email integrations)
**Business Impact**: Critical (primary customer communication channel)

**Related Tasks**:
- P1-T038: Notification Templates & Triggers
- P1-T039: Payment Reminder Strategy
- P1-T040: Notification Delivery Tracking

**Next Steps**:
1. Set up WhatsApp Business API account and phone number
2. Register initial WhatsApp message templates with Meta
3. Integrate Africa's Talking for SMS delivery
4. Set up BullMQ notification queue with Redis
5. Implement fallback logic for critical notifications
6. Create multi-language translation system
7. Build cost tracking and reporting dashboard
