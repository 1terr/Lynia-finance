# WhatsApp Conversation Flow Design

**Document**: P1-T007 - WhatsApp Bot Conversation Flow Design
**Status**: Complete
**Last Updated**: 2025-11-24
**Owner**: Product & Engineering Team

## Table of Contents
1. [Overview](#overview)
2. [State Machine Architecture](#state-machine-architecture)
3. [Conversation Flow 1: Onboarding & KYC](#conversation-flow-1-onboarding--kyc)
4. [Conversation Flow 2: Device Browsing](#conversation-flow-2-device-browsing)
5. [Conversation Flow 3: Loan Application](#conversation-flow-3-loan-application)
6. [Conversation Flow 4: Payment Management](#conversation-flow-4-payment-management)
5. [Conversation Flow 5: Customer Support](#conversation-flow-5-customer-support)
6. [Conversation Flow 6: Account Management](#conversation-flow-6-account-management)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Fallback Scenarios](#fallback-scenarios)
9. [Message Templates](#message-templates)
10. [Session Management](#session-management)
11. [Analytics & Tracking](#analytics--tracking)

---

## 1. Overview

### 1.1 Design Principles

**WhatsApp-First Experience**:
- Simple, conversational language (Grade 8 reading level)
- Short messages (max 3 sentences per message)
- Quick reply buttons for easy navigation
- Support for both English and Shona
- Mobile-optimized (low data usage)

**User Experience Goals**:
- Complete onboarding in <10 minutes
- Apply for loan in <5 minutes
- Make payment in <3 minutes
- Zero app downloads required
- Works on any phone (smartphone or feature phone)

**Conversation Style**:
- Friendly, professional tone
- Clear calls-to-action
- Confirmation at each step
- Progress indicators for multi-step flows
- Emoji for visual clarity (sparingly)

### 1.2 Supported Languages

| Language | Coverage | Status |
|----------|----------|--------|
| English | 100% | ✅ Live |
| Shona | 80% (key flows) | 🚧 Phase 2 |

### 1.3 WhatsApp Business API Features Used

| Feature | Use Case | Implementation |
|---------|----------|----------------|
| Text Messages | All conversations | ✅ Core |
| Interactive Buttons | Menu navigation, Yes/No prompts | ✅ Core |
| Interactive Lists | Device catalog, payment options | ✅ Core |
| Media Messages | Device images, KYC photo upload | ✅ Core |
| Message Templates | Proactive notifications (payment reminders) | ✅ Core |
| Quick Replies | Frequent actions (Check Balance, Pay Now) | ✅ Core |
| Location Messages | Find nearest distributor | 🚧 Phase 2 |

### 1.4 Configurable Loan Terms

**IMPORTANT**: All loan terms displayed in WhatsApp flows MUST be pulled from system configuration, NOT hardcoded.

**Configurable Parameters**:
- Loan term duration (default: 8 months, configurable per credit tier)
- Interest rate percentage (NOT displayed to customers)
- Payment schedule frequency (monthly, bi-weekly)
- Late payment penalties
- Deposit percentage (default: 10%)
- Credit tier limits ($200, $350, $500)

**Implementation**:
```javascript
// System configuration table
const loanConfig = await db.system_config.findOne({
  key: 'loan_terms',
  active: true
});

// Use configured values in WhatsApp messages
const loanTerm = loanConfig.default_term_months; // 8 months
const depositPct = loanConfig.deposit_percentage; // 0.10
const interestRate = loanConfig.interest_rate; // NOT shown to customer

// Calculate and display
const monthlyPayment = calculateMonthlyPayment(principal, interestRate, loanTerm);
const totalRepayment = monthlyPayment * loanTerm;
```

**Customer Display Rules**:
- ✅ SHOW: Total repayment amount, monthly payment, loan term period
- ❌ HIDE: Interest rate percentage, interest calculation breakdown

**Admin Configuration**:
- Loan terms can be changed via admin dashboard
- Changes apply to NEW loans only (not retroactive)
- WhatsApp flows automatically reflect updated terms
- Audit trail for all configuration changes

---

## 2. State Machine Architecture

### 2.1 State Machine Design

**Approach**: Finite State Machine (FSM) with context preservation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WhatsApp Bot States                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [IDLE] ──────────────────────────────────────────────────────────────►│
│    │                                                                     │
│    ├──► [ONBOARDING] ──► [KYC_SUBMIT] ──► [KYC_PENDING]               │
│    │                                            │                        │
│    │                                            ▼                        │
│    ├──► [BROWSING] ──► [DEVICE_SELECTED] ──► [IDLE]                   │
│    │                                                                     │
│    ├──► [LOAN_APPLICATION] ──► [LOAN_REVIEW] ──► [DEPOSIT_PENDING]   │
│    │                                                      │               │
│    │                                                      ▼               │
│    │                                              [DEPOSIT_PAID] ──► [IDLE] │
│    │                                                                     │
│    ├──► [PAYMENT_MENU] ──► [PAYMENT_CONFIRM] ──► [IDLE]               │
│    │                                                                     │
│    ├──► [SUPPORT] ──► [SUPPORT_RESOLVED] ──► [IDLE]                   │
│    │                                                                     │
│    └──► [ACCOUNT_MENU] ──► [ACCOUNT_ACTION] ──► [IDLE]                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 State Schema

**Database Table**: `whatsapp_sessions`

```sql
CREATE TABLE whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  phone_number VARCHAR(15) NOT NULL,
  current_state VARCHAR(50) NOT NULL DEFAULT 'IDLE',
  previous_state VARCHAR(50),
  context JSONB DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'en',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 minutes',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX idx_whatsapp_sessions_customer ON whatsapp_sessions(customer_id);
CREATE INDEX idx_whatsapp_sessions_state ON whatsapp_sessions(current_state);
CREATE INDEX idx_whatsapp_sessions_expires ON whatsapp_sessions(expires_at)
  WHERE current_state != 'IDLE';
```

**Context Object Structure**:
```json
{
  "onboarding": {
    "step": "national_id_capture",
    "attempts": 1,
    "max_attempts": 3
  },
  "device_browsing": {
    "filters": {
      "max_price": 350,
      "brand": "Samsung"
    },
    "selected_device_id": null,
    "browsing_history": ["device-uuid-1", "device-uuid-2"]
  },
  "loan_application": {
    "device_id": "uuid",
    "principal": 350,
    "term_months": 8,
    "monthly_payment": 70.31,
    "deposit_amount": 35.00,
    "deposit_percentage": 0.10,
    "confirmation_pending": true,
    "deposit_paid": false,
    "deposit_payment_id": null,
    "deposit_transaction_id": null,
    "deposit_confirmed_at": null
  },
  "payment": {
    "loan_id": "uuid",
    "amount": 70.31,
    "payment_method": "ecocash",
    "phone_number": "+263771234567"
  },
  "preferences": {
    "language": "en",
    "timezone": "Africa/Harare"
  }
}
```

### 2.3 State Transitions

**State Transition Rules**:
1. **Timeout**: After 30 minutes of inactivity, return to IDLE
2. **Cancel**: User can type "cancel" or "menu" to return to main menu
3. **Error**: On error, preserve state and offer retry
4. **Completion**: On successful completion, return to IDLE with confirmation

**State Transition Function**:
```javascript
async function transitionState(sessionId, newState, context = {}) {
  const session = await db.whatsapp_sessions.findOne({ id: sessionId });

  // Validate state transition
  const validTransitions = {
    'IDLE': ['ONBOARDING', 'BROWSING', 'LOAN_APPLICATION', 'PAYMENT_MENU', 'SUPPORT', 'ACCOUNT_MENU'],
    'ONBOARDING': ['KYC_SUBMIT', 'IDLE'],
    'KYC_SUBMIT': ['KYC_PENDING', 'ONBOARDING', 'IDLE'],
    'BROWSING': ['DEVICE_SELECTED', 'IDLE'],
    'DEVICE_SELECTED': ['LOAN_APPLICATION', 'BROWSING', 'IDLE'],
    'LOAN_APPLICATION': ['LOAN_REVIEW', 'IDLE'],
    'LOAN_REVIEW': ['DEPOSIT_PENDING', 'IDLE'], // Added deposit payment state
    'DEPOSIT_PENDING': ['DEPOSIT_PAID', 'IDLE'], // Customer must pay deposit before collection
    'DEPOSIT_PAID': ['IDLE'], // Deposit verified, device ready for collection
    'PAYMENT_MENU': ['PAYMENT_CONFIRM', 'IDLE'],
    'PAYMENT_CONFIRM': ['IDLE'],
    'SUPPORT': ['SUPPORT_RESOLVED', 'IDLE'],
    'ACCOUNT_MENU': ['ACCOUNT_ACTION', 'IDLE']
  };

  if (!validTransitions[session.current_state]?.includes(newState)) {
    throw new Error(`Invalid state transition: ${session.current_state} -> ${newState}`);
  }

  // Update session
  await db.whatsapp_sessions.update({
    id: sessionId
  }, {
    previous_state: session.current_state,
    current_state: newState,
    context: { ...session.context, ...context },
    last_interaction_at: new Date(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    updated_at: new Date()
  });

  // Log state transition
  await db.audit_logs.insert({
    action: 'WHATSAPP_STATE_TRANSITION',
    resource_type: 'whatsapp_session',
    resource_id: sessionId,
    changes: {
      from: session.current_state,
      to: newState,
      context_updated: Object.keys(context)
    },
    timestamp: new Date()
  });

  return newState;
}
```

---

## 3. Conversation Flow 1: Onboarding & KYC

### 3.1 Flow Overview

**Goal**: Verify customer identity and create account
**Duration**: 8-10 minutes
**States**: IDLE → ONBOARDING → KYC_SUBMIT → KYC_PENDING → IDLE
**Success Criteria**: KYC approved, account created

### 3.2 Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Onboarding & KYC Flow                    │
└─────────────────────────────────────────────────────────────┘

[START: User sends "Hi" to WhatsApp number]
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ BOT: Welcome to Lynia Finance! 📱                         │
│ Get a smartphone on credit with flexible payments.       │
│                                                           │
│ To get started, I'll need to verify your identity.       │
│ This takes about 10 minutes.                             │
│                                                           │
│ [Continue] [Learn More]                                  │
└──────────────────────────────────────────────────────────┘
         │
         ├─► [Learn More] ──► Show product info ──► Return to welcome
         │
         ▼ [Continue]
┌──────────────────────────────────────────────────────────┐
│ BOT: Great! Let's verify your identity.                  │
│                                                           │
│ What's your first name?                                  │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [User: "John"]
┌──────────────────────────────────────────────────────────┐
│ BOT: Thanks John! What's your last name?                 │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [User: "Doe"]
┌──────────────────────────────────────────────────────────┐
│ BOT: What's your National ID number?                     │
│ Format: 63-123456-A-12                                   │
└──────────────────────────────────────────────────────────┘
         │
         ├─► [Invalid format] ──► Show error + retry (max 3 attempts)
         │
         ▼ [Valid: "63-123456-A-12"]
┌──────────────────────────────────────────────────────────┐
│ BOT: Perfect! Now I need a photo of your National ID.    │
│                                                           │
│ Please send:                                             │
│ 1️⃣ Clear photo of the FRONT of your ID                  │
│ 2️⃣ Clear photo of the BACK of your ID                   │
│                                                           │
│ Make sure the text is readable!                          │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [User sends photo 1]
┌──────────────────────────────────────────────────────────┐
│ BOT: ✅ Front received! Now send the back of your ID.    │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [User sends photo 2]
┌──────────────────────────────────────────────────────────┐
│ BOT: ✅ Back received! Last step - I need a selfie.      │
│                                                           │
│ Please take a clear selfie showing your face.            │
│ Remove sunglasses and hats.                              │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [User sends selfie]
┌──────────────────────────────────────────────────────────┐
│ BOT: Perfect! I'm now verifying your identity...         │
│ This takes 2-3 minutes. ⏳                                │
└──────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────────────┐
         │                                                  │
         ▼ [KYC Approved]                    [KYC Rejected]▼
┌──────────────────────────┐       ┌─────────────────────────────┐
│ BOT: ✅ Identity verified! │       │ BOT: ❌ We couldn't verify   │
│                           │       │ your identity. Please:      │
│ Your account is ready!    │       │                             │
│ Credit limit: $200        │       │ 1. Check your ID photos are│
│                           │       │    clear and readable      │
│ [Browse Devices]          │       │ 2. Try again               │
│ [Main Menu]               │       │                             │
└──────────────────────────┘       │ [Retry KYC] [Contact Support]│
                                    └─────────────────────────────┘
```

### 3.3 Detailed Conversation Script

#### **Step 1: Welcome Message** (State: IDLE → ONBOARDING)

**Trigger**: User sends any message (first interaction)

```
BOT:
👋 Welcome to Lynia Finance!

We help you get a smartphone on credit with flexible 8-month payment plans.

🔹 No bank account needed
🔹 No upfront deposit
🔹 Fast approval (same day)
🔹 Devices from $200-$500

To get started, I'll need to verify your identity. This takes about 10 minutes.

Ready to continue?

[✅ Continue] [ℹ️ Learn More]
```

**User Actions**:
- **[Continue]** → Proceed to Step 2
- **[Learn More]** → Show product details, then return to welcome

#### **Step 2: Capture First Name**

```
BOT:
Great! Let's get you verified.

First, what's your first name?
```

**Validation**:
- Must be alphabetic characters only
- 2-50 characters
- No special characters

**Error Handling**:
```
BOT:
Please enter a valid first name (letters only, no numbers or symbols).

Example: John
```

#### **Step 3: Capture Last Name**

```
BOT:
Thanks {first_name}! What's your last name?
```

**Validation**: Same as first name

#### **Step 4: Capture National ID**

```
BOT:
What's your National ID number?

Format: 63-123456-A-12
```

**Validation**:
- Regex: `^[0-9]{2}-[0-9]{6,7}-[A-Z]-[0-9]{2}$`
- Must not already exist in database

**Error Messages**:
```
BOT (Invalid Format):
Invalid ID format. Please use this format: 63-123456-A-12

Your ID has:
• 2 digits (birth year)
• Dash (-)
• 6-7 digits (registration number)
• Dash (-)
• 1 letter (district code)
• Dash (-)
• 2 digits (check digits)

BOT (Duplicate):
This National ID is already registered with us.

[🔑 Login to existing account] [📞 Contact Support]
```

#### **Step 5: Request ID Photos**

```
BOT:
Perfect! Now I need photos of your National ID.

Please send 2 clear photos:

1️⃣ FRONT of your ID
2️⃣ BACK of your ID

📸 Tips for good photos:
✅ Good lighting (no shadows)
✅ All text is readable
✅ Flat surface (no glare)
❌ No blurry or cropped edges

Send the FRONT photo first.
```

**After Front Photo Received**:
```
BOT:
✅ Front of ID received!

Now send the BACK of your ID.
```

**After Back Photo Received**:
```
BOT:
✅ Back of ID received!

Photos look good! 👍
```

**Image Validation**:
- File type: JPEG, PNG
- Max size: 5MB
- Min resolution: 800x600px

**Error Handling**:
```
BOT (File too large):
Image is too large. Please send a smaller image (max 5MB).

You can:
• Take a new photo (not maximum quality)
• Compress the image

BOT (Wrong file type):
Please send a photo (JPEG or PNG format).
```

#### **Step 6: Request Selfie**

```
BOT:
Last step! I need a selfie to confirm it's really you. 📷

Please take a clear selfie showing your face.

✅ Remove sunglasses or hats
✅ Look directly at camera
✅ Good lighting on your face
❌ No masks or filters

Send your selfie now.
```

**After Selfie Received**:
```
BOT:
✅ Selfie received!

I'm now verifying your identity with our partner DIDIT.
This usually takes 2-3 minutes. ⏳

You'll get a notification as soon as it's done. Feel free to close WhatsApp and come back later.
```

#### **Step 7: KYC Processing**

**Backend Process**:
1. Upload photos to S3 (encrypted)
2. Submit to DIDIT API
3. Wait for webhook callback (async)
4. Update customer KYC status

**State**: KYC_SUBMIT → KYC_PENDING

#### **Step 8A: KYC Approved** (Success Path)

**Trigger**: DIDIT webhook returns "approved"

```
BOT:
🎉 Great news! Your identity has been verified!

Your account is now active.

📊 Your Credit Profile:
• Credit Limit: $200
• Available: $200
• Loan Term: 8 months

You can now:
🛒 Browse devices
📱 Apply for a loan
📊 View your account

[🛍️ Browse Devices] [📋 Main Menu]
```

**State**: KYC_PENDING → IDLE

#### **Step 8B: KYC Rejected** (Failure Path)

```
BOT:
❌ We couldn't verify your identity.

Reason: {rejection_reason}

Common issues:
• ID photo is blurry or unclear
• Selfie doesn't match ID photo
• ID number doesn't match photo

You can:
1️⃣ Try again with clearer photos
2️⃣ Contact our support team

[🔄 Retry Verification] [📞 Contact Support]
```

**State**: KYC_PENDING → IDLE (or ONBOARDING if retry)

#### **Step 8C: KYC Manual Review**

```
BOT:
⚠️ Your verification needs manual review.

This happens when our automated system can't make a decision. A human will review your documents within 24 hours.

We'll notify you as soon as it's done.

📧 You can also track your status:
• WhatsApp: Type "status"
• Email: {customer_email}

[📋 Main Menu] [📞 Contact Support]
```

### 3.4 Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| User sends wrong file type (PDF, video) | Reject, ask for image |
| User sends too many photos | Confirm which is which (front/back) |
| User abandons flow mid-way | Save progress, remind after 1 hour |
| User tries to skip steps | Explain step is required, offer help |
| National ID already exists | Offer login to existing account |
| DIDIT API timeout | Retry 3 times, then manual review |
| User's phone number changes | Re-verify via OTP to old number |

### 3.5 Conversation Metrics

**Track**:
- Onboarding start rate (users who click "Continue")
- Drop-off rate at each step
- Average time to complete
- KYC approval rate
- Retry rate after rejection

**Target Metrics**:
- Completion rate: >70%
- Average duration: <10 minutes
- KYC approval rate: >85%
- Drop-off at photo upload: <20%

---

## 4. Conversation Flow 2: Device Browsing

### 4.1 Flow Overview

**Goal**: Help customer find and select a device
**Duration**: 3-5 minutes
**States**: IDLE → BROWSING → DEVICE_SELECTED → IDLE
**Success Criteria**: Device selected, customer ready to apply

### 4.2 Flow Diagram

```
[START: User clicks "Browse Devices" or types "devices"]
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ BOT: 📱 Device Catalog                                    │
│                                                           │
│ Filter by price:                                         │
│ [Up to $200] [$200-$350] [$350-$500] [All Devices]      │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [User selects "$200-$350"]
┌──────────────────────────────────────────────────────────┐
│ BOT: 12 devices found ($200-$350)                        │
│                                                           │
│ [List of devices...]                                     │
│ 1. Samsung Galaxy A14 - $299                             │
│ 2. Xiaomi Redmi Note 12 - $279                           │
│ 3. Tecno Spark 10 - $219                                 │
│ ...                                                       │
│                                                           │
│ [View All] [Change Filter]                               │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [User selects device #1]
┌──────────────────────────────────────────────────────────┐
│ BOT: 📱 Samsung Galaxy A14                                │
│ [Image]                                                   │
│                                                           │
│ Price: $299 (or $47.81/month for 8 months)               │
│                                                           │
│ Specs:                                                    │
│ • 4GB RAM / 64GB Storage                                 │
│ • 6.6" Display                                            │
│ • 50MP Camera                                             │
│ • 5000mAh Battery                                         │
│                                                           │
│ [📝 Apply Now] [🔍 View More] [← Back to List]           │
└──────────────────────────────────────────────────────────┘
```

### 4.3 Detailed Conversation Script

#### **Step 1: Device Catalog Entry**

**Trigger**: User clicks "Browse Devices" or types "devices", "phones", "catalog"

```
BOT:
📱 Welcome to our Device Catalog!

We have {total_devices} smartphones available.

How would you like to filter?

💰 By Price:
[Up to $200] [$200-$350] [$350-$500] [All Devices]

📱 By Brand:
[Samsung] [Xiaomi] [Tecno] [Infinix] [All Brands]

Or just type "show all" to see everything.
```

**State**: IDLE → BROWSING

#### **Step 2: Show Filtered Results**

**User selects**: [$200-$350]

```
BOT:
📋 12 devices found ($200-$350)

Here are the top 5:

1️⃣ Samsung Galaxy A14
   💵 $299 ($47.81/month)
   📊 4GB RAM, 64GB Storage

2️⃣ Xiaomi Redmi Note 12
   💵 $279 ($44.69/month)
   📊 6GB RAM, 128GB Storage

3️⃣ Tecno Spark 10 Pro
   💵 $259 ($41.52/month)
   📊 8GB RAM, 128GB Storage

4️⃣ Infinix Hot 30
   💵 $239 ($38.30/month)
   📊 8GB RAM, 128GB Storage

5️⃣ Samsung Galaxy A04
   💵 $219 ($35.09/month)
   📊 3GB RAM, 32GB Storage

Type a number (1-5) to view details, or:
[📋 View All 12] [🔄 Change Filter] [📞 Need Help?]
```

**Interactive List** (WhatsApp Business API):
```json
{
  "type": "list",
  "header": {
    "type": "text",
    "text": "Device Catalog ($200-$350)"
  },
  "body": {
    "text": "Select a device to view details:"
  },
  "action": {
    "button": "View Devices",
    "sections": [
      {
        "title": "Samsung",
        "rows": [
          {
            "id": "device_1",
            "title": "Galaxy A14",
            "description": "$299 - 4GB/64GB"
          },
          {
            "id": "device_5",
            "title": "Galaxy A04",
            "description": "$219 - 3GB/32GB"
          }
        ]
      },
      {
        "title": "Xiaomi",
        "rows": [
          {
            "id": "device_2",
            "title": "Redmi Note 12",
            "description": "$279 - 6GB/128GB"
          }
        ]
      }
    ]
  }
}
```

#### **Step 3: Device Details**

**User selects**: Device #1 (Samsung Galaxy A14)

```
BOT:
📱 Samsung Galaxy A14

[Image of device]

💵 Financing Price: $299
   Monthly Payment: $47.81/month (8 months)
   Total Repayment: $382.50

📊 Specifications:
• Display: 6.6" FHD+
• RAM: 4GB
• Storage: 64GB (expandable to 1TB)
• Camera: 50MP main, 13MP selfie
• Battery: 5000mAh
• OS: Android 13

✅ In Stock: 5 units available

Want this device?
[📝 Apply for Loan] [🔍 See More Devices] [📊 Compare]
```

**State**: BROWSING → DEVICE_SELECTED

#### **Step 4: Apply or Continue Browsing**

**User clicks**: [Apply for Loan]
→ Transition to Loan Application Flow (Section 5)

**User clicks**: [See More Devices]
→ Return to device list

**User clicks**: [Compare]
```
BOT:
📊 Compare Devices

Which device do you want to compare with Samsung Galaxy A14?

[Recent viewed devices list]
1️⃣ Xiaomi Redmi Note 12 ($279)
2️⃣ Tecno Spark 10 Pro ($259)

Or type "back" to return to device details.
```

#### **Step 5: Device Comparison** (Optional)

**User selects**: Xiaomi Redmi Note 12

```
BOT:
📊 Device Comparison

Samsung Galaxy A14 vs Xiaomi Redmi Note 12

                   Galaxy A14    Redmi Note 12
💵 Price           $299          $279
📱 RAM             4GB           6GB ✅
💾 Storage         64GB          128GB ✅
📸 Camera          50MP          50MP
🔋 Battery         5000mAh       5000mAh
📏 Display         6.6"          6.67" ✅
💰 Monthly         $47.81        $44.69 ✅

✅ = Better value

Which device do you prefer?
[📝 Apply: Galaxy A14] [📝 Apply: Redmi Note 12] [← Back]
```

### 4.4 Personalized Recommendations

**Based on credit limit**:
```
BOT:
💡 Good news! Based on your credit limit ($350), you qualify for these popular devices:

⭐ Recommended for you:
1️⃣ Xiaomi Redmi Note 12 ($279)
   Why: Best value for your limit, great specs

2️⃣ Samsung Galaxy A14 ($299)
   Why: Popular choice, reliable brand

3️⃣ Tecno Spark 10 Pro ($259)
   Why: Most storage (128GB), leaves credit available

[View Details] [See All Devices]
```

### 4.5 Search & Filters

**User types**: "I want a Samsung with good camera"

```
BOT:
🔍 Search results for "Samsung good camera"

Found 3 devices:

1️⃣ Samsung Galaxy A14 ($299)
   📸 50MP main camera + 13MP selfie

2️⃣ Samsung Galaxy A04 ($219)
   📸 50MP main camera + 5MP selfie

3️⃣ Samsung Galaxy M14 ($349)
   📸 50MP main + 13MP ultrawide + 2MP macro

Want to see details for any of these?
Type 1, 2, or 3, or refine your search.
```

### 4.6 Conversation Metrics

**Track**:
- Devices viewed per session
- Filter usage rate
- Comparison feature usage
- Time spent browsing
- Conversion rate (browsing → loan application)

**Target Metrics**:
- Average devices viewed: 3-5
- Conversion to loan application: >40%
- Average browsing time: <5 minutes

---

## 5. Conversation Flow 3: Loan Application

### 5.1 Flow Overview

**Goal**: Complete loan application, pay deposit, and prepare for device collection
**Duration**: 5-10 minutes (including deposit payment)
**States**: DEVICE_SELECTED → LOAN_APPLICATION → LOAN_REVIEW → DEPOSIT_PENDING → DEPOSIT_PAID → IDLE
**Success Criteria**: Loan approved, deposit paid, agent can verify payment, device ready for collection
**Critical Control**: Customer MUST pay deposit and payment MUST reflect in system before agent can hand over device

### 5.2 Flow Diagram

```
[START: User clicks "Apply for Loan" from device details]
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ BOT: 📝 Loan Application                                  │
│                                                           │
│ Device: Samsung Galaxy A14 ($299)                        │
│                                                           │
│ Your Credit Profile:                                     │
│ • Credit Limit: $350                                     │
│ • Available: $350                                        │
│ • No active loans                                        │
│                                                           │
│ Loan Terms:                                              │
│ • Principal: $299                                        │
│ • Term: 8 months                                         │
│ • Monthly Payment: $47.81                                │
│ • Total Repayment: $382.50                               │
│                                                           │
│ [✅ Continue] [❌ Cancel]                                 │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Continue]
┌──────────────────────────────────────────────────────────┐
│ BOT: Which agent will you collect your device from?      │
│                                                           │
│ We'll show you agents near your location.                │
│                                                           │
│ [📍 Find Nearby Agents] [📋 View All Agents]             │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Use registered address]
┌──────────────────────────────────────────────────────────┐
│ BOT: Perfect! Let me confirm your loan details:          │
│                                                           │
│ 📱 Device: Samsung Galaxy A14                             │
│ 💵 Loan Amount: $299                                      │
│ 📅 Loan Term: 8 months                                    │
│ 💰 Monthly Payment: $47.81                                │
│ 📆 First Payment Due: Dec 24, 2025                       │
│ 📍 Collection Point: {agent_name} - {agent_address}      │
│                                                           │
│ By continuing, you agree to our:                         │
│ • Loan Agreement                                         │
│ • Terms and Conditions                                   │
│ • Privacy Policy                                         │
│                                                           │
│ [✅ Confirm & Submit] [❌ Cancel]                         │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Confirm & Submit]
┌──────────────────────────────────────────────────────────┐
│ BOT: ⏳ Processing your application...                    │
│                                                           │
│ This takes about 30 seconds.                             │
└──────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────────────┐
         │                                                  │
         ▼ [Auto-Approved]                      [Rejected] ▼
┌──────────────────────────┐       ┌─────────────────────────────┐
│ BOT: 🎉 Congratulations!  │       │ BOT: ❌ Application Declined │
│                           │       │                             │
│ Your loan is APPROVED!    │       │ Reason: {reason}            │
│                           │       │                             │
│ Loan ID: #LYN12345       │       │ You can:                    │
│ Amount: $299              │       │ • Try a lower amount       │
│ Monthly: $47.81           │       │ • Improve credit score     │
│ First payment: Dec 24     │       │ • Contact support          │
└──────────────────────────┘       │                             │
         │                          │ [Try Again] [Contact Support]│
         ▼                          └─────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ BOT: 💰 DEPOSIT REQUIRED                                  │
│                                                           │
│ Before collecting your device, please pay:               │
│                                                           │
│ 📌 Deposit Amount: $29.90 (10% of $299)                  │
│ 📌 Payment Method: EcoCash or EcoCash/Omari/Innbucks/OneWallet                     │
│                                                           │
│ ⚠️ IMPORTANT:                                             │
│ • Your deposit MUST reflect in our system                │
│ • Agent will verify payment before handover              │
│ • Without payment verification, device cannot be released│
│                                                           │
│ [💳 Pay Deposit Now] [📋 View Payment Details]           │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Pay Deposit Now]
┌──────────────────────────────────────────────────────────┐
│ BOT: 💳 Deposit Payment                                   │
│                                                           │
│ Amount to pay: $29.90                                    │
│                                                           │
│ Choose payment method:                                   │
│ [EcoCash] [EcoCash/Omari/Innbucks/OneWallet]                                       │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Payment method selected - generates payment link]
┌──────────────────────────────────────────────────────────┐
│ BOT: Click below to complete your deposit payment:       │
│                                                           │
│ [Pay $29.90] (CTA button with payment link)              │
│                                                           │
│ ⏱️ Payment link expires in 30 minutes                    │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [User completes payment]
┌──────────────────────────────────────────────────────────┐
│ BOT: ✅ Deposit Payment Received!                         │
│                                                           │
│ Payment confirmed:                                       │
│ • Amount: $29.90                                         │
│ • Transaction ID: TXN123456789                           │
│ • Date: Nov 26, 2025 14:30                              │
│                                                           │
│ 🎉 Your device is ready for collection!                  │
│                                                           │
│ Next steps:                                              │
│ 1. Visit your selected agent (see details below)        │
│ 2. Show this confirmation to the agent                  │
│ 3. Agent will verify payment in system                  │
│ 4. Collect your Samsung Galaxy A14                      │
│                                                           │
│ 📍 Collection Agent Details:                             │
│ {agent_name}                                             │
│ {agent_address}                                          │
│ Phone: {agent_phone}                                     │
│ Hours: {agent_hours}                                     │
│                                                           │
│ Your payment confirmation code: #LYN12345-PAID           │
│                                                           │
│ [📍 Get Directions] [📋 View Loan Details]               │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Detailed Conversation Script

#### **Step 1: Loan Application Start**

**Trigger**: User clicks "Apply for Loan" from device details

**Pre-Check**: Verify customer eligibility
- KYC status = approved
- No active loans (for first-time customers)
- Credit limit >= device price
- Not blacklisted

```javascript
// Eligibility check
async function checkLoanEligibility(customerId, devicePrice) {
  const customer = await db.customers.findOne({ id: customerId });

  // Check KYC
  if (customer.kyc_status !== 'approved') {
    return {
      eligible: false,
      reason: 'KYC_NOT_APPROVED',
      message: 'Please complete identity verification first.'
    };
  }

  // Check active loans
  const activeLoans = await db.loans.count({
    customer_id: customerId,
    status: 'active'
  });

  if (activeLoans > 0 && customer.credit_tier === 1) {
    return {
      eligible: false,
      reason: 'ACTIVE_LOAN_EXISTS',
      message: 'Please complete your current loan before applying for a new one.'
    };
  }

  // Check credit limit
  if (customer.credit_limit < devicePrice) {
    return {
      eligible: false,
      reason: 'INSUFFICIENT_CREDIT_LIMIT',
      message: `Your credit limit ($${customer.credit_limit}) is less than device price ($${devicePrice}).`
    };
  }

  return { eligible: true };
}
```

**If eligible**:
```
BOT:
📝 Loan Application

Device: Samsung Galaxy A14 ($299)

✅ Your Credit Profile:
• Credit Limit: $350
• Available Credit: $350
• Active Loans: 0
• Credit Score: 720

📊 Proposed Loan Terms:
• Loan Amount: $299
• Loan Term: 8 months
• Monthly Payment: $47.81
• Total Repayment: $382.50

📅 Payment Schedule:
• First Payment: Dec 24, 2025
• Last Payment: Jul 24, 2026
• Payment Method: EcoCash/EcoCash/Omari/Innbucks/OneWallet

Ready to continue?
[✅ Continue] [❌ Cancel]
```

**If not eligible** (example: insufficient credit):
```
BOT:
❌ Sorry, you don't qualify for this device yet.

Reason: Your credit limit ($200) is less than the device price ($299).

💡 You have 2 options:

1️⃣ Choose a cheaper device (up to $200)
   [Browse Devices ≤ $200]

2️⃣ Build your credit score
   • Make on-time payments
   • Complete your first loan
   • Your limit will increase to $350 after 1 successful loan

[🛍️ Browse Cheaper Devices] [📋 Main Menu]
```

**State**: DEVICE_SELECTED → LOAN_APPLICATION

#### **Step 2: Agent Selection**

```
BOT:
Great! Which agent will you collect your device from?

📍 Agents near you (based on {city}, {province}):

1️⃣ TechHub Harare CBD
   123 Nelson Mandela Ave, Harare
   Distance: 2.5 km
   Hours: Mon-Sat 8am-6pm

2️⃣ MobileZone Avondale
   45 King George Rd, Avondale
   Distance: 3.8 km
   Hours: Mon-Sat 9am-5pm

3️⃣ PhonePoint Belvedere
   78 Simon Mazorodze Rd, Belvedere
   Distance: 5.2 km
   Hours: Mon-Fri 8am-5pm, Sat 9am-2pm

[Select Agent 1-3] [📍 View More Agents] [🔍 Search by Location]
```

**If user selects**: [Search by Location]
```
BOT:
Enter your preferred area or suburb:

Example: Borrowdale, Highlands, Eastlea
```

**Validation**:
- Must be valid Zimbabwe city/suburb
- Show agents within 20km radius
- Sort by distance (nearest first)

#### **Step 3: Loan Terms Review**

```
BOT:
📋 Review Your Loan Application

Please confirm these details are correct:

📱 DEVICE
   Samsung Galaxy A14
   4GB RAM / 64GB Storage

💵 LOAN DETAILS
   Principal: $299
   Total Repayment: $382.50

📅 PAYMENT PLAN
   Term: 8 months
   Monthly Payment: $47.81
   First Payment: Dec 24, 2025

📍 COLLECTION POINT
   {agent_name}
   {agent_address}
   {agent_city}, {agent_province}
   Phone: {agent_phone}

📞 CONTACT
   Phone: {phone_number}

⚠️ IMPORTANT:
• Late payments incur $5 penalty
• Device may be locked if 7+ days overdue
• Missing 3 payments results in default

By submitting, you agree to:
📄 Loan Agreement [View]
📄 Terms & Conditions [View]
📄 Privacy Policy [View]

Everything correct?
[✅ Submit Application] [✏️ Edit Details] [❌ Cancel]
```

**State**: LOAN_APPLICATION → LOAN_REVIEW

#### **Step 4: Application Processing**

**User clicks**: [Submit Application]

```
BOT:
⏳ Processing your application...

We're checking:
✅ Credit score
✅ Payment history
✅ Device availability

This takes about 30 seconds. Please wait...
```

**Backend Process**:
1. Calculate credit score (if not recent)
2. Check device availability
3. Run fraud checks
4. Auto-approve or flag for manual review

```javascript
async function processLoanApplication(applicationData) {
  // 1. Credit scoring
  const creditScore = await scoringService.evaluate({
    customer_id: applicationData.customer_id,
    loan_amount: applicationData.principal
  });

  // 2. Auto-approval logic
  let decision = 'manual_review';

  if (creditScore.credit_score >= 700 && creditScore.confidence > 0.8) {
    decision = 'approved';
  } else if (creditScore.credit_score < 500) {
    decision = 'rejected';
  }

  // 3. Device availability
  const device = await db.devices.findOne({
    id: applicationData.device_id,
    status: 'available'
  });

  if (!device) {
    return {
      decision: 'rejected',
      reason: 'Device no longer available'
    };
  }

  // 4. Create loan record
  const loan = await db.loans.insert({
    customer_id: applicationData.customer_id,
    device_id: applicationData.device_id,
    principal: applicationData.principal,
    interest_rate: 30,
    term_months: 8,
    monthly_payment: applicationData.monthly_payment,
    total_repayment: applicationData.total_repayment,
    status: decision === 'approved' ? 'approved' : 'pending_approval',
    credit_score_at_application: creditScore.credit_score,
    auto_approved: decision === 'approved',
    submitted_at: new Date()
  });

  return { decision, loan_id: loan.id };
}
```

#### **Step 5A: Application Approved** (Success Path)

```
BOT:
🎉 CONGRATULATIONS!

Your loan has been APPROVED! ✅

📋 Loan Details:
   Loan ID: #LYN12345
   Amount: $299
   Monthly Payment: $47.81
   First Payment Due: Dec 24, 2025

📱 Your Device:
   Samsung Galaxy A14
   Ready for pickup!

🎯 Next Steps:

1️⃣ VISIT DISTRIBUTOR
   Find your nearest distributor to collect your device.
   Bring your National ID!

2️⃣ DEVICE ACTIVATION
   Distributor will activate your device and verify your identity.

3️⃣ START USING!
   Your device is unlocked and ready to use.

4️⃣ MAKE PAYMENTS
   First payment due: Dec 24, 2025
   We'll send reminders 3 days before.

[📍 Find Nearest Distributor] [📋 View Loan Agreement] [📞 Need Help?]
```

**State**: LOAN_REVIEW → IDLE

**Backend Actions**:
- Reserve device (status: available → reserved)
- Send notification to distributor
- Schedule payment reminders
- Generate loan agreement PDF

#### **Step 5B: Application Declined** (Rejection Path)

```
BOT:
❌ Application Declined

We're sorry, but we can't approve your loan application at this time.

Reason: {rejection_reason}

Common reasons:
• Insufficient credit history
• Outstanding loan balance
• Recent missed payments
• Credit score below minimum

💡 What you can do:

1️⃣ Try a Lower Amount
   Your credit limit is $200. Try devices up to $200.
   [Browse Cheaper Devices]

2️⃣ Improve Your Credit
   • Pay off any outstanding balances
   • Wait 30 days and reapply
   • Build payment history

3️⃣ Contact Support
   We can review your application manually.
   [📞 Contact Support]

[🛍️ Browse Devices ≤ ${credit_limit}] [📋 Main Menu]
```

**State**: LOAN_REVIEW → IDLE

#### **Step 5C: Manual Review Required**

```
BOT:
⏳ Manual Review Required

Your application needs additional review by our team.

This happens when:
• It's your first loan
• Credit score is borderline
• Large loan amount

⏱️ Review Time: 2-4 hours (business hours)

We'll notify you as soon as we have a decision.

📧 Track your application:
   Loan ID: #LYN12345
   Status: Pending Review

In the meantime, you can:
[📋 Check Application Status] [📞 Contact Support] [🏠 Main Menu]
```

**State**: LOAN_REVIEW → IDLE

### 5.4 Loan Application Metrics

**Track**:
- Application start rate (device view → apply)
- Application completion rate
- Auto-approval rate
- Manual review rate
- Rejection rate by reason
- Time to decision

**Target Metrics**:
- Application completion: >80%
- Auto-approval rate: >60%
- Time to decision: <2 minutes (auto), <4 hours (manual)

### 5.6 Agent Verification Process for Device Handover

**CRITICAL CONTROL MECHANISM**: This section describes how agents verify deposit payment in the system before handing over devices to customers.

#### Agent Dashboard - Loan Verification Screen

When a customer arrives to collect their device, the agent must:

**Step 1: Customer Identification**
```
Agent enters:
- Customer phone number: +263771234567
OR
- Loan ID: #LYN12345
OR
- Payment confirmation code: #LYN12345-PAID
```

**Step 2: System Verification**

Agent dashboard shows:
```
╔══════════════════════════════════════════════════════════╗
║            LOAN & DEPOSIT VERIFICATION                    ║
╠══════════════════════════════════════════════════════════╣
║ Customer: John Doe                                       ║
║ Phone: +263771234567                                     ║
║ National ID: 90-123456-A-12                              ║
║                                                          ║
║ Loan ID: #LYN12345                                       ║
║ Device: Samsung Galaxy A14 ($299)                       ║
║ Loan Status: APPROVED ✅                                  ║
║                                                          ║
║ DEPOSIT PAYMENT STATUS:                                  ║
║ ┌────────────────────────────────────────────────────┐  ║
║ │ ✅ PAID - VERIFIED                                  │  ║
║ │                                                     │  ║
║ │ Amount: $29.90 (10%)                               │  ║
║ │ Payment Method: EcoCash                            │  ║
║ │ Transaction ID: TXN123456789                       │  ║
║ │ Payment Date: Nov 26, 2025 14:30                   │  ║
║ │ Verified: Nov 26, 2025 14:31                       │  ║
║ └────────────────────────────────────────────────────┘  ║
║                                                          ║
║ 🔓 DEVICE HANDOVER: APPROVED                             ║
║                                                          ║
║ [CONFIRM HANDOVER] [VIEW LOAN DETAILS]                   ║
╚══════════════════════════════════════════════════════════╝
```

**Step 3: Verification Checklist**

Agent MUST verify:
- ✅ Deposit payment status = "PAID"
- ✅ Customer ID matches (check National ID)
- ✅ Device is in stock
- ✅ Loan status = "APPROVED"

**Step 4: Device Handover**

Only if ALL verifications pass:
1. Agent clicks [CONFIRM HANDOVER]
2. System updates loan status: `deposit_paid` → `device_collected`
3. Agent hands device to customer
4. Customer signs handover form (digital or paper)
5. System sends confirmation WhatsApp message

#### System States for Agent Verification

**Database Schema**:
```sql
CREATE TABLE loans (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  device_id UUID REFERENCES devices(id),

  -- Loan details
  principal DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL,
  deposit_percentage DECIMAL(5,2) DEFAULT 0.10,

  -- Deposit payment tracking
  deposit_paid BOOLEAN DEFAULT FALSE,
  deposit_payment_id UUID REFERENCES payments(id),
  deposit_transaction_id VARCHAR(100),
  deposit_paid_at TIMESTAMP WITH TIME ZONE,

  -- Device handover tracking
  device_collected BOOLEAN DEFAULT FALSE,
  device_collected_at TIMESTAMP WITH TIME ZONE,
  device_collected_by_agent UUID REFERENCES admin_users(id),
  handover_signature_url TEXT,

  -- Loan status
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, deposit_pending, deposit_paid, active, completed, default

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_loans_deposit_paid ON loans(deposit_paid) WHERE deposit_paid = TRUE;
CREATE INDEX idx_loans_device_collected ON loans(device_collected) WHERE device_collected = FALSE;
CREATE INDEX idx_loans_status ON loans(status);
```

#### Agent Verification API Endpoint

```typescript
// Agent Dashboard API
app.post('/api/agent/verify-loan', async (req, res) => {
  const { loan_id, agent_id } = req.body;

  // 1. Fetch loan with deposit payment info
  const { data: loan } = await supabase
    .from('loans')
    .select(`
      *,
      customer:customers(*),
      device:devices(*),
      deposit_payment:payments!deposit_payment_id(*)
    `)
    .eq('id', loan_id)
    .single();

  // 2. Verify loan eligibility for device handover
  const verification = {
    loan_approved: loan.status === 'approved' || loan.status === 'deposit_paid',
    deposit_paid: loan.deposit_paid === true,
    deposit_amount_correct: loan.deposit_payment?.amount === loan.deposit_amount,
    device_available: loan.device.status === 'reserved',
    device_not_collected: loan.device_collected === false
  };

  const can_handover = Object.values(verification).every(v => v === true);

  // 3. Return verification result
  res.json({
    loan,
    verification,
    can_handover,
    message: can_handover
      ? 'Device can be handed over to customer'
      : 'Device handover NOT approved - missing requirements'
  });
});

// Agent confirms device handover
app.post('/api/agent/confirm-handover', async (req, res) => {
  const { loan_id, agent_id, customer_signature_url } = req.body;

  // 1. Verify deposit is paid (double-check)
  const { data: loan } = await supabase
    .from('loans')
    .select('deposit_paid, device_collected')
    .eq('id', loan_id)
    .single();

  if (!loan.deposit_paid) {
    return res.status(400).json({
      error: 'Cannot handover device - deposit not paid'
    });
  }

  if (loan.device_collected) {
    return res.status(400).json({
      error: 'Device already collected'
    });
  }

  // 2. Update loan status
  await supabase
    .from('loans')
    .update({
      device_collected: true,
      device_collected_at: new Date().toISOString(),
      device_collected_by_agent: agent_id,
      handover_signature_url: customer_signature_url,
      status: 'active'
    })
    .eq('id', loan_id);

  // 3. Update device status
  await supabase
    .from('devices')
    .update({
      status: 'in_use',
      assigned_to_customer: loan.customer_id,
      assigned_at: new Date().toISOString()
    })
    .eq('id', loan.device_id);

  // 4. Send WhatsApp confirmation to customer
  await sendWhatsAppMessage(loan.customer.phone_number, {
    type: 'text',
    text: {
      body: `🎉 Device Collected!\n\nYour ${loan.device.name} has been handed over.\n\nLoan ID: #${loan.id.slice(0, 8)}\nFirst Payment Due: ${loan.first_payment_date}\n\nEnjoy your new device!`
    }
  });

  // 5. Log audit trail
  await supabase
    .from('audit_logs')
    .insert({
      action: 'device_handover',
      entity_type: 'loan',
      entity_id: loan_id,
      performed_by: agent_id,
      details: {
        customer_id: loan.customer_id,
        device_id: loan.device_id,
        deposit_verified: true
      }
    });

  res.json({
    success: true,
    message: 'Device handover confirmed',
    loan_id
  });
});
```

#### Error Scenarios

**Scenario 1: Deposit Not Paid**
```
Agent dashboard shows:
╔══════════════════════════════════════════════════════════╗
║ ❌ DEPOSIT PAYMENT: NOT PAID                              ║
║                                                          ║
║ Customer has NOT paid the required deposit.              ║
║ Device handover is NOT approved.                         ║
║                                                          ║
║ Required: $29.90                                         ║
║ Paid: $0.00                                              ║
║                                                          ║
║ Action Required:                                         ║
║ 1. Ask customer to complete deposit payment via WhatsApp║
║ 2. Wait for payment to reflect in system (~2 minutes)   ║
║ 3. Refresh this screen to verify payment                ║
║                                                          ║
║ [SEND PAYMENT REMINDER] [REFRESH STATUS]                 ║
╚══════════════════════════════════════════════════════════╝
```

**Scenario 2: Deposit Payment Pending Verification**
```
╔══════════════════════════════════════════════════════════╗
║ ⏳ DEPOSIT PAYMENT: PENDING VERIFICATION                  ║
║                                                          ║
║ Payment initiated but not yet confirmed.                 ║
║                                                          ║
║ Payment Method: EcoCash                                  ║
║ Amount: $29.90                                           ║
║ Initiated: Nov 26, 2025 14:28                           ║
║                                                          ║
║ Typical verification time: 2-5 minutes                   ║
║                                                          ║
║ [REFRESH STATUS] [CONTACT FINANCE TEAM]                  ║
╚══════════════════════════════════════════════════════════╝
```

**Scenario 3: Device Already Collected**
```
╔══════════════════════════════════════════════════════════╗
║ ⚠️ DEVICE ALREADY COLLECTED                               ║
║                                                          ║
║ This device was already handed over.                     ║
║                                                          ║
║ Collected Date: Nov 25, 2025 10:30                      ║
║ Collected By: Agent John Smith                          ║
║                                                          ║
║ If customer claims they didn't receive device,          ║
║ escalate to manager immediately.                        ║
║                                                          ║
║ [VIEW AUDIT LOG] [CONTACT MANAGER]                       ║
╚══════════════════════════════════════════════════════════╝
```

#### Security & Fraud Prevention

1. **Agent Authentication**: Agents must log in with 2FA before accessing verification screen
2. **Audit Trail**: All verification attempts and handovers are logged
3. **ID Verification**: Agent must physically verify customer National ID
4. **Geolocation**: System logs distributor location for all handovers
5. **Time Limits**: Deposit must be paid within 7 days of approval, or loan is cancelled

---

## 6. Conversation Flow 4: Payment Management

### 6.1 Flow Overview

**Goal**: Make a loan payment or check payment status
**Duration**: 2-3 minutes
**States**: IDLE → PAYMENT_MENU → PAYMENT_CONFIRM → IDLE
**Success Criteria**: Payment initiated successfully

### 6.2 Flow Diagram

```
[START: User types "pay", "payment", or clicks "Make Payment"]
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ BOT: 💰 Payment Menu                                      │
│                                                           │
│ Active Loan: #LYN12345                                   │
│ Device: Samsung Galaxy A14                               │
│                                                           │
│ 📊 Loan Summary:                                          │
│ • Total Amount: $382.50                                  │
│ • Amount Paid: $95.62 (2 payments)                       │
│ • Balance Due: $286.88                                   │
│                                                           │
│ 📅 Next Payment:                                          │
│ • Amount: $47.81                                         │
│ • Due Date: Dec 24, 2025                                 │
│ • Status: ⚠️ Due in 3 days                               │
│                                                           │
│ [💳 Make Payment] [📊 Payment History] [📋 Main Menu]    │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Make Payment]
┌──────────────────────────────────────────────────────────┐
│ BOT: How much do you want to pay?                        │
│                                                           │
│ [💵 Minimum Due: $47.81]                                 │
│ [💰 Pay Full Balance: $286.88]                           │
│ [✏️ Custom Amount]                                       │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Minimum Due]
┌──────────────────────────────────────────────────────────┐
│ BOT: Payment Method                                      │
│                                                           │
│ How do you want to pay $47.81?                           │
│                                                           │
│ [📱 EcoCash] [💳 EcoCash/Omari/Innbucks/OneWallet] [🏦 Bank Transfer]              │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [EcoCash]
┌──────────────────────────────────────────────────────────┐
│ BOT: 📱 EcoCash Payment                                   │
│                                                           │
│ Amount: $47.81                                           │
│ Phone: +263771234567                                     │
│                                                           │
│ Confirm payment?                                         │
│ [✅ Confirm] [❌ Cancel]                                  │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Confirm]
┌──────────────────────────────────────────────────────────┐
│ BOT: ⏳ Processing payment...                             │
│                                                           │
│ You'll receive a prompt on your phone.                   │
│ Please approve the transaction.                          │
└──────────────────────────────────────────────────────────┘
         │
         ▼ [Payment successful]
┌──────────────────────────────────────────────────────────┐
│ BOT: ✅ Payment Successful!                               │
│                                                           │
│ Receipt: #PAY67890                                       │
│ Amount: $47.81                                           │
│ Method: EcoCash                                          │
│ Date: Nov 24, 2025 14:32                                │
│                                                           │
│ 📊 Updated Loan Balance:                                 │
│ • Paid: $143.43 (3 payments)                             │
│ • Remaining: $239.07                                     │
│ • Next Payment: $47.81 on Jan 24, 2026                  │
│                                                           │
│ [📧 Email Receipt] [📋 Main Menu]                        │
└──────────────────────────────────────────────────────────┘
```

### 6.3 Detailed Conversation Script

#### **Step 1: Payment Menu Entry**

**Trigger**: User types "pay", "payment", "make payment" or clicks [Make Payment]

**Pre-Check**: Verify active loan exists
```javascript
const activeLoans = await db.loans.find({
  customer_id: customerId,
  status: 'active'
});

if (activeLoans.length === 0) {
  return sendMessage("You don't have any active loans. [Browse Devices] to get started!");
}
```

**For single active loan**:
```
BOT:
💰 Payment Center

Active Loan: #LYN12345
Device: Samsung Galaxy A14

📊 Loan Summary:
• Original Amount: $382.50
• Amount Paid: $95.62 (2 of 8 payments)
• Balance Remaining: $286.88
• Paid On Time: ✅ 100%

📅 Next Payment:
• Amount Due: $47.81
• Due Date: Dec 24, 2025
• Status: ⚠️ Due in 3 days

📈 Progress: ▓▓▓░░░░░ 25% complete

What would you like to do?
[💳 Make Payment] [📊 Payment History] [📄 View Loan Details]
```

**For multiple active loans** (credit tier 2+):
```
BOT:
💰 Payment Center

You have 2 active loans:

1️⃣ Loan #LYN12345 (Samsung Galaxy A14)
   • Balance: $286.88
   • Next Payment: $47.81 (due in 3 days)

2️⃣ Loan #LYN12346 (Tecno Spark 10)
   • Balance: $156.24
   • Next Payment: $31.25 (due in 10 days)

Which loan do you want to pay?
[1] [2] [Pay All] [View Details]
```

**State**: IDLE → PAYMENT_MENU

#### **Step 2: Select Payment Amount**

```
BOT:
How much do you want to pay?

Loan: #LYN12345
Balance: $286.88

Payment Options:
[💵 Minimum Due: $47.81] - Keeps you on track
[💰 Full Balance: $286.88] - Pay off loan early (save $35.88 interest!)
[✏️ Custom Amount]

💡 Tip: Paying early saves you money on interest!
```

**If user selects**: [Custom Amount]
```
BOT:
Enter the amount you want to pay.

Minimum: $47.81 (monthly payment)
Maximum: $286.88 (full balance)

Type the amount in dollars (e.g., 50 or 100)
```

**Validation**:
```javascript
function validatePaymentAmount(amount, minDue, balance) {
  if (amount < minDue) {
    return {
      valid: false,
      message: `Minimum payment is $${minDue}. Please enter at least this amount.`
    };
  }

  if (amount > balance) {
    return {
      valid: false,
      message: `You can't pay more than your balance ($${balance}). Please enter a lower amount.`
    };
  }

  return { valid: true };
}
```

#### **Step 3: Select Payment Method**

```
BOT:
💳 Payment Method

You're paying: $47.81

How do you want to pay?

📱 EcoCash
   • Instant confirmation
   • Charged to +263771234567
   [Pay with EcoCash]

💳 EcoCash/Omari/Innbucks/OneWallet
   • Instant confirmation
   • All banks supported
   [Pay with EcoCash/Omari/Innbucks/OneWallet]

🏦 Bank Transfer
   • Manual verification (1-2 hours)
   • Details provided after selection
   [Bank Transfer Details]

All methods are secure and encrypted. 🔒
```

#### **Step 4A: EcoCash Payment Flow**

**User selects**: [Pay with EcoCash]

```
BOT:
📱 EcoCash Payment

Amount: $47.81
Phone: +263771234567

You'll receive an EcoCash USSD prompt on your phone shortly.

Please:
1️⃣ Enter your EcoCash PIN
2️⃣ Confirm the transaction
3️⃣ Wait for SMS confirmation

Ready to proceed?
[✅ Send Payment Request] [❌ Cancel]
```

**User clicks**: [Send Payment Request]

**Backend Process**:
```javascript
async function initiateEcoCashPayment(paymentData) {
  // 1. Create payment record
  const payment = await db.payments.insert({
    loan_id: paymentData.loan_id,
    amount: paymentData.amount,
    payment_method: 'ecocash',
    phone_number: paymentData.phone_number,
    status: 'pending',
    created_at: new Date()
  });

  // 2. Call EcoCash API
  const ecoCashResponse = await ecoCashAPI.initiatePayment({
    amount: paymentData.amount,
    phone: paymentData.phone_number,
    reference: payment.id,
    merchant_id: process.env.ECOCASH_MERCHANT_ID
  });

  // 3. Update payment with provider reference
  await db.payments.update(
    { id: payment.id },
    {
      provider_reference: ecoCashResponse.transaction_id,
      provider_status: 'initiated'
    }
  );

  return { payment_id: payment.id, status: 'initiated' };
}
```

**Waiting for confirmation**:
```
BOT:
⏳ Waiting for payment confirmation...

Please check your phone for the EcoCash prompt.

📱 Dial *151# if you don't receive the prompt.

This usually takes 10-30 seconds.

[❌ Cancel Payment]
```

**After 30 seconds, if no webhook received**:
```
BOT:
⏳ Still waiting for confirmation...

Taking longer than usual. This can happen if:
• Network delay
• You haven't approved the payment yet
• EcoCash service is slow

We'll keep checking for 5 minutes. You can:
[✅ I've Approved It] [❌ Cancel & Retry] [📞 Contact Support]
```

**Step 4B: Payment Success**

**Trigger**: EcoCash webhook confirms payment

```
BOT:
✅ PAYMENT SUCCESSFUL!

Receipt Details:
━━━━━━━━━━━━━━━━
📋 Receipt: #PAY67890
💵 Amount Paid: $47.81
📱 Method: EcoCash (+2637712***67)
📅 Date: Nov 24, 2025 14:32:15
🔖 EcoCash Ref: ECO123456789
━━━━━━━━━━━━━━━━

📊 Updated Loan Status:
Loan: #LYN12345 (Samsung Galaxy A14)
• Total Paid: $143.43 (3 of 8 payments)
• Balance: $239.07
• Next Payment: $47.81 on Jan 24, 2026
• Payments On Time: ✅ 100%

Progress: ▓▓▓▓░░░░ 38% complete

Thank you for your payment! 🎉

[📧 Email Receipt] [📊 View Payment History] [🏠 Main Menu]
```

**State**: PAYMENT_CONFIRM → IDLE

**Backend Actions**:
```javascript
async function processSuccessfulPayment(paymentId) {
  const payment = await db.payments.findOne({ id: paymentId });
  const loan = await db.loans.findOne({ id: payment.loan_id });

  // 1. Update payment status
  await db.payments.update(
    { id: paymentId },
    {
      status: 'completed',
      completed_at: new Date()
    }
  );

  // 2. Update loan balance
  const newTotalPaid = loan.total_paid + payment.amount;
  const newOutstandingPrincipal = loan.outstanding_principal - payment.amount;

  await db.loans.update(
    { id: loan.id },
    {
      total_paid: newTotalPaid,
      outstanding_principal: newOutstandingPrincipal,
      last_payment_date: new Date(),
      next_payment_date: calculateNextPaymentDate(loan.next_payment_date),
      days_overdue: 0,
      updated_at: new Date()
    }
  );

  // 3. If device was locked, unlock it
  if (loan.device_locked) {
    await deviceLockService.unlockDevice({
      imei: loan.device_imei,
      reason: 'payment_received'
    });

    await db.loans.update(
      { id: loan.id },
      { device_locked: false, device_unlocked_at: new Date() }
    );
  }

  // 4. Update customer credit
  await db.customers.increment(
    { id: loan.customer_id },
    {
      total_repaid: payment.amount,
      credit_score: 5 // +5 points for on-time payment
    }
  );

  // 5. Send receipt via email
  await emailService.sendReceipt({
    customer_id: loan.customer_id,
    payment_id: paymentId
  });

  // 6. Check if loan is paid off
  if (newOutstandingPrincipal <= 0) {
    await completeLoan(loan.id);
  }
}
```

**Step 4C: Payment Failed**

```
BOT:
❌ Payment Failed

Your payment could not be processed.

Reason: {failure_reason}

Common reasons:
• Insufficient EcoCash balance
• Transaction cancelled
• Network timeout
• Daily limit exceeded

What would you like to do?
[🔄 Try Again] [💳 Different Payment Method] [📞 Contact Support]
```

#### **Step 5: Payment History**

**User clicks**: [Payment History]

```
BOT:
📊 Payment History

Loan: #LYN12345 (Samsung Galaxy A14)

Recent Payments:
━━━━━━━━━━━━━━━━
1️⃣ Nov 24, 2025 - $47.81 ✅
   EcoCash | Receipt: #PAY67890

2️⃣ Oct 24, 2025 - $47.81 ✅
   EcoCash | Receipt: #PAY67889

3️⃣ Sep 24, 2025 - $47.81 ✅ (First payment)
   EcoCash/Omari/Innbucks/OneWallet | Receipt: #PAY67888
━━━━━━━━━━━━━━━━

📈 Payment Stats:
• Total Payments: 3
• On-Time Payments: 3 (100%)
• Late Payments: 0
• Penalties Paid: $0

Upcoming Payments:
━━━━━━━━━━━━━━━━
• Dec 24, 2025: $47.81 (in 30 days)
• Jan 24, 2026: $47.81 (in 61 days)
• Feb 24, 2026: $47.81 (in 92 days)
... and 2 more

[📧 Email Full Statement] [💳 Make Payment] [🏠 Main Menu]
```

### 6.4 Payment Reminders (Proactive Messages)

**3 days before due date**:
```
BOT:
⏰ Payment Reminder

Your loan payment is due soon!

Loan: #LYN12345 (Samsung Galaxy A14)
Amount Due: $47.81
Due Date: Dec 24, 2025 (in 3 days)

💡 Pay early to avoid late fees ($5/day after due date)

[💳 Pay Now] [⏰ Remind Me Tomorrow] [📋 View Details]
```

**On due date**:
```
BOT:
🔔 Payment Due Today

Your payment of $47.81 is due today (Dec 24, 2025).

Loan: #LYN12345

⚠️ Late fee starts tomorrow: $5/day

[💳 Pay Now] [📞 Having Trouble? Contact Us]
```

**1 day overdue**:
```
BOT:
⚠️ Payment Overdue

Your payment is now 1 day late.

Loan: #LYN12345
Amount Due: $47.81
Late Fee: $5 (added to next payment)

Please pay as soon as possible to avoid:
• Device lock (at 7 days overdue)
• Credit score impact
• Additional late fees

[💳 Pay Now] [💬 Need Help? Chat with us]
```

**7 days overdue** (device lock warning):
```
BOT:
🚨 URGENT: Device Lock Warning

Your payment is 7 days late.

Loan: #LYN12345
Amount Due: $52.81 (includes $5 late fee)

⚠️ Your device will be locked in 24 hours if payment is not received.

Locked device means:
• Can only make emergency calls
• No apps, browsing, or messaging
• Unlocks immediately after payment

[💳 Pay Now to Avoid Lock] [📞 Emergency? Contact Support]
```

### 6.5 Alternative Payment Methods

#### **EcoCash/Omari/Innbucks/OneWallet**

```
BOT:
💳 EcoCash/Omari/Innbucks/OneWallet Payment

Amount: $47.81
Merchant: Lynia Finance

You'll be redirected to your bank's app to complete payment.

[✅ Open EcoCash/Omari/Innbucks/OneWallet] [❌ Cancel]
```

**After opening EcoCash/Omari/Innbucks/OneWallet**:
```
BOT:
⏳ Waiting for payment confirmation...

Complete the payment in your banking app, then return here.

We'll notify you as soon as payment is confirmed (usually instant).

[✅ I've Completed Payment] [❌ Cancel]
```

#### **Bank Transfer**

```
BOT:
🏦 Bank Transfer

Amount: $47.81

Bank Details:
━━━━━━━━━━━━━━━━
Bank: ZB Bank
Account Name: Lynia Finance (Pvt) Ltd
Account Number: 1234567890
Branch: Harare Main
Reference: LYN12345
━━━━━━━━━━━━━━━━

⚠️ IMPORTANT:
• Use your Loan ID (LYN12345) as reference
• Payment verification takes 1-2 hours

After making the transfer:
[✅ I've Made the Transfer] [📧 Email Proof of Payment]

We'll confirm your payment and update your balance.
```

### 6.6 Early Loan Payoff

**User wants to pay full balance**:

```
BOT:
💰 Pay Off Loan Early

Great choice! Paying early saves you money on interest.

Loan: #LYN12345
━━━━━━━━━━━━━━━━
Original Total: $382.50
Amount Paid: $143.43
Full Balance: $239.07

If you pay early:
✅ Save $35.88 in future interest!
✅ Improve credit score faster
✅ Qualify for bigger loans sooner
✅ Device ownership immediately

Pay full balance now?
[💰 Pay $239.07] [❌ Cancel]
```

**After payoff**:
```
BOT:
🎉 LOAN PAID OFF!

Congratulations! You've successfully paid off your loan.

Loan: #LYN12345 (Samsung Galaxy A14)
━━━━━━━━━━━━━━━━
Total Paid: $382.50
Paid in: 4 months (saved 4 months!)
Interest Saved: $35.88
Final Credit Score: 780 (+60 points!)
━━━━━━━━━━━━━━━━

✅ Your device is now fully yours!
✅ Device lock permanently disabled
✅ Credit limit increased: $200 → $350

🎁 You now qualify for:
• Larger loans (up to $500)
• Better devices
• Improved loan terms

[🛍️ Browse Devices] [📊 View Credit Profile] [🏠 Main Menu]
```

### 6.7 Payment Metrics

**Track**:
- On-time payment rate
- Late payment rate (1-7 days, 7-30 days, 30+ days)
- Payment method preferences
- Early payoff rate
- Average payment time (from reminder to payment)

**Target Metrics**:
- On-time payment rate: >90%
- Payment completion time: <5 minutes
- Payment success rate: >95%

---

*[Continuing in next section due to length...]*

## 7. Conversation Flow 5: Customer Support

### 7.1 Flow Overview

**Goal**: Resolve customer issues and questions
**Duration**: 2-10 minutes (varies by issue)
**States**: IDLE → SUPPORT → SUPPORT_RESOLVED → IDLE
**Success Criteria**: Issue resolved or escalated to human agent

### 7.2 Support Menu

**Trigger**: User types "help", "support", "issue", "problem"

```
BOT:
📞 Customer Support

How can we help you today?

Common Issues:
1️⃣ Payment Issues
   • Payment not reflecting
   • Wrong amount charged
   • Payment method problems

2️⃣ Device Issues
   • Device locked
   • Device not working
   • Warranty claim

3️⃣ Account Issues
   • Forgot password
   • Update phone number
   • Account locked

4️⃣ Loan Questions
   • Loan status
   • Payment schedule
   • Early payoff

5️⃣ General Questions
   • How it works
   • Eligibility
   • Pricing

[Select an option 1-5] or type your question
```

### 7.3 FAQ Auto-Responses

**Common Questions**:

**Q: "How does Lynia Finance work?"**
```
BOT:
📱 How Lynia Finance Works

1️⃣ VERIFY IDENTITY (10 min)
   Upload ID and selfie for verification

2️⃣ BROWSE DEVICES (5 min)
   Choose from 50+ smartphones ($200-$500)

3️⃣ APPLY FOR LOAN (3 min)
   Get instant approval decision

4️⃣ COLLECT DEVICE (same day)
   Visit nearest distributor with your ID

5️⃣ MAKE PAYMENTS (8 months)
   Pay monthly via EcoCash/EcoCash/Omari/Innbucks/OneWallet

🎉 Device is yours after final payment!

[📝 Apply Now] [💬 More Questions?]
```

**Q: "Why is my device locked?"**
```
BOT:
🔒 Device Lock Explanation

Your device was locked because:
• Payment is 7+ days overdue

Current Status:
• Loan: #LYN12345
• Days Overdue: 8 days
• Amount Due: $52.81 (includes $5 late fee)

🔓 To unlock your device:
1. Make your payment now
2. Device unlocks within 30 minutes
3. All features restored

While locked:
✅ Emergency calls (911, 112)
❌ Apps, browsing, messaging

[💳 Pay Now to Unlock] [💬 Need Payment Help?]
```

### 7.4 Human Agent Escalation

**Trigger**: Customer requests human agent or bot can't resolve issue

```
BOT:
👤 Connect to Agent

I'll connect you with a human support agent.

Support Hours:
• Mon-Fri: 8AM - 6PM
• Sat: 9AM - 1PM
• Sun: Closed

Current time: 2:30 PM (Monday)
Status: ✅ Agents available

Estimated wait: 2-5 minutes

Your issue: {issue_summary}

[✅ Connect Me] [❌ Cancel]
```

**After connecting**:
```
BOT:
⏳ Connecting you to an agent...

Please hold...

While you wait:
• Have your Loan ID ready (#LYN12345)
• Prepare any screenshots
• Write down your question

[Connecting... 🔄]
```

**When agent joins**:
```
AGENT:
👋 Hi! I'm Sarah from Lynia Finance support.

I can see you're having an issue with: {issue}

Loan ID: #LYN12345
Account: John Doe (+263771234567)

How can I help you today?
```

### 7.5 Support Metrics

**Track**:
- Issue resolution rate (bot vs human)
- Average resolution time
- Customer satisfaction (CSAT) score
- Most common issues
- Escalation rate

**Target Metrics**:
- Bot resolution rate: >60%
- Average resolution time: <5 minutes (bot), <10 minutes (human)
- CSAT score: >4.5/5

---

## 8. Conversation Flow 6: Account Management

### 8.1 Account Menu

**Trigger**: User types "account", "profile", "settings"

```
BOT:
👤 Account Settings

Name: John Doe
Phone: +263771234567
National ID: 63-123***-A-**

📊 Credit Profile:
• Credit Limit: $350
• Available: $51
• Credit Score: 780
• Credit Tier: 2

📱 Active Loans: 1
• Loan #LYN12345 (Samsung Galaxy A14)

What would you like to do?
[📋 View Profile] [🔐 Security] [⚙️ Preferences] [📧 Contact Info]
```

### 8.2 Update Contact Information

```
BOT:
📧 Update Contact Info

Current Information:
• Phone: +263771234567
• Email: john.doe@example.com
• Address: 123 Main St, Harare

What do you want to update?
[📞 Phone Number] [📧 Email] [📍 Address]
```

**Security verification required**:
```
BOT:
🔐 Verify Your Identity

For security, please verify it's you.

I'll send a code to your current phone (+2637712***67).

[✅ Send Code] [❌ Cancel]
```

---

## 9. Error Handling & Recovery

### 9.1 Common Error Scenarios

#### **Network Timeout**
```
BOT:
⚠️ Connection Issue

I'm having trouble connecting to our servers.

This is usually temporary. Please:
1️⃣ Check your internet connection
2️⃣ Try again in a few seconds

[🔄 Retry] [📋 Main Menu]
```

#### **Invalid Input**
```
BOT:
❌ I didn't understand that.

Please:
• Use the buttons provided
• Type "menu" for options
• Type "help" for support

[📋 Main Menu] [📞 Support]
```

#### **Session Expired**
```
BOT:
⏱️ Session Expired

Your session has expired due to inactivity (30 minutes).

For security, please start over.

[🔄 Restart] [📋 Main Menu]
```

#### **Service Unavailable**
```
BOT:
🚧 Service Temporarily Unavailable

We're experiencing technical difficulties.

Our team is working on it. Please try again in a few minutes.

Estimated fix time: 15 minutes
Status: https://status.lyniafinance.com

[🔄 Try Again] [📞 Contact Support]
```

### 9.2 Graceful Degradation

**When DIDIT API is down**:
```
BOT:
⚠️ KYC Verification Delayed

Our identity verification partner is temporarily unavailable.

You can:
1️⃣ Submit your documents now (we'll process when system is back)
2️⃣ Wait and try later

Your application will be prioritized when service resumes.

[📸 Submit Now] [⏰ Try Later]
```

### 9.3 Error Recovery

**Preserve user context on error**:
```javascript
async function handleError(error, session) {
  // Log error
  await db.error_logs.insert({
    session_id: session.id,
    error_code: error.code,
    error_message: error.message,
    state: session.current_state,
    context: session.context,
    timestamp: new Date()
  });

  // Send user-friendly message
  await sendMessage(session.phone_number, {
    text: `Something went wrong. Don't worry, your progress is saved.\n\n[🔄 Continue where you left off] [📋 Main Menu]`
  });

  // Don't reset state - let user resume
}
```

---

## 10. Fallback Scenarios

### 10.1 Unrecognized Intent

**User sends**: "banana"

```
BOT:
🤔 I didn't understand that.

I can help you with:
• 📱 Browse devices
• 💰 Make a payment
• 📊 Check loan status
• 📞 Customer support

[📋 Main Menu] or type what you need help with.
```

### 10.2 Out of Scope

**User asks**: "What's the weather today?"

```
BOT:
I'm specialized in helping with device financing. I can't help with weather info.

I can help you with:
• Device loans and payments
• Account management
• Customer support

[📋 What can you do?] [🏠 Main Menu]
```

### 10.3 Always-Available Commands

**Global Commands** (work in any state):
- "menu" → Return to main menu
- "cancel" → Cancel current operation
- "help" → Show help
- "support" → Contact support
- "status" → Check loan/application status

---

## 11. Message Templates

### 11.1 Approved WhatsApp Templates

**Template**: payment_reminder
```
🔔 Payment Reminder

Hi {{customer_name}},

Your loan payment of ${{amount}} is due on {{due_date}}.

Loan: {{loan_id}}
Device: {{device_name}}

Pay now: {{payment_link}}

Reply HELP for assistance.
```

**Template**: payment_received
```
✅ Payment Received

Hi {{customer_name}},

We've received your payment of ${{amount}}.

Receipt: {{receipt_id}}
Balance: ${{remaining_balance}}

Thank you!
```

**Template**: device_locked
```
🔒 Device Locked

Hi {{customer_name}},

Your device has been locked due to non-payment.

Amount overdue: ${{amount}}
Days late: {{days_late}}

Pay now to unlock: {{payment_link}}

Need help? Reply SUPPORT
```

### 11.2 Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{customer_name}}` | Customer first name | John |
| `{{phone_number}}` | Customer phone | +263771234567 |
| `{{loan_id}}` | Loan reference | #LYN12345 |
| `{{device_name}}` | Device model | Samsung Galaxy A14 |
| `{{amount}}` | Payment amount | $47.81 |
| `{{due_date}}` | Payment due date | Dec 24, 2025 |
| `{{balance}}` | Remaining balance | $286.88 |
| `{{payment_link}}` | Payment URL | https://pay.lyniafinance.com/... |

---

## 12. Session Management

### 12.1 Session Lifecycle

```javascript
// Create session
async function createSession(phoneNumber) {
  const session = await db.whatsapp_sessions.insert({
    phone_number: phoneNumber,
    current_state: 'IDLE',
    context: {},
    language: 'en',
    expires_at: new Date(Date.now() + 30 * 60 * 1000) // 30 min
  });

  return session;
}

// Update session
async function updateSession(sessionId, updates) {
  await db.whatsapp_sessions.update(
    { id: sessionId },
    {
      ...updates,
      last_interaction_at: new Date(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // Reset timer
      updated_at: new Date()
    }
  );
}

// Cleanup expired sessions (cron job)
async function cleanupExpiredSessions() {
  await db.whatsapp_sessions.delete({
    expires_at: { $lt: new Date() },
    current_state: 'IDLE'
  });
}
```

### 12.2 Context Preservation

**Save context at each step**:
```javascript
async function saveProgress(sessionId, step, data) {
  const session = await db.whatsapp_sessions.findOne({ id: sessionId });

  const newContext = {
    ...session.context,
    [step]: {
      ...data,
      saved_at: new Date(),
      step_number: session.context[step]?.step_number + 1 || 1
    }
  };

  await updateSession(sessionId, { context: newContext });
}
```

**Resume from saved context**:
```javascript
async function resumeSession(phoneNumber) {
  const session = await db.whatsapp_sessions.findOne({
    phone_number: phoneNumber,
    current_state: { $ne: 'IDLE' },
    expires_at: { $gt: new Date() }
  });

  if (!session) {
    return null; // No active session
  }

  // Send resume message
  await sendMessage(phoneNumber, {
    text: `Welcome back! You were in the middle of: ${getStateName(session.current_state)}\n\n[✅ Continue] [❌ Start Over]`
  });

  return session;
}
```

---

## 13. Analytics & Tracking

### 13.1 Conversation Metrics

**Track for each flow**:
- Start rate (users who enter flow)
- Completion rate (users who finish flow)
- Drop-off rate by step
- Average duration
- Error rate
- Retry rate

**Implementation**:
```javascript
async function trackConversationEvent(event) {
  await db.analytics_events.insert({
    session_id: event.session_id,
    customer_id: event.customer_id,
    event_type: event.type, // 'flow_start', 'flow_complete', 'step_complete', 'error'
    flow_name: event.flow_name, // 'onboarding', 'browsing', 'loan_application'
    step_name: event.step_name,
    duration_ms: event.duration_ms,
    metadata: event.metadata,
    timestamp: new Date()
  });
}

// Example usage
await trackConversationEvent({
  session_id: 'uuid',
  customer_id: 'uuid',
  type: 'flow_start',
  flow_name: 'loan_application',
  step_name: null,
  duration_ms: null,
  metadata: { device_id: 'uuid' }
});
```

### 13.2 User Behavior Analysis

**Funnel Analysis**:
```sql
-- Onboarding funnel
SELECT
  COUNT(DISTINCT CASE WHEN event_type = 'flow_start' AND flow_name = 'onboarding' THEN session_id END) AS started,
  COUNT(DISTINCT CASE WHEN step_name = 'national_id_captured' THEN session_id END) AS id_captured,
  COUNT(DISTINCT CASE WHEN step_name = 'photos_uploaded' THEN session_id END) AS photos_uploaded,
  COUNT(DISTINCT CASE WHEN step_name = 'kyc_submitted' THEN session_id END) AS kyc_submitted,
  COUNT(DISTINCT CASE WHEN event_type = 'flow_complete' AND flow_name = 'onboarding' THEN session_id END) AS completed
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '30 days';
```

### 13.3 A/B Testing

**Test message variations**:
```javascript
// Test different welcome messages
async function sendWelcomeMessage(phoneNumber) {
  const variant = Math.random() < 0.5 ? 'A' : 'B';

  const messages = {
    A: "👋 Welcome to Lynia Finance! Get a smartphone on credit today.",
    B: "📱 Get your dream smartphone now, pay over 8 months!"
  };

  await sendMessage(phoneNumber, { text: messages[variant] });

  // Track variant
  await db.analytics_events.insert({
    phone_number: phoneNumber,
    event_type: 'ab_test',
    test_name: 'welcome_message',
    variant: variant,
    timestamp: new Date()
  });
}
```

---

## 14. Implementation Checklist

### Phase 1: Core Flows (Weeks 1-2)
- [ ] State machine architecture
- [ ] Session management (create, update, cleanup)
- [ ] Onboarding & KYC flow
- [ ] Device browsing flow
- [ ] Loan application flow
- [ ] Message templates (approved by WhatsApp)

### Phase 2: Payment & Support (Weeks 3-4)
- [ ] Payment flow (EcoCash, EcoCash/Omari/Innbucks/OneWallet)
- [ ] Payment reminders (templates)
- [ ] Customer support flow
- [ ] FAQ auto-responses
- [ ] Human agent escalation

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] Account management
- [ ] Device comparison
- [ ] Personalized recommendations
- [ ] A/B testing framework
- [ ] Analytics dashboard

### Phase 4: Testing & Optimization (Weeks 7-8)
- [ ] End-to-end testing
- [ ] Error handling testing
- [ ] Load testing (1000 concurrent users)
- [ ] Message template approval (Meta)
- [ ] Conversation optimization based on metrics

---

## 15. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-24 | Product & Engineering Team | Initial conversation flows |

**Review Schedule**: Bi-weekly (every 2 weeks)
**Next Review**: 2025-12-08
**Owner**: Product Manager
**Approvers**: CTO, Head of Customer Experience

---

**End of Document**
