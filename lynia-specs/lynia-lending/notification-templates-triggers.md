# Notification Templates & Triggers

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.7 Notification System Design
**Task ID**: P1-T038
**Priority**: High
**Estimated Duration**: 6 hours

---

## 1. Overview

Notification templates define standardized message formats for all customer communications, while triggers automate when notifications are sent based on system events. This specification provides a comprehensive library of notification templates covering the entire customer journey from onboarding through loan completion, along with event-driven trigger mechanisms.

**Key Features**:
- 30+ pre-defined templates covering all customer touchpoints
- Event-driven triggers with configurable conditions
- Multi-language support (English, Shona, Ndebele)
- Variable substitution for personalization
- Channel-specific formatting (WhatsApp, SMS, Email)
- A/B testing capability for message optimization

---

## 2. Template Structure & Format

### 2.1 Template Schema

```typescript
interface NotificationTemplate {
  template_id: string;
  template_name: string;
  template_category: 'onboarding' | 'loan_application' | 'payments' | 'device_management' | 'alerts' | 'marketing';

  // Priority level (determines fallback strategy)
  priority: 'critical' | 'high' | 'medium' | 'low';

  // Content in multiple languages
  content: {
    en: TemplateContent;
    sn?: TemplateContent; // Shona
    nd?: TemplateContent; // Ndebele
  };

  // Channel-specific settings
  channels: {
    whatsapp: {
      enabled: boolean;
      template_name?: string; // Meta Business Manager template name
      approved: boolean;
      use_interactive?: boolean; // Use buttons/lists
    };
    sms: {
      enabled: boolean;
      max_length?: number; // Character limit
    };
    email: {
      enabled: boolean;
      html_template?: string;
    };
  };

  // Variables that must be provided
  required_variables: string[];

  // Metadata
  created_at: Date;
  updated_at: Date;
  is_active: boolean;

  // A/B testing
  variant_of?: string; // If this is a variant of another template
  test_percentage?: number; // % of users to receive this variant
}

interface TemplateContent {
  subject?: string; // For email
  body: string; // Main message text
  buttons?: TemplateButton[]; // Interactive buttons
  footer?: string; // Footer text
}

interface TemplateButton {
  type: 'quick_reply' | 'url' | 'call';
  text: string;
  value?: string; // For quick_reply
  url?: string; // For URL buttons
  phone_number?: string; // For call buttons
}
```

### 2.2 Variable Substitution

```typescript
function renderTemplate(
  template: NotificationTemplate,
  variables: Record<string, any>,
  language: 'en' | 'sn' | 'nd' = 'en'
): string {
  const content = template.content[language] || template.content.en;
  let rendered = content.body;

  // Replace {{variable}} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(placeholder, value?.toString() || '');
  }

  // Check if all required variables were provided
  const missingVars = template.required_variables.filter(
    varName => !(varName in variables)
  );

  if (missingVars.length > 0) {
    console.warn(`Missing required variables for template ${template.template_name}: ${missingVars.join(', ')}`);
  }

  return rendered;
}

// Example usage
const welcomeTemplate: NotificationTemplate = {
  template_id: 'welcome_message',
  template_name: 'Welcome Message',
  template_category: 'onboarding',
  priority: 'high',
  content: {
    en: {
      body: 'Welcome to Lynia Finance, {{customer_name}}! Get your dream device with easy monthly payments. Reply BROWSE to see our catalog.',
      buttons: [
        { type: 'quick_reply', text: 'Browse Devices', value: 'BROWSE' },
        { type: 'quick_reply', text: 'How It Works', value: 'HOW' }
      ]
    },
    sn: {
      body: 'Mazvita kuuya kuLynia Finance, {{customer_name}}! Wana mudziyo wako nekubhadhara zvishoma zvishoma. Pindura BROWSE kuti uone zvigadzirwa zvedu.',
      buttons: [
        { type: 'quick_reply', text: 'Ona Zvigadzirwa', value: 'BROWSE' },
        { type: 'quick_reply', text: 'Zvinoshanda Sei', value: 'HOW' }
      ]
    }
  },
  channels: {
    whatsapp: { enabled: true, approved: true, use_interactive: true },
    sms: { enabled: true, max_length: 160 },
    email: { enabled: false }
  },
  required_variables: ['customer_name'],
  created_at: new Date(),
  updated_at: new Date(),
  is_active: true
};

const rendered = renderTemplate(welcomeTemplate, { customer_name: 'John Moyo' }, 'en');
// Output: "Welcome to Lynia Finance, John Moyo! Get your dream device with easy monthly payments. Reply BROWSE to see our catalog."
```

---

## 3. Template Library

### 3.1 Onboarding Templates (T001-T005)

#### T001: Welcome Message
```typescript
{
  template_id: 'T001',
  template_name: 'Welcome Message',
  template_category: 'onboarding',
  priority: 'high',
  content: {
    en: {
      body: 'Welcome to Lynia Finance, {{customer_name}}! 📱 Get your dream device with easy monthly payments starting from $25. Reply BROWSE to see devices.',
      buttons: [
        { type: 'quick_reply', text: 'Browse Devices', value: 'BROWSE' },
        { type: 'quick_reply', text: 'How It Works', value: 'HOW' }
      ]
    }
  },
  required_variables: ['customer_name']
}
```

#### T002: KYC Document Request
```typescript
{
  template_id: 'T002',
  template_name: 'KYC Document Request',
  template_category: 'onboarding',
  priority: 'high',
  content: {
    en: {
      body: 'Hi {{customer_name}}, to continue your application, please upload:\n\n1️⃣ Zimbabwe National ID (both sides)\n2️⃣ Live selfie photo\n\nSend your ID now to proceed.',
      buttons: [
        { type: 'quick_reply', text: 'Upload ID', value: 'UPLOAD_ID' },
        { type: 'quick_reply', text: 'Need Help', value: 'HELP' }
      ]
    },
    sn: {
      body: 'Mhoro {{customer_name}}, kuti upfuurire, tsvigira:\n\n1️⃣ ID yenyu yeZimbabwe (mativi maviri)\n2️⃣ Selfie yenyu\n\nTumira ID yenyu izvozvi.'
    }
  },
  required_variables: ['customer_name']
}
```

#### T003: KYC Verification Success
```typescript
{
  template_id: 'T003',
  template_name: 'KYC Verification Success',
  template_category: 'onboarding',
  priority: 'high',
  content: {
    en: {
      body: '✅ Great news {{customer_name}}! Your identity has been verified. You can now apply for device financing up to ${{credit_limit}}.\n\nReply BROWSE to see available devices.',
      buttons: [
        { type: 'quick_reply', text: 'Browse Devices', value: 'BROWSE' },
        { type: 'quick_reply', text: 'Check Eligibility', value: 'ELIGIBILITY' }
      ]
    }
  },
  required_variables: ['customer_name', 'credit_limit']
}
```

#### T004: KYC Verification Failed
```typescript
{
  template_id: 'T004',
  template_name: 'KYC Verification Failed',
  template_category: 'onboarding',
  priority: 'high',
  content: {
    en: {
      body: 'Sorry {{customer_name}}, we couldn\'t verify your documents. Reason: {{reason}}\n\nPlease re-upload:\n- Clear photo of National ID\n- Recent selfie with good lighting\n\nYou have {{attempts_remaining}} attempts remaining.',
      buttons: [
        { type: 'quick_reply', text: 'Re-upload', value: 'REUPLOAD' },
        { type: 'quick_reply', text: 'Contact Support', value: 'SUPPORT' }
      ]
    }
  },
  required_variables: ['customer_name', 'reason', 'attempts_remaining']
}
```

#### T005: Credit Score Result
```typescript
{
  template_id: 'T005',
  template_name: 'Credit Score Result',
  template_category: 'onboarding',
  priority: 'medium',
  content: {
    en: {
      body: '🎯 Your credit assessment is complete!\n\n💰 Credit Limit: ${{credit_limit}}\n📊 Credit Tier: {{tier}}\n📱 Available Devices: {{device_count}}+\n\nYou\'re pre-approved for flexible payment plans!',
      buttons: [
        { type: 'quick_reply', text: 'Browse Devices', value: 'BROWSE' },
        { type: 'quick_reply', text: 'Learn More', value: 'LEARN' }
      ]
    }
  },
  required_variables: ['credit_limit', 'tier', 'device_count']
}
```

### 3.2 Loan Application Templates (T006-T012)

#### T006: Device Selection Confirmation
```typescript
{
  template_id: 'T006',
  template_name: 'Device Selection Confirmation',
  template_category: 'loan_application',
  priority: 'high',
  content: {
    en: {
      body: 'Great choice! 📱\n\nDevice: {{device_name}}\nPrice: ${{device_price}}\n\nYour payment plan:\n💵 Deposit (20%): ${{deposit}}\n📅 Monthly: ${{monthly_payment}} x {{term}} months\n\nProceed with application?',
      buttons: [
        { type: 'quick_reply', text: 'Yes, Apply', value: 'APPLY' },
        { type: 'quick_reply', text: 'Choose Different Device', value: 'BROWSE' }
      ]
    }
  },
  required_variables: ['device_name', 'device_price', 'deposit', 'monthly_payment', 'term']
}
```

#### T007: Loan Application Submitted
```typescript
{
  template_id: 'T007',
  template_name: 'Loan Application Submitted',
  template_category: 'loan_application',
  priority: 'medium',
  content: {
    en: {
      body: '✅ Application submitted!\n\nLoan ID: {{loan_id}}\nDevice: {{device_name}}\nAmount: ${{loan_amount}}\n\nWe\'re reviewing your application. You\'ll hear from us within 2 hours.',
      footer: 'Lynia Finance - Device Financing Made Easy'
    }
  },
  required_variables: ['loan_id', 'device_name', 'loan_amount']
}
```

#### T008: Loan Approved
```typescript
{
  template_id: 'T008',
  template_name: 'Loan Approved',
  template_category: 'loan_application',
  priority: 'critical',
  content: {
    en: {
      body: '🎉 Congratulations {{customer_name}}!\n\nYour loan is APPROVED!\n\n📱 Device: {{device_name}}\n💰 Loan Amount: ${{loan_amount}}\n📅 Term: {{term}} months\n💵 Deposit: ${{deposit}}\n💳 Monthly: ${{monthly_payment}}\n\nNext: Pay deposit to get your device.',
      buttons: [
        { type: 'quick_reply', text: 'Pay Deposit', value: 'PAY_DEPOSIT' },
        { type: 'quick_reply', text: 'View Details', value: 'LOAN_DETAILS' }
      ]
    },
    sn: {
      body: '🎉 Makorokoto {{customer_name}}!\n\nChikwereti chenyu CHAVIMBISWA!\n\n📱 Mudziyo: {{device_name}}\n💰 Mari: ${{loan_amount}}\n📅 Nguva: mwedzi {{term}}\n💵 Deposit: ${{deposit}}\n💳 Pamwedzi: ${{monthly_payment}}\n\nChinhu chinotevera: Bhadhara deposit kuti uwane mudziyo.'
    }
  },
  required_variables: ['customer_name', 'device_name', 'loan_amount', 'term', 'deposit', 'monthly_payment']
}
```

#### T009: Loan Rejected
```typescript
{
  template_id: 'T009',
  template_name: 'Loan Rejected',
  template_category: 'loan_application',
  priority: 'high',
  content: {
    en: {
      body: 'Sorry {{customer_name}}, we couldn\'t approve your application at this time.\n\nReason: {{reason}}\n\nWhat you can do:\n✅ Try a lower-priced device\n✅ Increase your deposit amount\n✅ Reapply in 30 days\n\nNeed help? Reply SUPPORT',
      buttons: [
        { type: 'quick_reply', text: 'Browse Lower-Priced Devices', value: 'BROWSE_BUDGET' },
        { type: 'quick_reply', text: 'Contact Support', value: 'SUPPORT' }
      ]
    }
  },
  required_variables: ['customer_name', 'reason']
}
```

#### T010: Manual Review Required
```typescript
{
  template_id: 'T010',
  template_name: 'Manual Review Required',
  template_category: 'loan_application',
  priority: 'medium',
  content: {
    en: {
      body: 'Hi {{customer_name}}, your application requires additional review.\n\nOur team is checking your application. We\'ll update you within 24 hours.\n\nLoan ID: {{loan_id}}\nStatus: Under Review'
    }
  },
  required_variables: ['customer_name', 'loan_id']
}
```

#### T011: Deposit Payment Request
```typescript
{
  template_id: 'T011',
  template_name: 'Deposit Payment Request',
  template_category: 'loan_application',
  priority: 'high',
  content: {
    en: {
      body: '💳 Ready to pay your deposit?\n\nAmount: ${{deposit_amount}}\nDevice: {{device_name}}\n\nPayment options:\n1️⃣ EcoCash: Send ${{deposit_amount}} to {{ecocash_number}}\n2️⃣ Innbucks\n3️⃣ Bank Transfer\n\nOnce paid, your device will be ready in 24 hours!',
      buttons: [
        { type: 'quick_reply', text: 'I Paid via EcoCash', value: 'PAID_ECOCASH' },
        { type: 'quick_reply', text: 'Other Payment Method', value: 'PAID_OTHER' }
      ]
    }
  },
  required_variables: ['deposit_amount', 'device_name', 'ecocash_number']
}
```

#### T012: Deposit Payment Confirmed
```typescript
{
  template_id: 'T012',
  template_name: 'Deposit Payment Confirmed',
  template_category: 'loan_application',
  priority: 'critical',
  content: {
    en: {
      body: '✅ Payment received!\n\n💰 Amount: ${{amount}}\n📱 Device: {{device_name}}\n📍 Collection: {{collection_method}}\n\n{{#if is_delivery}}\nDelivery scheduled for {{delivery_date}}\nAddress: {{delivery_address}}\n{{else}}\nCollection point: {{collection_address}}\nAvailable: {{collection_date}}\n{{/if}}\n\nWe\'ll notify you when ready!',
      buttons: [
        { type: 'quick_reply', text: 'Track Order', value: 'TRACK' },
        { type: 'quick_reply', text: 'Contact Us', value: 'CONTACT' }
      ]
    }
  },
  required_variables: ['amount', 'device_name', 'collection_method']
}
```

### 3.3 Payment Templates (T013-T020)

#### T013: Payment Due Reminder (7 days before)
```typescript
{
  template_id: 'T013',
  template_name: 'Payment Due Reminder - 7 Days',
  template_category: 'payments',
  priority: 'medium',
  content: {
    en: {
      body: '📅 Reminder: Payment due in 7 days\n\nAmount: ${{amount}}\nDue Date: {{due_date}}\nLoan: {{device_name}}\n\nPay early and avoid late fees!',
      buttons: [
        { type: 'quick_reply', text: 'Pay Now', value: 'PAY' },
        { type: 'quick_reply', text: 'View Balance', value: 'BALANCE' }
      ]
    },
    sn: {
      body: '📅 Chiyeudziro: Kubhadhara kunotanga mumazuva 7\n\nMari: ${{amount}}\nZuva: {{due_date}}\nChikwereti: {{device_name}}\n\nBhadhara manje udzivise mari yekusateerera!'
    }
  },
  required_variables: ['amount', 'due_date', 'device_name']
}
```

#### T014: Payment Due Reminder (24 hours before)
```typescript
{
  template_id: 'T014',
  template_name: 'Payment Due Reminder - 24 Hours',
  template_category: 'payments',
  priority: 'high',
  content: {
    en: {
      body: '⚠️ URGENT: Payment due TOMORROW\n\nAmount: ${{amount}}\nDue: {{due_date}} (tomorrow)\nDevice: {{device_name}}\n\n⚡ Pay now to avoid ${{late_fee}} late fee!\n\nEcoCash: {{ecocash_number}}\nRef: {{payment_reference}}',
      buttons: [
        { type: 'quick_reply', text: 'I Paid', value: 'PAID' },
        { type: 'quick_reply', text: 'Request Extension', value: 'EXTENSION' }
      ]
    }
  },
  required_variables: ['amount', 'due_date', 'device_name', 'late_fee', 'ecocash_number', 'payment_reference']
}
```

#### T015: Payment Overdue
```typescript
{
  template_id: 'T015',
  template_name: 'Payment Overdue',
  template_category: 'payments',
  priority: 'critical',
  content: {
    en: {
      body: '🚨 OVERDUE PAYMENT\n\n{{customer_name}}, your payment is now {{days_overdue}} days late.\n\nOriginal Amount: ${{amount}}\nLate Fee: ${{late_fee}}\nTotal Due: ${{total_due}}\n\n⚠️ Your device may be locked if payment is not received within 3 days.\n\nPay immediately to avoid service interruption.',
      buttons: [
        { type: 'quick_reply', text: 'Pay Now', value: 'PAY_NOW' },
        { type: 'quick_reply', text: 'Payment Assistance', value: 'ASSISTANCE' }
      ]
    }
  },
  required_variables: ['customer_name', 'days_overdue', 'amount', 'late_fee', 'total_due']
}
```

#### T016: Payment Received
```typescript
{
  template_id: 'T016',
  template_name: 'Payment Received',
  template_category: 'payments',
  priority: 'high',
  content: {
    en: {
      body: '✅ Payment received - Thank you!\n\n💰 Amount: ${{amount}}\n📅 Date: {{payment_date}}\n📱 Device: {{device_name}}\n\n💳 Outstanding Balance: ${{balance}}\n📊 Payments Remaining: {{payments_remaining}}\n📅 Next Due: {{next_due_date}}',
      buttons: [
        { type: 'quick_reply', text: 'View Statement', value: 'STATEMENT' },
        { type: 'quick_reply', text: 'Pay Extra', value: 'PAY_EXTRA' }
      ]
    },
    sn: {
      body: '✅ Takagamuchira mari - Mazvita!\n\n💰 Mari: ${{amount}}\n📅 Zuva: {{payment_date}}\n📱 Mudziyo: {{device_name}}\n\n💳 Yakasara: ${{balance}}\n📊 Mibhadharo yakasara: {{payments_remaining}}'
    }
  },
  required_variables: ['amount', 'payment_date', 'device_name', 'balance', 'payments_remaining', 'next_due_date']
}
```

#### T017: Payment Failed
```typescript
{
  template_id: 'T017',
  template_name: 'Payment Failed',
  template_category: 'payments',
  priority: 'high',
  content: {
    en: {
      body: '❌ Payment Failed\n\nAmount: ${{amount}}\nReason: {{failure_reason}}\n\nPlease try again or use a different payment method.\n\nDue Date: {{due_date}}',
      buttons: [
        { type: 'quick_reply', text: 'Retry Payment', value: 'RETRY' },
        { type: 'quick_reply', text: 'Different Method', value: 'CHANGE_METHOD' }
      ]
    }
  },
  required_variables: ['amount', 'failure_reason', 'due_date']
}
```

#### T018: Early Payoff Offer
```typescript
{
  template_id: 'T018',
  template_name: 'Early Payoff Offer',
  template_category: 'payments',
  priority: 'low',
  content: {
    en: {
      body: '💡 Special Offer: Pay off your loan early!\n\nCurrent Balance: ${{balance}}\nPayoff Amount: ${{payoff_amount}} ({{discount}}% discount)\nSavings: ${{savings}}\n\nOffer valid until {{expiry_date}}',
      buttons: [
        { type: 'quick_reply', text: 'Pay Off Loan', value: 'PAYOFF' },
        { type: 'quick_reply', text: 'Calculate Savings', value: 'CALCULATE' }
      ]
    }
  },
  required_variables: ['balance', 'payoff_amount', 'discount', 'savings', 'expiry_date']
}
```

#### T019: Payment Plan Adjustment
```typescript
{
  template_id: 'T019',
  template_name: 'Payment Plan Adjustment',
  template_category: 'payments',
  priority: 'medium',
  content: {
    en: {
      body: '📋 Your payment plan has been adjusted\n\nOld Monthly Payment: ${{old_amount}}\nNew Monthly Payment: ${{new_amount}}\nNew Term: {{new_term}} months\n\nReason: {{reason}}\n\nNext payment due: {{next_due_date}}',
      buttons: [
        { type: 'quick_reply', text: 'View New Schedule', value: 'SCHEDULE' },
        { type: 'quick_reply', text: 'Questions?', value: 'SUPPORT' }
      ]
    }
  },
  required_variables: ['old_amount', 'new_amount', 'new_term', 'reason', 'next_due_date']
}
```

#### T020: Loan Completion
```typescript
{
  template_id: 'T020',
  template_name: 'Loan Completion',
  template_category: 'payments',
  priority: 'high',
  content: {
    en: {
      body: '🎉 Congratulations {{customer_name}}!\n\nYou\'ve successfully paid off your loan!\n\n📱 Device: {{device_name}}\n💰 Total Paid: ${{total_paid}}\n📅 Loan Duration: {{duration_months}} months\n\n✨ Your credit score has improved!\n💳 New Credit Limit: ${{new_credit_limit}}\n\nReady to finance another device?',
      buttons: [
        { type: 'quick_reply', text: 'Browse New Devices', value: 'BROWSE' },
        { type: 'quick_reply', text: 'Download Certificate', value: 'CERTIFICATE' }
      ]
    }
  },
  required_variables: ['customer_name', 'device_name', 'total_paid', 'duration_months', 'new_credit_limit']
}
```

### 3.4 Device Management Templates (T021-T026)

#### T021: Device Lock Warning (7 days)
```typescript
{
  template_id: 'T021',
  template_name: 'Device Lock Warning - 7 Days',
  template_category: 'device_management',
  priority: 'critical',
  content: {
    en: {
      body: '⚠️ DEVICE LOCK WARNING\n\n{{customer_name}}, due to missed payments, your device will be locked in 7 DAYS if payment is not received.\n\nAmount Due: ${{amount_due}}\nDays Overdue: {{days_overdue}}\nLock Date: {{lock_date}}\n\nPay now to prevent device lock.',
      buttons: [
        { type: 'quick_reply', text: 'Pay Immediately', value: 'PAY_NOW' },
        { type: 'call', text: 'Call Us', phone_number: '+263771234567' }
      ]
    },
    sn: {
      body: '⚠️ CHIYAMBIRO: MUDZIYO UCHAVHARWA\n\n{{customer_name}}, nekuda kwekusabhadhara, mudziyo wenyu uchavharwa mumazuva 7 kana musina kubhadhara.\n\nMari: ${{amount_due}}\nZuva rekuvhara: {{lock_date}}\n\nBhadharai manje!'
    }
  },
  required_variables: ['customer_name', 'amount_due', 'days_overdue', 'lock_date']
}
```

#### T022: Device Lock Warning (3 days - Final)
```typescript
{
  template_id: 'T022',
  template_name: 'Device Lock Warning - 3 Days FINAL',
  template_category: 'device_management',
  priority: 'critical',
  content: {
    en: {
      body: '🚨 FINAL WARNING - 3 DAYS\n\n{{customer_name}}, your device WILL BE LOCKED in 3 days.\n\nAmount Due: ${{amount_due}}\nLock Date: {{lock_date}} at {{lock_time}}\n\nOnce locked:\n❌ No calls (except emergency)\n❌ No apps\n❌ No internet\n\n⚡ PAY NOW TO AVOID LOCK\n\nEcoCash: {{ecocash_number}}\nRef: {{payment_ref}}',
      buttons: [
        { type: 'quick_reply', text: 'I Will Pay', value: 'PAY' },
        { type: 'call', text: 'Emergency Call', phone_number: '+263771234567' }
      ]
    }
  },
  required_variables: ['customer_name', 'amount_due', 'lock_date', 'lock_time', 'ecocash_number', 'payment_ref']
}
```

#### T023: Device Locked
```typescript
{
  template_id: 'T023',
  template_name: 'Device Locked',
  template_category: 'device_management',
  priority: 'critical',
  content: {
    en: {
      body: '🔒 DEVICE LOCKED\n\n{{customer_name}}, your device has been locked due to non-payment.\n\nAmount to Unlock: ${{unlock_amount}}\nPayment Overdue: {{days_overdue}} days\n\nTo unlock:\n1️⃣ Pay full overdue amount\n2️⃣ Contact us with payment proof\n3️⃣ Device unlocks within 1 hour\n\nEmergency calls still work.',
      buttons: [
        { type: 'quick_reply', text: 'Pay to Unlock', value: 'PAY_UNLOCK' },
        { type: 'call', text: 'Call Support', phone_number: '+263771234567' }
      ]
    }
  },
  required_variables: ['customer_name', 'unlock_amount', 'days_overdue']
}
```

#### T024: Device Unlocked
```typescript
{
  template_id: 'T024',
  template_name: 'Device Unlocked',
  template_category: 'device_management',
  priority: 'high',
  content: {
    en: {
      body: '✅ DEVICE UNLOCKED\n\nThank you for your payment, {{customer_name}}!\n\nYour device is now fully functional.\n\nCurrent Status:\n💳 Balance: ${{balance}}\n📅 Next Payment: {{next_due_date}}\n\nStay on track to avoid future locks.',
      buttons: [
        { type: 'quick_reply', text: 'View Balance', value: 'BALANCE' },
        { type: 'quick_reply', text: 'Set Payment Reminder', value: 'REMINDER' }
      ]
    }
  },
  required_variables: ['customer_name', 'balance', 'next_due_date']
}
```

#### T025: Device Handover Scheduled
```typescript
{
  template_id: 'T025',
  template_name: 'Device Handover Scheduled',
  template_category: 'device_management',
  priority: 'high',
  content: {
    en: {
      body: '📦 Your device is ready!\n\n📱 Device: {{device_name}}\n📍 {{#if is_delivery}}Delivery Address: {{address}}{{else}}Collection: {{address}}{{/if}}\n📅 Date: {{date}}\n⏰ Time: {{time}}\n\nWhat to bring:\n✅ National ID\n✅ This message\n\n{{#if is_delivery}}Our agent will call 30 minutes before arrival.{{/if}}',
      buttons: [
        { type: 'quick_reply', text: 'Confirm', value: 'CONFIRM' },
        { type: 'quick_reply', text: 'Reschedule', value: 'RESCHEDULE' }
      ]
    }
  },
  required_variables: ['device_name', 'date', 'time']
}
```

#### T026: Device Handover Complete
```typescript
{
  template_id: 'T026',
  template_name: 'Device Handover Complete',
  template_category: 'device_management',
  priority: 'high',
  content: {
    en: {
      body: '🎉 Enjoy your new device!\n\n📱 Device: {{device_name}}\n📋 IMEI: {{imei}}\n💳 First Payment Due: {{first_payment_date}}\n\nImportant:\n🔔 Install Lynia app for payment reminders\n📱 Keep device charged and connected\n📞 Contact us anytime: +263 771 234 567\n\nThank you for choosing Lynia Finance!',
      buttons: [
        { type: 'url', text: 'Download Lynia App', url: '{{app_download_url}}' },
        { type: 'quick_reply', text: 'View Loan Details', value: 'LOAN_DETAILS' }
      ]
    }
  },
  required_variables: ['device_name', 'imei', 'first_payment_date', 'app_download_url']
}
```

### 3.5 Alert Templates (T027-T030)

#### T027: Security Alert - Unusual Activity
```typescript
{
  template_id: 'T027',
  template_name: 'Security Alert',
  template_category: 'alerts',
  priority: 'critical',
  content: {
    en: {
      body: '🔒 Security Alert\n\nWe detected unusual activity on your account:\n\n{{activity_description}}\n📅 Time: {{timestamp}}\n📍 Location: {{location}}\n\nWas this you?',
      buttons: [
        { type: 'quick_reply', text: 'Yes, That Was Me', value: 'CONFIRM' },
        { type: 'quick_reply', text: 'No, Secure My Account', value: 'SECURE' }
      ]
    }
  },
  required_variables: ['activity_description', 'timestamp', 'location']
}
```

#### T028: System Maintenance Notice
```typescript
{
  template_id: 'T028',
  template_name: 'System Maintenance Notice',
  template_category: 'alerts',
  priority: 'low',
  content: {
    en: {
      body: '🔧 Scheduled Maintenance\n\nOur system will be unavailable:\n\n📅 Date: {{date}}\n⏰ Time: {{start_time}} - {{end_time}}\n⏱️ Duration: {{duration}}\n\nPayment services will be temporarily offline. Plan accordingly.\n\nSorry for any inconvenience!'
    }
  },
  required_variables: ['date', 'start_time', 'end_time', 'duration']
}
```

#### T029: Promotional Offer
```typescript
{
  template_id: 'T029',
  template_name: 'Promotional Offer',
  template_category: 'marketing',
  priority: 'low',
  content: {
    en: {
      body: '🎁 Special Offer for You!\n\n{{offer_title}}\n\n{{offer_description}}\n\n⏰ Valid until {{expiry_date}}\n💰 Potential Savings: ${{savings}}\n\nDon\'t miss out!',
      buttons: [
        { type: 'quick_reply', text: 'Claim Offer', value: 'CLAIM' },
        { type: 'quick_reply', text: 'Learn More', value: 'INFO' }
      ]
    }
  },
  required_variables: ['offer_title', 'offer_description', 'expiry_date', 'savings']
}
```

#### T030: Survey Request
```typescript
{
  template_id: 'T030',
  template_name: 'Customer Satisfaction Survey',
  template_category: 'marketing',
  priority: 'low',
  content: {
    en: {
      body: '📊 Quick Survey (30 seconds)\n\nHi {{customer_name}}, how was your experience with Lynia Finance?\n\nYour feedback helps us improve!',
      buttons: [
        { type: 'quick_reply', text: '⭐⭐⭐⭐⭐ Excellent', value: 'RATE_5' },
        { type: 'quick_reply', text: '⭐⭐⭐⭐ Good', value: 'RATE_4' },
        { type: 'quick_reply', text: '⭐⭐⭐ Fair', value: 'RATE_3' },
        { type: 'quick_reply', text: 'Not Great', value: 'RATE_LOW' }
      ]
    }
  },
  required_variables: ['customer_name']
}
```

---

## 4. Event-Driven Triggers

### 4.1 Trigger System Architecture

```typescript
interface NotificationTrigger {
  trigger_id: string;
  trigger_name: string;
  event_type: string; // Database event or cron schedule
  template_id: string;

  // Conditions that must be met
  conditions: TriggerCondition[];

  // Timing
  timing: {
    type: 'immediate' | 'delayed' | 'scheduled';
    delay_minutes?: number; // For delayed
    schedule_expression?: string; // For scheduled (cron)
  };

  // Target audience
  target: {
    customer_segment?: string; // 'all', 'active', 'overdue', etc.
    custom_query?: string; // SQL query for complex targeting
  };

  // Rate limiting
  max_sends_per_customer_per_day?: number;
  cooldown_hours?: number; // Minimum time between sends

  is_active: boolean;
}

interface TriggerCondition {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in';
  value: any;
}
```

### 4.2 Onboarding Triggers

```typescript
const TRIGGERS_ONBOARDING: NotificationTrigger[] = [
  {
    trigger_id: 'TRG_001',
    trigger_name: 'Welcome Message',
    event_type: 'customer.created',
    template_id: 'T001',
    conditions: [],
    timing: { type: 'immediate' },
    target: { customer_segment: 'new' },
    is_active: true
  },
  {
    trigger_id: 'TRG_002',
    trigger_name: 'KYC Reminder',
    event_type: 'scheduled',
    template_id: 'T002',
    conditions: [
      { field: 'kyc_status', operator: '==', value: 'pending' }
    ],
    timing: {
      type: 'scheduled',
      schedule_expression: '0 10 * * *' // Daily at 10am
    },
    target: { customer_segment: 'kyc_pending' },
    max_sends_per_customer_per_day: 1,
    is_active: true
  },
  {
    trigger_id: 'TRG_003',
    trigger_name: 'KYC Verification Success',
    event_type: 'kyc_submission.verified',
    template_id: 'T003',
    conditions: [
      { field: 'verification_result', operator: '==', value: 'approved' }
    ],
    timing: { type: 'immediate' },
    target: {},
    is_active: true
  }
];
```

### 4.3 Payment Triggers

```typescript
const TRIGGERS_PAYMENTS: NotificationTrigger[] = [
  {
    trigger_id: 'TRG_013',
    trigger_name: 'Payment Due in 7 Days',
    event_type: 'scheduled',
    template_id: 'T013',
    conditions: [],
    timing: {
      type: 'scheduled',
      schedule_expression: '0 9 * * *' // Daily at 9am
    },
    target: {
      custom_query: `
        SELECT customer_id FROM payments
        WHERE status = 'pending'
        AND due_date = CURRENT_DATE + INTERVAL '7 days'
      `
    },
    max_sends_per_customer_per_day: 1,
    is_active: true
  },
  {
    trigger_id: 'TRG_014',
    trigger_name: 'Payment Due in 24 Hours',
    event_type: 'scheduled',
    template_id: 'T014',
    conditions: [],
    timing: {
      type: 'scheduled',
      schedule_expression: '0 9 * * *' // Daily at 9am
    },
    target: {
      custom_query: `
        SELECT customer_id FROM payments
        WHERE status = 'pending'
        AND due_date = CURRENT_DATE + INTERVAL '1 day'
      `
    },
    max_sends_per_customer_per_day: 1,
    is_active: true
  },
  {
    trigger_id: 'TRG_015',
    trigger_name: 'Payment Overdue',
    event_type: 'scheduled',
    template_id: 'T015',
    conditions: [],
    timing: {
      type: 'scheduled',
      schedule_expression: '0 10 * * *' // Daily at 10am
    },
    target: {
      custom_query: `
        SELECT customer_id FROM payments
        WHERE status = 'overdue'
        AND due_date < CURRENT_DATE
      `
    },
    max_sends_per_customer_per_day: 1,
    cooldown_hours: 24,
    is_active: true
  },
  {
    trigger_id: 'TRG_016',
    trigger_name: 'Payment Received',
    event_type: 'payment.confirmed',
    template_id: 'T016',
    conditions: [
      { field: 'status', operator: '==', value: 'confirmed' }
    ],
    timing: { type: 'immediate' },
    target: {},
    is_active: true
  }
];
```

### 4.4 Device Lock Triggers

```typescript
const TRIGGERS_DEVICE_LOCK: NotificationTrigger[] = [
  {
    trigger_id: 'TRG_021',
    trigger_name: 'Device Lock Warning - 7 Days',
    event_type: 'scheduled',
    template_id: 'T021',
    conditions: [],
    timing: {
      type: 'scheduled',
      schedule_expression: '0 9 * * *'
    },
    target: {
      custom_query: `
        SELECT customer_id FROM device_lock_schedule
        WHERE lock_scheduled_at = CURRENT_DATE + INTERVAL '7 days'
        AND status = 'scheduled'
      `
    },
    max_sends_per_customer_per_day: 1,
    is_active: true
  },
  {
    trigger_id: 'TRG_022',
    trigger_name: 'Device Lock Warning - 3 Days FINAL',
    event_type: 'scheduled',
    template_id: 'T022',
    conditions: [],
    timing: {
      type: 'scheduled',
      schedule_expression: '0 9 * * *'
    },
    target: {
      custom_query: `
        SELECT customer_id FROM device_lock_schedule
        WHERE lock_scheduled_at = CURRENT_DATE + INTERVAL '3 days'
        AND status = 'scheduled'
      `
    },
    max_sends_per_customer_per_day: 2, // Can send twice for final warning
    is_active: true
  },
  {
    trigger_id: 'TRG_023',
    trigger_name: 'Device Locked',
    event_type: 'device.locked',
    template_id: 'T023',
    conditions: [
      { field: 'lock_status', operator: '==', value: 'locked' }
    ],
    timing: { type: 'immediate' },
    target: {},
    is_active: true
  },
  {
    trigger_id: 'TRG_024',
    trigger_name: 'Device Unlocked',
    event_type: 'device.unlocked',
    template_id: 'T024',
    conditions: [
      { field: 'lock_status', operator: '==', value: 'unlocked' }
    ],
    timing: { type: 'immediate' },
    target: {},
    is_active: true
  }
];
```

### 4.5 Trigger Execution Engine

```typescript
async function executeTrigger(trigger: NotificationTrigger, eventData?: any): Promise<void> {
  // Check if trigger is active
  if (!trigger.is_active) return;

  // Get target customers
  let customers: Customer[];
  if (trigger.target.custom_query) {
    const { data } = await supabase.rpc('execute_query', {
      query: trigger.target.custom_query
    });
    customers = data;
  } else if (trigger.target.customer_segment) {
    customers = await getCustomersBySegment(trigger.target.customer_segment);
  } else if (eventData?.customer_id) {
    customers = [await getCustomer(eventData.customer_id)];
  } else {
    return;
  }

  // Apply conditions
  const eligibleCustomers = customers.filter(customer => {
    return trigger.conditions.every(condition => {
      return evaluateCondition(customer, eventData, condition);
    });
  });

  // Check rate limits and cooldowns
  const finalCustomers = await filterByRateLimits(
    eligibleCustomers,
    trigger.trigger_id,
    trigger.max_sends_per_customer_per_day,
    trigger.cooldown_hours
  );

  // Schedule notifications
  for (const customer of finalCustomers) {
    const variables = extractVariables(customer, eventData);

    await scheduleNotification({
      notification_id: uuidv4(),
      customer_id: customer.id,
      template_id: trigger.template_id,
      priority: await getPriorityFromTemplate(trigger.template_id),
      channels_allowed: ['whatsapp', 'sms', 'email'],
      scheduled_at: calculateScheduleTime(trigger.timing),
      variables: variables
    });
  }
}

function evaluateCondition(
  customer: Customer,
  eventData: any,
  condition: TriggerCondition
): boolean {
  const value = eventData?.[condition.field] ?? customer[condition.field];

  switch (condition.operator) {
    case '==':
      return value === condition.value;
    case '!=':
      return value !== condition.value;
    case '>':
      return value > condition.value;
    case '<':
      return value < condition.value;
    case '>=':
      return value >= condition.value;
    case '<=':
      return value <= condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    default:
      return false;
  }
}

function calculateScheduleTime(timing: NotificationTrigger['timing']): Date {
  const now = new Date();

  switch (timing.type) {
    case 'immediate':
      return now;
    case 'delayed':
      return new Date(now.getTime() + (timing.delay_minutes || 0) * 60 * 1000);
    case 'scheduled':
      // For cron-based scheduling, this would be handled by the scheduler
      return now;
    default:
      return now;
  }
}
```

---

## 5. Database Schema

### 5.1 Extended Notification Templates Table

```sql
CREATE TABLE notification_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(10) NOT NULL UNIQUE, -- e.g., 'T001'
  template_name VARCHAR(100) NOT NULL,
  template_category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,

  -- Multi-language content (JSONB for flexibility)
  content JSONB NOT NULL,

  -- Channel settings
  whatsapp_enabled BOOLEAN DEFAULT TRUE,
  whatsapp_template_name VARCHAR(100),
  whatsapp_approved BOOLEAN DEFAULT FALSE,
  sms_enabled BOOLEAN DEFAULT TRUE,
  sms_max_length INT DEFAULT 160,
  email_enabled BOOLEAN DEFAULT FALSE,

  required_variables TEXT[] NOT NULL DEFAULT '{}',

  -- A/B testing
  variant_of UUID REFERENCES notification_templates(template_id),
  test_percentage INT CHECK (test_percentage >= 0 AND test_percentage <= 100),

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 Notification Triggers Table

```sql
CREATE TABLE notification_triggers (
  trigger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_code VARCHAR(20) NOT NULL UNIQUE,
  trigger_name VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  template_id UUID NOT NULL REFERENCES notification_templates(template_id),

  -- Conditions (JSONB array)
  conditions JSONB NOT NULL DEFAULT '[]',

  -- Timing configuration (JSONB)
  timing JSONB NOT NULL,

  -- Target configuration (JSONB)
  target JSONB NOT NULL DEFAULT '{}',

  -- Rate limiting
  max_sends_per_customer_per_day INT,
  cooldown_hours INT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for event type lookups
CREATE INDEX idx_notification_triggers_event_type ON notification_triggers(event_type);
CREATE INDEX idx_notification_triggers_active ON notification_triggers(is_active);
```

### 5.3 Trigger Execution Log

```sql
CREATE TABLE trigger_execution_log (
  execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES notification_triggers(trigger_id),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  customers_targeted INT NOT NULL,
  customers_eligible INT NOT NULL,
  notifications_sent INT NOT NULL,

  execution_time_ms INT,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trigger_execution_log_trigger_id ON trigger_execution_log(trigger_id);
CREATE INDEX idx_trigger_execution_log_executed_at ON trigger_execution_log(executed_at DESC);
```

---

## 6. Summary

This notification templates and triggers specification provides a comprehensive communication framework for Lynia Finance with the following key features:

**Template Library**: 30+ pre-defined templates covering onboarding, loan application, payments, device management, and alerts
**Multi-Language**: Full English, Shona, and Ndebele support for all critical templates
**Event-Driven**: Automated triggers based on database events (customer.created, payment.confirmed, etc.)
**Scheduled Triggers**: Cron-based scheduling for payment reminders and device lock warnings
**Personalization**: Variable substitution for customer-specific content
**Channel Optimization**: Channel-specific formatting (WhatsApp buttons, SMS length optimization, HTML emails)
**Rate Limiting**: Per-customer daily limits and cooldown periods to prevent spam
**A/B Testing**: Built-in support for template variants and testing

**Implementation Priority**: High (required for all customer communications)
**Implementation Complexity**: Medium (requires template management system and trigger engine)
**Business Impact**: Critical (automates customer communication throughout journey)

**Related Tasks**:
- P1-T037: Multi-Channel Notification Design
- P1-T039: Payment Reminder Strategy
- P1-T040: Notification Delivery Tracking

**Next Steps**:
1. Load all 30+ templates into database
2. Register WhatsApp templates with Meta Business Manager
3. Translate critical templates to Shona and Ndebele
4. Implement trigger execution engine
5. Set up cron jobs for scheduled triggers
6. Create admin interface for template management
7. Implement A/B testing framework for template optimization
