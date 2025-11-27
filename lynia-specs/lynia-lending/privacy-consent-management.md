# P1-T031: Privacy & Consent Management

**Task ID:** P1-T031
**Section:** 1.5 KYC & Onboarding Design
**Priority:** High
**Estimated Duration:** 4 hours
**Dependencies:** P1-T027, P1-T006
**Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Consent Collection Flow](#consent-collection-flow)
3. [Terms and Conditions](#terms-and-conditions)
4. [Privacy Policy](#privacy-policy)
5. [Data Sharing Permissions](#data-sharing-permissions)
6. [Consent Revocation Process](#consent-revocation-process)
7. [GDPR Compliance](#gdpr-compliance)
8. [Implementation](#implementation)

---

## 1. Overview

Privacy and consent management ensures Lynia Finance complies with Zimbabwe's Data Protection Act (2021) and international standards (GDPR). This document defines how we collect, store, and manage customer consent.

### Legal Requirements

**Zimbabwe Data Protection Act (2021):**
- ✅ Explicit consent before processing personal data
- ✅ Right to access personal data
- ✅ Right to rectification (correction)
- ✅ Right to erasure ("right to be forgotten")
- ✅ Data portability

**GDPR Considerations:**
- Required if we have EU investors or customers
- Higher standard than Zimbabwe law
- Requires active consent (not pre-checked boxes)

---

## 2. Consent Collection Flow

### 2.1 Consent Types

```typescript
type ConsentType =
  | 'terms_and_conditions'      // Loan agreement terms
  | 'privacy_policy'            // Data processing consent
  | 'kyc_data_collection'       // ID & biometric data
  | 'credit_check'              // Credit scoring consent
  | 'marketing_communications'  // WhatsApp/SMS marketing
  | 'data_sharing_smile'        // Share data with Smile Identity
  | 'data_sharing_payment'      // Share data with payment gateways
  | 'device_lock_authorization' // Consent to remote device lock;

interface Consent {
  customer_id: string;
  consent_type: ConsentType;
  consent_version: string;        // e.g., "1.0", "2.1"
  consent_text: string;           // Full text shown to user

  // Consent status
  consented: boolean;
  consented_at: Date | null;

  // Tracking
  ip_address: string;
  user_agent: string;
  consent_method: 'whatsapp' | 'web' | 'distributor';

  // Revocation
  revoked: boolean;
  revoked_at: Date | null;
  revoked_reason: string | null;
}
```

---

### 2.2 Onboarding Consent Flow

**Step 1: Initial Consent (Before KYC)**

```
📄 *Welcome to Lynia Finance!*

Before we begin, please review and accept:

1️⃣ Privacy Policy
   How we handle your personal data

2️⃣ Terms & Conditions
   Your rights and obligations

3️⃣ KYC Data Collection
   We'll collect your National ID and selfie

[View Privacy Policy]
[View Terms & Conditions]

Do you accept these terms?

[Yes, I accept] [No, thanks]
```

**Step 2: Specific Consents (During Onboarding)**

```
🔒 *Data Sharing Consent*

To verify your identity, we'll share your:
✓ National ID number
✓ Selfie photo

With our verification partner:
Smile Identity

This is required for loan approval.

[I consent] [Learn more]
```

**Step 3: Device Lock Consent (Before Loan Disbursement)**

```
📱 *Device Lock Authorization*

By accepting this loan, you agree:

✓ Device may be remotely locked if payment is 7+ days late
✓ Device unlocks automatically when you pay
✓ This protects both you and Lynia

[I understand and consent] [View details]
```

**Step 4: Marketing Consent (Optional)**

```
📩 *Stay Updated (Optional)*

Would you like to receive:
✓ New device offers
✓ Special promotions
✓ Payment reminders

You can opt out anytime.

[Yes, send me updates] [No thanks]
```

---

## 3. Terms and Conditions

### 3.1 Loan Agreement Terms

**Required Clauses:**

1. **Loan Amount & Duration**
   - Principal amount
   - Interest rate (monthly)
   - Repayment schedule
   - Total amount payable

2. **Device Ownership**
   - Device remains Lynia property until fully paid
   - Customer has right to use
   - Transfer of ownership upon final payment

3. **Payment Terms**
   - Due dates (monthly)
   - Payment methods (EcoCash, Omari, Innbucks, OneWallet)
   - Late payment fees
   - Grace period (7 days)

4. **Device Lock Policy**
   - Triggers: 7+ days overdue
   - Unlock: Immediate upon payment
   - Emergency unlock: Contact support

5. **Early Repayment**
   - Allowed anytime
   - No early repayment penalties
   - Interest recalculated

6. **Default & Repossession**
   - 90+ days overdue triggers repossession
   - Legal process followed
   - Outstanding balance remains due

7. **Dispute Resolution**
   - Contact support first
   - Escalation to management
   - Arbitration (if needed)

---

### 3.2 Terms Display Format

**WhatsApp Version (Summary):**

```
📄 *Loan Terms Summary*

Amount: $180
Interest: 20% (6 months)
Total repayment: $216
Monthly payment: $36

Key points:
✓ Device locked if 7+ days late
✓ No early payment fees
✓ 90+ days = repossession

[View full terms] [I accept]
```

**Full Terms (Web Link):**

Provide link to full legal document:
`https://lyniafinance.co.zw/terms-v1.0`

---

## 4. Privacy Policy

### 4.1 Data Collection Disclosure

**What We Collect:**

```
🔍 *What Data We Collect*

Personal Information:
✓ Full name
✓ National ID number
✓ Date of birth
✓ Phone number
✓ Address

Biometric Data:
✓ Facial image (selfie)
✓ ID document photo

Financial Data:
✓ Loan amount & payments
✓ Payment history
✓ Credit score

Device Data:
✓ Device IMEI
✓ Device model
✓ Lock/unlock status
```

---

### 4.2 Data Usage Disclosure

**How We Use Your Data:**

```
💼 *How We Use Your Data*

We use your information to:
✓ Verify your identity (KYC)
✓ Assess creditworthiness
✓ Process loan applications
✓ Manage device locks
✓ Send payment reminders
✓ Improve our services

We DO NOT:
❌ Sell your data to third parties
❌ Use data for unrelated purposes
❌ Share data without consent
```

---

### 4.3 Data Sharing Disclosure

**Third-Party Data Sharing:**

```
🤝 *Who We Share Data With*

Verification Partner:
• Smile Identity (KYC verification)
• Data shared: ID number, photos

Payment Partners:
• EcoCash, Omari, Innbucks, OneWallet
• Data shared: Phone number, payment amounts

Device Lock Provider:
• [TBD - Device lock API provider]
• Data shared: Device IMEI, lock status

We NEVER share data with:
❌ Marketing companies
❌ Data brokers
❌ Unrelated third parties
```

---

### 4.4 Data Retention

**How Long We Keep Your Data:**

```
📅 *Data Retention*

While you're a customer:
• All data kept for service delivery

After loan fully paid:
• Kept for 7 years (legal requirement)
• Used only for compliance & disputes

You can request deletion:
• After 7-year retention period
• Or if no active/past loans
```

---

### 4.5 Customer Data Rights

**Your Rights:**

```
⚖️ *Your Data Rights*

You have the right to:

1️⃣ Access
   Request a copy of your data

2️⃣ Correction
   Fix inaccurate information

3️⃣ Deletion
   Request data removal (after retention period)

4️⃣ Portability
   Get your data in machine-readable format

5️⃣ Withdrawal
   Revoke consent (may affect service)

Contact: privacy@lyniafinance.co.zw
```

---

## 5. Data Sharing Permissions

### 5.1 Granular Consent

```typescript
interface DataSharingConsent {
  customer_id: string;

  // Required consents (cannot proceed without these)
  consent_kyc_verification: boolean;        // Smile Identity
  consent_payment_processing: boolean;      // Payment gateways
  consent_device_lock: boolean;             // Device lock provider

  // Optional consents
  consent_marketing: boolean;               // Marketing messages
  consent_analytics: boolean;               // Usage analytics
  consent_product_improvements: boolean;    // Product feedback

  // Metadata
  consented_at: Date;
  ip_address: string;
}
```

---

### 5.2 Consent Request Messages

**KYC Verification Consent:**

```
🔐 *Identity Verification*

To verify your identity, we'll share:
• National ID number
• Selfie photo
• Full name

With: Smile Identity
Purpose: Prevent fraud, comply with regulations

Required to proceed.

[I consent] [Privacy policy]
```

**Payment Gateway Consent:**

```
💳 *Payment Processing*

To process your payments, we'll share:
• Phone number
• Payment amounts
• Payment dates

With: EcoCash, Omari, Innbucks, OneWallet
Purpose: Collect loan repayments

Required to proceed.

[I consent] [Privacy policy]
```

**Marketing Consent (Optional):**

```
📩 *Marketing Communications*

Receive offers and updates via WhatsApp?

You'll get:
• New device launches
• Special discounts
• Payment reminders

You can opt out anytime.

[Yes, opt in] [No thanks]
```

---

## 6. Consent Revocation Process

### 6.1 How Customers Revoke Consent

**Via WhatsApp:**

```
Customer: "I want to opt out of marketing"

Bot Response:
✅ *Consent Updated*

You've been removed from marketing communications.

You'll still receive:
✓ Payment reminders
✓ Important account updates

To resubscribe: Send "OPT IN"
```

**Via Support:**

```
Customer: "Delete my data"

Support checks:
1. Active loans? → Cannot delete (explain retention policy)
2. Loans fully paid? → Check 7-year period
3. Outside retention? → Proceed with deletion

Support: "Your request has been logged. Data will be deleted within 30 days."
```

---

### 6.2 Revocation Implementation

```typescript
async function revokeConsent(
  customer_id: string,
  consent_type: ConsentType,
  reason: string
): Promise<void> {

  // Check if consent is required
  const required_consents = [
    'terms_and_conditions',
    'privacy_policy',
    'kyc_data_collection',
    'data_sharing_smile',
    'data_sharing_payment'
  ];

  if (required_consents.includes(consent_type)) {
    // Check if customer has active loans
    const { data: activeLoans } = await supabase
      .from('loans')
      .select('id')
      .eq('customer_id', customer_id)
      .in('status', ['active', 'pending']);

    if (activeLoans && activeLoans.length > 0) {
      throw new Error(
        'Cannot revoke required consent while loans are active. Please pay off loans first.'
      );
    }
  }

  // Revoke consent
  await supabase.from('customer_consents').update({
    revoked: true,
    revoked_at: new Date(),
    revoked_reason: reason
  }).eq('customer_id', customer_id).eq('consent_type', consent_type);

  // Handle side effects
  if (consent_type === 'marketing_communications') {
    await updateMarketingPreferences(customer_id, false);
  }
}
```

---

### 6.3 Data Deletion Request

```typescript
async function requestDataDeletion(customer_id: string): Promise<DeletionStatus> {

  // Check retention period
  const { data: customer } = await supabase
    .from('customers')
    .select('created_at, last_loan_paid_at')
    .eq('id', customer_id)
    .single();

  const last_activity = customer.last_loan_paid_at || customer.created_at;
  const seven_years_ago = new Date();
  seven_years_ago.setFullYear(seven_years_ago.getFullYear() - 7);

  if (new Date(last_activity) > seven_years_ago) {
    return {
      eligible: false,
      reason: 'Data retention period (7 years) not yet passed',
      eligible_after: new Date(last_activity).setFullYear(
        new Date(last_activity).getFullYear() + 7
      )
    };
  }

  // Schedule deletion
  await supabase.from('data_deletion_requests').insert({
    customer_id: customer_id,
    requested_at: new Date(),
    scheduled_deletion_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    status: 'pending'
  });

  return {
    eligible: true,
    deletion_scheduled: true,
    deletion_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  };
}
```

---

## 7. GDPR Compliance

### 7.1 GDPR Requirements (If Applicable)

**Lawful Basis for Processing:**

1. **Consent**: Explicit opt-in (not pre-checked)
2. **Contract**: Necessary to provide loan service
3. **Legal Obligation**: KYC compliance
4. **Legitimate Interest**: Fraud prevention

**GDPR Consent Standards:**

```
❌ BAD (Pre-checked):
[x] I agree to receive marketing

✅ GOOD (Explicit opt-in):
[ ] I agree to receive marketing
```

---

### 7.2 GDPR Data Subject Rights

**Rights Implementation:**

```typescript
// Right to Access (Data Export)
async function exportCustomerData(customer_id: string): Promise<CustomerDataExport> {

  const data = {
    personal_info: await getPersonalInfo(customer_id),
    kyc_data: await getKYCData(customer_id),
    loan_history: await getLoanHistory(customer_id),
    payment_history: await getPaymentHistory(customer_id),
    consents: await getConsents(customer_id)
  };

  // Generate JSON export
  const export_file = JSON.stringify(data, null, 2);

  // Send to customer
  await sendEmail(customer.email, {
    subject: 'Your Lynia Finance Data Export',
    attachment: {
      filename: 'lynia_data_export.json',
      content: export_file
    }
  });

  return { exported: true, export_date: new Date() };
}

// Right to Rectification
async function updateCustomerData(
  customer_id: string,
  updates: Partial<CustomerData>
): Promise<void> {

  // Validate updates
  validateDataUpdates(updates);

  // Update database
  await supabase.from('customers').update(updates).eq('id', customer_id);

  // Log change
  await logDataChange(customer_id, 'rectification', updates);
}
```

---

## 8. Implementation

### 8.1 Consent Management Service

```typescript
// src/services/privacy/consent-service.ts

export class ConsentService {

  /**
   * Record consent
   */
  async recordConsent(params: {
    customer_id: string;
    consent_type: ConsentType;
    consent_version: string;
    consent_text: string;
    consented: boolean;
    ip_address: string;
    user_agent: string;
  }): Promise<void> {

    await supabase.from('customer_consents').insert({
      customer_id: params.customer_id,
      consent_type: params.consent_type,
      consent_version: params.consent_version,
      consent_text: params.consent_text,
      consented: params.consented,
      consented_at: params.consented ? new Date() : null,
      ip_address: params.ip_address,
      user_agent: params.user_agent,
      consent_method: 'whatsapp'
    });
  }

  /**
   * Check if customer has given consent
   */
  async hasConsent(
    customer_id: string,
    consent_type: ConsentType
  ): Promise<boolean> {

    const { data } = await supabase
      .from('customer_consents')
      .select('consented, revoked')
      .eq('customer_id', customer_id)
      .eq('consent_type', consent_type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data && data.consented && !data.revoked;
  }

  /**
   * Get all consents for customer
   */
  async getAllConsents(customer_id: string): Promise<Consent[]> {

    const { data } = await supabase
      .from('customer_consents')
      .select('*')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false });

    return data || [];
  }

  /**
   * Revoke consent
   */
  async revokeConsent(
    customer_id: string,
    consent_type: ConsentType,
    reason: string
  ): Promise<void> {
    await revokeConsent(customer_id, consent_type, reason);
  }

  /**
   * Request data deletion
   */
  async requestDataDeletion(customer_id: string): Promise<DeletionStatus> {
    return await requestDataDeletion(customer_id);
  }
}
```

---

### 8.2 Database Schema

```sql
CREATE TABLE customer_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Consent details
  consent_type TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_text TEXT NOT NULL,

  -- Status
  consented BOOLEAN NOT NULL,
  consented_at TIMESTAMPTZ,

  -- Tracking
  ip_address TEXT,
  user_agent TEXT,
  consent_method TEXT,                    -- 'whatsapp' | 'web' | 'distributor'

  -- Revocation
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consents_customer ON customer_consents(customer_id);
CREATE INDEX idx_consents_type ON customer_consents(consent_type);

-- Data deletion requests
CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),

  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_deletion_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,                   -- 'pending' | 'approved' | 'rejected' | 'completed'

  -- Approval
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Completion
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES admin_users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deletion_customer ON data_deletion_requests(customer_id);
CREATE INDEX idx_deletion_status ON data_deletion_requests(status);
```

---

## Summary

**Privacy & Consent Management Deliverables:**
- ✅ **8 Consent Types**: Terms, privacy, KYC, credit check, marketing, data sharing (2), device lock
- ✅ **Onboarding Flow**: 4-step consent collection during onboarding
- ✅ **Terms & Privacy**: Clear, WhatsApp-friendly summaries + full web versions
- ✅ **Data Rights**: Access, rectification, deletion, portability
- ✅ **Revocation Process**: Easy opt-out via WhatsApp or support
- ✅ **GDPR Compliance**: Explicit consent, data export, deletion requests
- ✅ **Audit Trail**: Complete consent history with IP tracking

**Key Features:**
- Granular consent per data sharing partner
- Optional marketing consent
- 7-year data retention policy
- 30-day deletion processing
- WhatsApp-native consent flow

**Next Steps:**
1. Legal review of terms & privacy policy
2. Implement consent service
3. Build data export functionality
4. Create admin dashboard for deletion requests
5. Section 1.5 KYC & Onboarding Design complete!

---

**References:**
- Data Privacy Compliance: [data-privacy-compliance.md](data-privacy-compliance.md)
- Customer Onboarding Flow: [customer-onboarding-flow.md](customer-onboarding-flow.md)
- Database Schema: [database-schema.md](database-schema.md)
