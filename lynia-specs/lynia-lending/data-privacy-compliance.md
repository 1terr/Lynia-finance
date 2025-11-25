# Data Privacy & Compliance Framework

**Document**: P1-T006 - Data Privacy & Compliance Framework
**Status**: Complete
**Last Updated**: 2025-11-24
**Owner**: Engineering & Compliance Team

## Table of Contents
1. [Data Classification](#data-classification)
2. [Data Retention Policies](#data-retention-policies)
3. [PII Handling Procedures](#pii-handling-procedures)
4. [Encryption Standards](#encryption-standards)
5. [Zimbabwe Data Protection Compliance](#zimbabwe-data-protection-compliance)
6. [GDPR Compliance](#gdpr-compliance)
7. [Audit Trail Requirements](#audit-trail-requirements)
8. [Data Breach Response Plan](#data-breach-response-plan)
9. [Privacy by Design Principles](#privacy-by-design-principles)
10. [Third-Party Data Processing](#third-party-data-processing)

---

## 1. Data Classification

### 1.1 Data Categories

#### **Tier 1: Critical PII (Highest Protection)**
Personal Identifiable Information requiring maximum security:
- National ID number
- Passport number
- Driver's license number
- Biometric data (selfies, fingerprints)
- Bank account numbers
- Mobile money account details
- Device IMEI numbers
- GPS coordinates (exact location)
- Authentication credentials (passwords, OTP codes)

**Protection Requirements**:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Masked in logs and UI
- Access logging required
- Role-based access control
- Cannot be exported without authorization

#### **Tier 2: Sensitive Personal Data**
Personal information requiring strong protection:
- Full name
- Date of birth
- Phone number
- Email address
- Physical address
- Employer information
- Income details
- Credit score
- Loan repayment history
- Device assignment records
- Payment transaction details

**Protection Requirements**:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Partially masked in logs (e.g., +263771***567)
- Access logging required
- RBAC enforcement
- Exportable with admin authorization

#### **Tier 3: Business Data**
Operational data with moderate protection:
- Loan application status
- Device inventory status
- Distributor performance metrics
- Transaction amounts (without identifiers)
- System configuration
- Feature flags
- Notification preferences
- WhatsApp conversation metadata

**Protection Requirements**:
- Encryption in transit (TLS 1.3)
- Access logging recommended
- Standard authentication required
- Exportable for business analytics

#### **Tier 4: Public Data**
Non-sensitive information:
- Device catalog (brand, model, specs)
- Financing terms (interest rates, loan terms)
- Public documentation
- Marketing content
- System status pages

**Protection Requirements**:
- Standard security practices
- No special encryption required

### 1.2 Data Classification Matrix

| Data Element | Tier | Encrypted at Rest | Encrypted in Transit | Masked in Logs | Retention Period |
|--------------|------|-------------------|----------------------|----------------|------------------|
| National ID | 1 | ✅ AES-256 | ✅ TLS 1.3 | ✅ Full | 7 years after account closure |
| Phone Number | 2 | ✅ AES-256 | ✅ TLS 1.3 | ✅ Partial | 7 years after account closure |
| Full Name | 2 | ✅ AES-256 | ✅ TLS 1.3 | ❌ No | 7 years after account closure |
| Credit Score | 2 | ✅ AES-256 | ✅ TLS 1.3 | ❌ No | 7 years after calculation |
| IMEI | 1 | ✅ AES-256 | ✅ TLS 1.3 | ✅ Partial | Lifetime of device assignment |
| Loan Amount | 3 | ❌ No | ✅ TLS 1.3 | ❌ No | 7 years after loan closure |
| Device Model | 4 | ❌ No | ✅ TLS 1.3 | ❌ No | Indefinite |

---

## 2. Data Retention Policies

### 2.1 Retention Schedules

#### **Customer Data**
| Data Type | Active Account | Post-Closure | Justification |
|-----------|----------------|--------------|---------------|
| Identity documents (National ID, selfie) | Indefinite | 7 years | Legal compliance, fraud prevention |
| Contact information | Indefinite | 7 years | Communication, account recovery |
| Credit history | Indefinite | 7 years | Credit evaluation, regulatory reporting |
| Loan records | Indefinite | 7 years | Financial reporting, tax compliance |
| Payment transactions | Indefinite | 7 years | Financial audits, dispute resolution |
| Device assignments | Indefinite | 3 years | Warranty tracking, theft prevention |
| WhatsApp conversations | 90 days | Delete on closure | Customer support, compliance |
| Session logs | 30 days | Delete on closure | Security monitoring |

#### **Operational Data**
| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Application logs (DEBUG/INFO) | 7 days | Performance optimization |
| Application logs (WARN/ERROR) | 30 days | Issue investigation |
| Application logs (CRITICAL) | 90 days | Security incident analysis |
| Audit logs | 7 years | Compliance, forensic analysis |
| Database backups | 30 days | Disaster recovery |
| Metrics and analytics | 2 years | Business intelligence |
| System configuration history | 1 year | Change management |

#### **Third-Party Data**
| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Smile Identity KYC results | 7 years | Regulatory compliance |
| EcoCash/Paynow transaction records | 7 years | Financial reconciliation |
| WhatsApp message metadata | 90 days | Conversation context |
| Device lock provider records | 3 years | Device management |

### 2.2 Data Deletion Procedures

#### **Automated Deletion**
Scheduled jobs run daily at 02:00 UTC:

```sql
-- Delete expired WhatsApp conversations (>90 days old)
DELETE FROM whatsapp_messages
WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete expired session logs (>30 days old)
DELETE FROM sessions
WHERE created_at < NOW() - INTERVAL '30 days'
AND status = 'expired';

-- Soft delete closed customer accounts (>7 years)
UPDATE customers
SET deleted_at = NOW(),
    phone_number = 'DELETED_' || id,
    national_id = 'DELETED_' || id,
    email = NULL
WHERE status = 'closed'
AND updated_at < NOW() - INTERVAL '7 years'
AND deleted_at IS NULL;
```

#### **Manual Deletion (Right to Erasure)**
Process for customer-requested data deletion:

1. **Verification**: Confirm customer identity via KYC
2. **Eligibility Check**:
   - No active loans
   - No pending disputes
   - Account closed for >30 days
3. **Legal Review**: Confirm no legal hold requirements
4. **Execution**:
   ```sql
   -- Anonymize customer data
   UPDATE customers
   SET first_name = 'DELETED',
       last_name = 'USER',
       phone_number = 'DELETED_' || id,
       national_id = 'DELETED_' || id,
       email = NULL,
       address_line_1 = NULL,
       address_line_2 = NULL,
       deleted_at = NOW()
   WHERE id = :customer_id;

   -- Delete KYC documents from S3
   DELETE FROM kyc_submissions WHERE customer_id = :customer_id;

   -- Preserve loan records (anonymized) for compliance
   UPDATE loans
   SET ip_address = NULL,
       user_agent = NULL
   WHERE customer_id = :customer_id;
   ```
5. **Confirmation**: Send deletion confirmation to customer
6. **Audit**: Log deletion in audit_logs table

#### **Data Retention Exceptions**
Retain beyond standard periods when:
- Active legal proceedings
- Regulatory investigation
- Fraud investigation
- Unpaid debt collection
- Court order or subpoena

---

## 3. PII Handling Procedures

### 3.1 PII Collection

#### **Minimum Necessary Principle**
Only collect data required for:
- Identity verification (KYC)
- Credit assessment
- Loan servicing
- Payment processing
- Legal compliance

**Prohibited Collection**:
- Race or ethnicity (unless legally required)
- Political opinions
- Religious beliefs
- Health data (unless device insurance requires)
- Sexual orientation
- Trade union membership

#### **Consent Management**

**Explicit Consent Required For**:
- KYC document submission
- Credit bureau checks (future)
- Marketing communications
- Data sharing with third parties
- Location tracking (for device lock)

**Consent Flow**:
```javascript
// Consent capture during KYC
const kycConsent = {
  customer_id: 'uuid',
  consent_type: 'kyc_verification',
  consent_text: 'I authorize Lynia Finance to verify my identity using Smile Identity...',
  consented_at: '2025-11-24T12:00:00Z',
  ip_address: '102.133.45.67',
  user_agent: 'WhatsApp/2.23.20.76',
  withdrawal_instructions: 'Contact support@lyniafinance.com to withdraw consent'
};

// Store in database
INSERT INTO consent_records (customer_id, type, text, consented_at, ip_address)
VALUES (:customer_id, :consent_type, :consent_text, :consented_at, :ip_address);
```

**Consent Withdrawal**:
- Customers can withdraw consent via WhatsApp or support
- Withdrawal processed within 48 hours
- Services dependent on consent will be terminated
- Data deleted per retention policies

### 3.2 PII Processing

#### **Access Control**
| Role | National ID | Phone Number | Credit Score | Loan Details | Payment Details |
|------|-------------|--------------|--------------|--------------|-----------------|
| Customer | Own only | Own only | Own only | Own only | Own only |
| Distributor | ❌ No | Last 4 digits | ❌ No | View assigned | ❌ No |
| CS Admin | ✅ View | ✅ View | ✅ View | ✅ View | ✅ View |
| Finance Admin | ❌ No | Last 4 digits | ❌ No | ✅ View | ✅ View/Edit |
| Super Admin | ✅ View | ✅ View | ✅ View | ✅ View/Edit | ✅ View/Edit |
| System (API) | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |

#### **Data Masking Functions**

**Database-Level Masking** (PostgreSQL):
```sql
-- Create masking function for phone numbers
CREATE OR REPLACE FUNCTION mask_phone(phone TEXT, role TEXT)
RETURNS TEXT AS $$
BEGIN
  IF role IN ('super_admin', 'cs_admin', 'system') THEN
    RETURN phone;
  ELSIF role = 'finance_admin' OR role = 'distributor' THEN
    RETURN REGEXP_REPLACE(phone, '(\+\d{3}\d{3})(\d{4})(\d{3})', '\1****\3');
  ELSE
    RETURN '***';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create masking function for National ID
CREATE OR REPLACE FUNCTION mask_national_id(nid TEXT, role TEXT)
RETURNS TEXT AS $$
BEGIN
  IF role IN ('super_admin', 'cs_admin', 'system') THEN
    RETURN nid;
  ELSE
    RETURN REGEXP_REPLACE(nid, '(\d{2}-)(\d{3})(\d{3,4})(-.{1}-)(\d{2})', '\1***\3\4**');
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage in queries
SELECT
  id,
  first_name,
  last_name,
  mask_phone(phone_number, current_setting('app.user_role')) AS phone_number,
  mask_national_id(national_id, current_setting('app.user_role')) AS national_id
FROM customers;
```

**Application-Level Masking** (JavaScript):
```javascript
// PII masking utility
class PIIMasker {
  static maskPhone(phone, role) {
    if (['super_admin', 'cs_admin', 'system'].includes(role)) {
      return phone;
    }
    if (['finance_admin', 'distributor'].includes(role)) {
      return phone.replace(/(\+\d{3}\d{3})(\d{4})(\d{3})/, '$1****$3');
    }
    return '***';
  }

  static maskNationalID(nationalId, role) {
    if (['super_admin', 'cs_admin', 'system'].includes(role)) {
      return nationalId;
    }
    return nationalId.replace(/(\d{2}-)(\d{3})(\d{3,4})(-.{1}-)(\d{2})/, '$1***$3$4**');
  }

  static maskEmail(email, role) {
    if (['super_admin', 'cs_admin', 'system'].includes(role)) {
      return email;
    }
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }

  static maskBankAccount(account, role) {
    if (['super_admin', 'finance_admin', 'system'].includes(role)) {
      return account;
    }
    return account.replace(/(\d{4})(\d+)(\d{4})/, '$1****$3');
  }

  static maskForLogs(data) {
    return {
      ...data,
      phone_number: data.phone_number?.replace(/(\+\d{3}\d{3})(\d{4})(\d{3})/, '$1***$3'),
      national_id: data.national_id?.replace(/(\d{2}-)(\d{3})(\d{3,4})(-.{1}-)(\d{2})/, '$1***$3$4**'),
      password: undefined,
      access_token: '[REDACTED]',
      refresh_token: '[REDACTED]',
      otp_code: '[REDACTED]',
      bank_account: data.bank_account?.replace(/(\d{4})(\d+)(\d{4})/, '$1****$3'),
      imei: data.imei?.replace(/(\d{6})(\d{6})(\d{3})/, '$1******$3')
    };
  }
}

module.exports = PIIMasker;
```

### 3.3 PII Storage

#### **Database Encryption (Supabase)**
- **Encryption at Rest**: AES-256-GCM (PostgreSQL native)
- **Transparent Data Encryption (TDE)**: Enabled
- **Column-Level Encryption**: For Tier 1 PII

**Column-Level Encryption Example**:
```sql
-- Install pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt National ID before storage
INSERT INTO customers (national_id, phone_number, first_name, last_name)
VALUES (
  pgp_sym_encrypt('63-123456-A-12', current_setting('app.encryption_key')),
  '+263771234567',
  'John',
  'Doe'
);

-- Decrypt for authorized queries
SELECT
  id,
  pgp_sym_decrypt(national_id::bytea, current_setting('app.encryption_key')) AS national_id,
  phone_number
FROM customers
WHERE id = :customer_id;
```

#### **File Storage (AWS S3)**
- **KYC Documents**: Encrypted with S3 server-side encryption (SSE-KMS)
- **Encryption Key**: Customer-managed KMS key (CMK)
- **Access**: Pre-signed URLs with 5-minute expiry
- **Bucket Policy**: Enforce encryption, deny unencrypted uploads

**S3 Bucket Configuration**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::lynia-kyc-documents/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    },
    {
      "Sid": "RequireTLSForTransit",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::lynia-kyc-documents/*",
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

#### **Backup Encryption**
- **Daily Backups**: Encrypted with AWS Backup vault encryption
- **Point-in-Time Recovery**: 30-day window (encrypted)
- **Backup Access**: Restricted to backup admin role only
- **Retention**: 30 days (then permanently deleted)

---

## 4. Encryption Standards

### 4.1 Encryption at Rest

| Data Store | Encryption Method | Key Management | Key Rotation |
|------------|-------------------|----------------|--------------|
| Supabase PostgreSQL | AES-256-GCM (TDE) | Supabase-managed | Automatic (90 days) |
| AWS S3 (KYC docs) | SSE-KMS (AES-256) | Customer-managed CMK | Manual (yearly) |
| AWS RDS (Fineract) | AES-256-CBC | AWS KMS | Automatic (90 days) |
| Redis Cache | AES-256-GCM | ElastiCache-managed | Automatic (90 days) |
| CloudWatch Logs | AES-256 | AWS KMS | Automatic (90 days) |
| Backup Vault | AES-256-GCM | AWS Backup vault key | Automatic (90 days) |

**Implementation**:
```javascript
// S3 upload with KMS encryption
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function uploadKYCDocument(customerId, documentType, fileBuffer) {
  const params = {
    Bucket: 'lynia-kyc-documents',
    Key: `${customerId}/${documentType}_${Date.now()}.jpg`,
    Body: fileBuffer,
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: process.env.KMS_KEY_ID,
    ContentType: 'image/jpeg',
    Metadata: {
      'customer-id': customerId,
      'document-type': documentType,
      'encrypted': 'true'
    }
  };

  const result = await s3.upload(params).promise();
  return result.Location;
}
```

### 4.2 Encryption in Transit

| Communication Path | Protocol | Min TLS Version | Cipher Suites |
|--------------------|----------|-----------------|---------------|
| Customer ↔ API Gateway | HTTPS | TLS 1.3 | TLS_AES_256_GCM_SHA384 |
| API Gateway ↔ Lambda | HTTPS | TLS 1.3 | TLS_AES_256_GCM_SHA384 |
| Lambda ↔ Supabase | HTTPS | TLS 1.2 | TLS_ECDHE_RSA_AES_256_GCM_SHA384 |
| Lambda ↔ Fineract | HTTPS | TLS 1.2 | TLS_ECDHE_RSA_AES_256_GCM_SHA384 |
| Lambda ↔ S3 | HTTPS | TLS 1.2 | AWS Signature V4 |
| Admin Dashboard ↔ API | HTTPS | TLS 1.3 | TLS_AES_256_GCM_SHA384 |

**TLS Configuration** (API Gateway):
```yaml
# Serverless.yml
provider:
  name: aws
  runtime: nodejs18.x
  apiGateway:
    minimumCompressionSize: 1024
    shouldStartNameWithService: true
    metrics: true
    # TLS Configuration
    endpointConfiguration:
      types:
        - REGIONAL
    securityPolicy: TLS_1_2
    # Custom domain with TLS 1.3
    domainName:
      domainName: api.lyniafinance.com
      certificateArn: ${env:ACM_CERTIFICATE_ARN}
      securityPolicy: TLS_1_3
      endpointType: REGIONAL
```

**HTTPS Enforcement** (Middleware):
```javascript
// Express middleware to enforce HTTPS
function enforceHTTPS(req, res, next) {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'HTTPS_REQUIRED',
        message: 'HTTPS is required for this endpoint'
      }
    });
  }

  // Set security headers
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

module.exports = enforceHTTPS;
```

### 4.3 Key Management

#### **Key Hierarchy**
```
Master Key (AWS KMS CMK)
├── Data Encryption Keys (DEK)
│   ├── Database encryption key
│   ├── S3 bucket encryption key
│   ├── Backup encryption key
│   └── Application secrets key
└── Envelope Encryption
    └── Per-object keys (S3 files)
```

#### **Key Rotation Policy**
- **Automatic Rotation**: 90 days for AWS-managed keys
- **Manual Rotation**: Yearly for customer-managed keys
- **Emergency Rotation**: Within 24 hours if key compromise suspected
- **Audit**: Log all key usage in CloudTrail

**Key Rotation Script**:
```bash
#!/bin/bash
# Rotate KMS Customer Master Key

# Enable automatic key rotation
aws kms enable-key-rotation \
  --key-id alias/lynia-finance-master-key

# Schedule manual rotation reminder (yearly)
aws events put-rule \
  --name lynia-key-rotation-reminder \
  --schedule-expression "rate(365 days)" \
  --state ENABLED

# Create SNS topic for rotation alerts
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:key-rotation-alerts \
  --message "Annual KMS key rotation is due. Review and rotate if necessary." \
  --subject "Lynia Finance - Key Rotation Reminder"
```

---

## 5. Zimbabwe Data Protection Compliance

### 5.1 Legal Framework

#### **Applicable Laws**
1. **Cyber and Data Protection Act [Chapter 12:07]** (2021)
   - Regulates collection, processing, and storage of personal data
   - Establishes Data Protection Authority of Zimbabwe (DPAZ)
   - Requires data controller registration

2. **Reserve Bank of Zimbabwe (RBZ) Regulations**
   - Fintech licensing requirements
   - Anti-money laundering (AML) compliance
   - Customer due diligence (CDD)

3. **Electronic Transactions and E-Commerce Act**
   - Electronic signatures
   - Online contract validity

4. **Banking Act [Chapter 24:20]**
   - Credit reporting
   - Loan documentation

### 5.2 Compliance Requirements

#### **Data Controller Registration**
- **Entity**: Lynia Finance (Private) Limited
- **Registration**: Required within 30 days of operations
- **Authority**: Data Protection Authority of Zimbabwe (DPAZ)
- **Renewal**: Annual

**Registration Process**:
1. Complete Data Controller Registration Form
2. Submit data processing activities inventory
3. Provide data protection policy document
4. Pay registration fee (USD $500/year)
5. Appoint Data Protection Officer (DPO)

#### **Data Protection Officer (DPO)**
**Responsibilities**:
- Monitor compliance with Cyber and Data Protection Act
- Conduct privacy impact assessments
- Handle data subject requests (access, erasure, portability)
- Liaise with DPAZ
- Train staff on data protection
- Report breaches within 72 hours

**Qualifications**:
- Legal or IT background
- Knowledge of Zimbabwe data protection law
- Understanding of information security

#### **Data Subject Rights**
Under Zimbabwe's Cyber and Data Protection Act, customers have the right to:

1. **Right to Access** - Request copy of personal data held
   - Response time: 30 days
   - Format: Electronic (PDF) or physical copy
   - Fee: Free for first request, USD $10 for subsequent

2. **Right to Rectification** - Correct inaccurate data
   - Response time: 14 days
   - Process: Submit correction request via WhatsApp or email

3. **Right to Erasure** - Request data deletion
   - Response time: 30 days
   - Limitations: Cannot delete if legal obligation to retain

4. **Right to Object** - Object to data processing
   - Response time: 14 days
   - Impact: May result in service termination

5. **Right to Data Portability** - Receive data in machine-readable format
   - Response time: 30 days
   - Format: JSON or CSV

**Implementation**:
```javascript
// Data subject access request handler
async function handleDataAccessRequest(customerId, requestType) {
  const customer = await db.customers.findOne({ id: customerId });

  if (requestType === 'access') {
    // Compile all customer data
    const customerData = {
      personal_info: {
        name: `${customer.first_name} ${customer.last_name}`,
        phone: customer.phone_number,
        national_id: customer.national_id,
        dob: customer.date_of_birth,
        address: customer.address_line_1
      },
      credit_info: {
        credit_limit: customer.credit_limit,
        credit_score: customer.credit_score,
        credit_tier: customer.credit_tier
      },
      loans: await db.loans.find({ customer_id: customerId }),
      payments: await db.payments.find({ customer_id: customerId }),
      kyc: await db.kyc_submissions.find({ customer_id: customerId })
    };

    // Generate PDF report
    const pdf = await generatePDFReport(customerData);

    // Send via email
    await sendEmail(customer.email, 'Your Lynia Finance Data Report', pdf);

    // Log request
    await db.audit_logs.insert({
      action: 'DATA_ACCESS_REQUEST',
      customer_id: customerId,
      timestamp: new Date(),
      status: 'fulfilled'
    });
  }

  if (requestType === 'erasure') {
    // Check eligibility (no active loans)
    const activeLoans = await db.loans.count({
      customer_id: customerId,
      status: 'active'
    });

    if (activeLoans > 0) {
      throw new Error('Cannot delete data while active loans exist');
    }

    // Anonymize customer data
    await anonymizeCustomer(customerId);

    // Confirm deletion
    await sendSMS(customer.phone_number, 'Your data has been deleted from Lynia Finance systems as requested.');
  }
}
```

### 5.3 Local Data Storage

**Requirement**: Zimbabwe regulations encourage local data storage for critical PII.

**Current Approach**:
- **Primary Database**: Supabase (AWS ap-south-1 Mumbai, India) - closest AWS region
- **Backup Strategy**: Daily encrypted backups stored in AWS S3 (ap-south-1)
- **Future Consideration**: If Zimbabwe establishes local data center requirements, migrate to:
  - South Africa (AWS af-south-1 Cape Town)
  - OR on-premise Zimbabwe data center (high cost, ~$50K/year)

**Migration Plan** (if required):
1. Provision AWS RDS in af-south-1 (Cape Town)
2. Set up cross-region replication from ap-south-1 to af-south-1
3. Test failover and latency
4. Switch primary region to af-south-1
5. Maintain read replica in ap-south-1 for disaster recovery

### 5.4 Cross-Border Data Transfer

**Current Transfers**:
- **Smile Identity** (KYC provider) - Data sent to Nigeria/South Africa
- **WhatsApp Cloud API** - Data processed by Meta (Ireland, USA)
- **AWS Services** - Data stored in India (ap-south-1)

**Compliance Mechanism**:
- **Standard Contractual Clauses (SCCs)** with all third-party processors
- **Customer Consent** for cross-border transfers
- **Data Processing Agreements (DPAs)** signed with vendors

**Transfer Impact Assessment**:
| Vendor | Data Transferred | Destination | Legal Basis | Risk Level |
|--------|------------------|-------------|-------------|------------|
| Smile Identity | National ID, selfie | Nigeria/SA | Contractual necessity | Medium |
| Meta (WhatsApp) | Phone, messages | Ireland/USA | User consent | Low |
| AWS | All application data | India | Legitimate interest | Low |
| EcoCash/Paynow | Payment details | Zimbabwe | Contractual necessity | Low |

---

## 6. GDPR Compliance

### 6.1 GDPR Applicability

**Trigger**: Lynia Finance is subject to GDPR if:
- Offers services to EU residents (future expansion)
- Processes data of EU citizens (e.g., diaspora customers)

**Current Status**: Not applicable (Zimbabwe-only operations)

**Future-Proofing**: Design system to be GDPR-ready for international expansion

### 6.2 GDPR Requirements

#### **Lawful Basis for Processing**
| Processing Activity | GDPR Lawful Basis | Zimbabwe Equivalent |
|---------------------|-------------------|---------------------|
| KYC verification | Legal obligation | Legal obligation (AML/CFT) |
| Credit scoring | Legitimate interest | Legitimate interest |
| Loan servicing | Contract performance | Contract performance |
| Marketing communications | Consent | Consent |
| Fraud prevention | Legitimate interest | Legitimate interest |

#### **Data Protection Impact Assessment (DPIA)**
Required for high-risk processing:
- Large-scale processing of sensitive data
- Systematic monitoring (device location tracking)
- Automated decision-making (credit scoring)

**DPIA Template**:
```markdown
## Data Protection Impact Assessment: Credit Scoring System

### 1. Processing Description
- Purpose: Automated credit scoring for loan applications
- Data: Credit history, loan repayment, mobile money transactions
- Volume: 10,000 customers/year
- Technology: Machine learning model (Random Forest)

### 2. Necessity and Proportionality
- Necessary for: Fraud prevention, credit risk management
- Alternatives considered: Manual underwriting (not scalable)
- Data minimization: Only collect relevant credit indicators

### 3. Risks to Data Subjects
- Risk: Inaccurate credit score leading to loan denial
  - Likelihood: Low (model accuracy 92%)
  - Severity: Medium (financial exclusion)
  - Mitigation: Manual review for borderline cases, right to appeal

- Risk: Unauthorized access to credit scores
  - Likelihood: Low (RBAC enforced)
  - Severity: High (privacy breach)
  - Mitigation: Encryption, access logging, annual security audits

### 4. Compliance Measures
- Privacy by design: Minimal data collection
- Privacy by default: Opt-out of marketing
- Transparency: Explain credit decision factors
- Data subject rights: Access, rectification, erasure

### 5. Approval
- Reviewed by: Data Protection Officer
- Approved by: CTO, Legal Counsel
- Date: 2025-11-24
- Next review: 2026-11-24
```

#### **Data Processing Records (Article 30)**
Maintain records of all processing activities:

```json
{
  "processing_activity": "KYC Verification",
  "controller": {
    "name": "Lynia Finance (Private) Limited",
    "address": "Harare, Zimbabwe",
    "contact": "privacy@lyniafinance.com"
  },
  "purposes": ["Identity verification", "AML/CFT compliance"],
  "data_subjects": ["Loan applicants"],
  "data_categories": ["National ID number", "Selfie photo", "Full name", "Date of birth"],
  "recipients": ["Smile Identity (processor)", "Data Protection Authority (regulator)"],
  "transfers": {
    "countries": ["Nigeria", "South Africa"],
    "safeguards": "Standard Contractual Clauses (SCCs)"
  },
  "retention": "7 years after account closure",
  "security_measures": [
    "AES-256 encryption at rest",
    "TLS 1.3 in transit",
    "Access logging",
    "Annual penetration testing"
  ]
}
```

### 6.3 GDPR-Ready Features

Even though GDPR doesn't currently apply, implement best practices:

#### **Consent Management**
```javascript
// GDPR-compliant consent (granular, specific, informed)
const consentOptions = {
  kyc_verification: {
    required: true,
    purpose: 'Verify your identity for regulatory compliance',
    withdrawal: 'Cannot withdraw (legal obligation)'
  },
  credit_scoring: {
    required: true,
    purpose: 'Assess your creditworthiness for loan approval',
    withdrawal: 'Cannot withdraw (contract necessity)'
  },
  marketing_sms: {
    required: false,
    purpose: 'Send you promotional offers and product updates',
    withdrawal: 'Reply STOP to any marketing message'
  },
  data_analytics: {
    required: false,
    purpose: 'Improve our services through anonymized usage analytics',
    withdrawal: 'Contact privacy@lyniafinance.com'
  }
};

// Record consent
await db.consent_records.insert({
  customer_id: customerId,
  consent_type: 'marketing_sms',
  consented: true,
  consent_text: 'I agree to receive promotional SMS from Lynia Finance',
  timestamp: new Date(),
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
  withdrawal_method: 'Reply STOP to opt out'
});
```

#### **Right to Data Portability**
```javascript
// Export customer data in machine-readable format (JSON)
async function exportCustomerData(customerId) {
  const data = {
    export_date: new Date().toISOString(),
    customer: await db.customers.findOne({ id: customerId }),
    loans: await db.loans.find({ customer_id: customerId }),
    payments: await db.payments.find({ customer_id: customerId }),
    notifications: await db.notifications.find({ customer_id: customerId }),
    consent_records: await db.consent_records.find({ customer_id: customerId })
  };

  // Remove internal fields
  delete data.customer.fineract_client_id;
  delete data.customer.fineract_account_number;

  return JSON.stringify(data, null, 2);
}
```

#### **Privacy by Design**
- **Data Minimization**: Only collect necessary fields
- **Purpose Limitation**: Use data only for stated purposes
- **Storage Limitation**: Delete data after retention period
- **Accuracy**: Allow customers to update their information
- **Integrity & Confidentiality**: Encryption, access controls

---

## 7. Audit Trail Requirements

### 7.1 Audit Log Events

**Critical Events** (must be logged):
- User authentication (login, logout, failed attempts)
- Data access (view, export customer PII)
- Data modification (update, delete customer records)
- Administrative actions (role changes, permission grants)
- System configuration changes
- Security events (account lockout, password reset)
- Data breaches or security incidents
- Consent granted/withdrawn

**Audit Log Schema**:
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actor_id UUID NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  actor_ip INET NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  changes JSONB,
  result VARCHAR(20) NOT NULL,
  reason TEXT,
  session_id UUID,
  request_id VARCHAR(100),

  CONSTRAINT valid_result CHECK (result IN ('success', 'failure', 'partial'))
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_logs(action) WHERE result = 'failure';
```

**Audit Log Example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-11-24T12:30:45.123Z",
  "actor_id": "admin-uuid",
  "actor_role": "cs_admin",
  "actor_ip": "102.133.45.67",
  "action": "CUSTOMER_DATA_EXPORT",
  "resource_type": "customer",
  "resource_id": "customer-uuid",
  "changes": {
    "export_format": "PDF",
    "data_included": ["personal_info", "credit_info", "loans", "payments"]
  },
  "result": "success",
  "reason": "Data subject access request (DSAR)",
  "session_id": "session-uuid",
  "request_id": "req_abc123xyz"
}
```

### 7.2 Audit Implementation

**Middleware** (automatic logging):
```javascript
// Express middleware for audit logging
function auditLogger(req, res, next) {
  const startTime = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;

    // Log audit event
    const auditEvent = {
      timestamp: new Date(),
      actor_id: req.user?.id,
      actor_role: req.user?.role,
      actor_ip: req.ip,
      action: `${req.method}_${req.path}`,
      resource_type: req.params.resource_type,
      resource_id: req.params.id,
      changes: req.method === 'PUT' || req.method === 'PATCH' ? req.body : null,
      result: res.statusCode < 400 ? 'success' : 'failure',
      session_id: req.session?.id,
      request_id: req.headers['x-request-id'],
      duration_ms: Date.now() - startTime
    };

    // Only log sensitive actions
    const sensitiveActions = [
      '/customers/:id',
      '/kyc/submit',
      '/admin/loans/:id/approve',
      '/payments/:id',
      '/devices/lock',
      '/auth/login'
    ];

    if (sensitiveActions.some(pattern => req.path.match(pattern))) {
      db.audit_logs.insert(auditEvent);
    }

    return originalSend.call(this, data);
  };

  next();
}

module.exports = auditLogger;
```

### 7.3 Audit Retention

- **Retention Period**: 7 years (compliance requirement)
- **Storage**: Dedicated audit_logs table (not deleted with customer data)
- **Access**: Restricted to Super Admin, Compliance Officer, External Auditors
- **Immutability**: Write-only table (no UPDATE or DELETE allowed)

**Immutability Enforcement**:
```sql
-- Prevent updates and deletes on audit logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. Action: % on table audit_logs is not allowed.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_audit_update
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

### 7.4 Audit Review

- **Frequency**: Weekly review by Security Team
- **Automation**: CloudWatch Insights queries for anomalies
- **Alerts**: Trigger alerts for suspicious patterns

**Anomaly Detection Queries**:
```sql
-- Detect unusual data access patterns
SELECT
  actor_id,
  actor_role,
  COUNT(*) as access_count,
  COUNT(DISTINCT resource_id) as unique_resources,
  STRING_AGG(DISTINCT actor_ip::TEXT, ', ') as ip_addresses
FROM audit_logs
WHERE action = 'CUSTOMER_DATA_EXPORT'
AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY actor_id, actor_role
HAVING COUNT(*) > 50 -- More than 50 exports in 24h
ORDER BY access_count DESC;

-- Detect failed login attempts from same IP
SELECT
  actor_ip,
  COUNT(*) as failed_attempts,
  MAX(timestamp) as last_attempt
FROM audit_logs
WHERE action = 'AUTH_LOGIN'
AND result = 'failure'
AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY actor_ip
HAVING COUNT(*) > 5 -- More than 5 failed attempts
ORDER BY failed_attempts DESC;
```

---

## 8. Data Breach Response Plan

### 8.1 Breach Definition

**Data Breach**: Unauthorized access, disclosure, alteration, or destruction of personal data.

**Examples**:
- Database hack exposing customer National IDs
- Accidental S3 bucket made public
- Employee email account compromised
- Stolen laptop with unencrypted customer data
- Insider threat (employee stealing customer data)
- Third-party breach (Smile Identity, EcoCash)

### 8.2 Breach Response Team

| Role | Name/Title | Responsibilities | Contact |
|------|------------|------------------|---------|
| **Incident Commander** | CTO | Overall coordination, decision-making | +263771234567 |
| **Data Protection Officer** | DPO | Regulatory notification, legal compliance | dpo@lyniafinance.com |
| **Security Lead** | Security Engineer | Technical investigation, containment | security@lyniafinance.com |
| **Communications Lead** | Head of Customer Support | Customer notification, PR | comms@lyniafinance.com |
| **Legal Counsel** | External Law Firm | Legal implications, liability | legal@lyniafinance.com |

### 8.3 Breach Response Procedure

#### **Phase 1: Detection & Containment (0-2 hours)**

1. **Detect Breach**
   - Automated alerts (CloudWatch, AWS GuardDuty)
   - User reports (customer, employee)
   - Third-party notification

2. **Activate Response Team**
   - Send emergency SMS/email to all team members
   - Initiate incident call (Zoom/Google Meet)

3. **Initial Assessment**
   - Confirm breach occurrence (false positive?)
   - Identify affected systems
   - Estimate number of affected customers
   - Classify severity (P1/P2/P3/P4)

4. **Contain Breach**
   - Isolate affected systems (network segmentation)
   - Revoke compromised credentials
   - Block attacker IP addresses
   - Disable compromised user accounts
   - Take forensic snapshots (for investigation)

**Containment Playbook**:
```bash
#!/bin/bash
# Emergency breach containment script

# 1. Disable compromised admin account
aws iam update-login-profile \
  --user-name compromised-admin \
  --password-reset-required

# 2. Revoke all sessions for compromised user
aws iam delete-access-key \
  --user-name compromised-admin \
  --access-key-id AKIAIOSFODNN7EXAMPLE

# 3. Block attacker IP in WAF
aws wafv2 create-ip-set \
  --name blocked-ips-breach \
  --scope REGIONAL \
  --ip-address-version IPV4 \
  --addresses 192.0.2.44/32

# 4. Enable CloudTrail logging (if disabled)
aws cloudtrail start-logging \
  --name lynia-finance-trail

# 5. Take RDS snapshot for forensics
aws rds create-db-snapshot \
  --db-instance-identifier lynia-production \
  --db-snapshot-identifier breach-forensic-snapshot-$(date +%Y%m%d-%H%M%S)

# 6. Alert security team
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:security-alerts \
  --message "CRITICAL: Data breach detected. Containment actions executed. Incident call initiated."
```

#### **Phase 2: Investigation (2-24 hours)**

1. **Forensic Analysis**
   - Review audit logs for unauthorized access
   - Analyze CloudTrail for AWS API calls
   - Check application logs for suspicious activity
   - Identify attack vector (SQL injection, phishing, etc.)

2. **Scope Determination**
   - Number of affected customers
   - Types of data exposed (National IDs, phone numbers, credit scores, etc.)
   - Time period of breach (when did it start?)
   - Geographic scope (Zimbabwe only, or international?)

3. **Impact Assessment**
   - Risk to customers (identity theft, fraud)
   - Financial impact (regulatory fines, lawsuits)
   - Reputational damage

**Investigation Query**:
```sql
-- Find all unauthorized data access during breach window
SELECT
  al.timestamp,
  al.actor_id,
  u.email AS actor_email,
  al.actor_ip,
  al.action,
  al.resource_type,
  al.resource_id,
  c.phone_number AS affected_customer
FROM audit_logs al
LEFT JOIN admin_users u ON al.actor_id = u.id
LEFT JOIN customers c ON al.resource_id = c.id
WHERE al.timestamp BETWEEN '2025-11-24 10:00:00' AND '2025-11-24 14:00:00'
AND al.action IN ('CUSTOMER_DATA_EXPORT', 'CUSTOMER_VIEW', 'KYC_VIEW')
AND al.actor_ip NOT IN (SELECT ip FROM trusted_ips)
ORDER BY al.timestamp DESC;
```

#### **Phase 3: Notification (24-72 hours)**

**Regulatory Notification** (Zimbabwe):
- **Authority**: Data Protection Authority of Zimbabwe (DPAZ)
- **Deadline**: 72 hours from breach discovery
- **Method**: Email to breaches@dpaz.gov.zw
- **Content**:
  - Nature of breach
  - Categories and volume of data affected
  - Likely consequences
  - Measures taken to mitigate
  - Contact point for further information

**Customer Notification**:
- **Deadline**: 72 hours from breach discovery
- **Method**: SMS + Email (WhatsApp if no other contact)
- **Content**:
  - What happened
  - What data was affected
  - What we're doing about it
  - What customers should do (change passwords, monitor credit, etc.)
  - Contact information for questions

**Notification Template** (SMS):
```
LYNIA FINANCE SECURITY ALERT: We detected unauthorized access to some customer data on [DATE]. Your [National ID/phone number/etc.] may have been affected. We've secured our systems and are investigating. No action required from you, but stay alert for scam calls. More info: https://lyniafinance.com/security-incident. Questions? WhatsApp: +263771234567
```

**Notification Template** (Email):
```html
Subject: Important Security Notice - Lynia Finance Data Breach

Dear [Customer Name],

We are writing to inform you of a data security incident that may have affected your personal information.

WHAT HAPPENED:
On [DATE], we discovered that an unauthorized party gained access to our systems. We immediately launched an investigation and took steps to secure our systems.

WHAT INFORMATION WAS INVOLVED:
The following information may have been accessed:
- Full name
- National ID number
- Phone number
- Loan history
[Specify exactly what data was exposed]

WHAT WE ARE DOING:
- We have contained the breach and secured our systems
- We are conducting a thorough investigation with cybersecurity experts
- We have notified the Data Protection Authority of Zimbabwe
- We are implementing additional security measures to prevent future incidents

WHAT YOU SHOULD DO:
1. Monitor your mobile money accounts for suspicious activity
2. Be alert for phishing calls/messages claiming to be from Lynia Finance
3. Do not share your OTP codes with anyone
4. Report any suspicious activity to us immediately

We sincerely apologize for this incident and any concern it may cause. Protecting your information is our top priority.

For questions, contact us:
- WhatsApp: +263771234567
- Email: privacy@lyniafinance.com
- More info: https://lyniafinance.com/security-incident

Sincerely,
Lynia Finance Security Team
```

#### **Phase 4: Remediation (1-4 weeks)**

1. **Fix Vulnerabilities**
   - Patch security holes
   - Update access controls
   - Implement additional monitoring
   - Conduct security audit

2. **Enhanced Monitoring**
   - Increase logging verbosity
   - Deploy additional CloudWatch alarms
   - Enable AWS GuardDuty threat detection
   - Implement SIEM (Security Information and Event Management)

3. **Compensate Affected Customers**
   - Free credit monitoring (if available in Zimbabwe)
   - Waive loan fees for affected customers
   - Goodwill gesture (e.g., airtime credit)

#### **Phase 5: Post-Incident Review (4 weeks after)**

1. **Root Cause Analysis**
   - What happened?
   - Why did it happen?
   - How did we detect it?
   - How did we respond?

2. **Lessons Learned**
   - What went well?
   - What could be improved?
   - What gaps exist in our security?

3. **Action Items**
   - Technical improvements (e.g., MFA for all admins)
   - Process improvements (e.g., quarterly security training)
   - Policy updates (e.g., stricter password requirements)

4. **Report to Board**
   - Executive summary of incident
   - Financial impact
   - Remediation actions
   - Future prevention measures

**Post-Incident Report Template**:
```markdown
## Data Breach Post-Incident Report

### Incident Summary
- **Date**: 2025-11-24
- **Duration**: 10:00 - 14:00 UTC (4 hours)
- **Severity**: P1 (Critical)
- **Affected Customers**: 1,247
- **Data Exposed**: National IDs, phone numbers, loan balances

### Root Cause
- SQL injection vulnerability in `/admin/customers/search` endpoint
- Insufficient input validation on `search_query` parameter
- Attacker exploited vulnerability to dump customer table

### Timeline
- 10:00 - Attack begins
- 11:30 - CloudWatch alarm triggered (high DB query rate)
- 11:45 - Security team investigates
- 12:00 - Breach confirmed, containment initiated
- 12:15 - Vulnerability patched, attacker blocked
- 14:00 - Forensic analysis complete, scope determined
- 48:00 - DPAZ notified
- 72:00 - Customers notified

### Impact
- **Customers**: 1,247 (12% of total)
- **Financial**: Estimated $15,000 (notifications, legal, compensation)
- **Reputational**: Negative press coverage, social media criticism

### Remediation Actions
1. Patched SQL injection vulnerability
2. Implemented parameterized queries across all endpoints
3. Deployed Web Application Firewall (WAF)
4. Enabled AWS GuardDuty for threat detection
5. Conducted full penetration test (found 3 additional medium-severity issues)
6. Mandatory security training for all developers

### Lessons Learned
- **What went well**: Fast detection (90 min), effective containment, clear communication
- **What needs improvement**: Vulnerability existed for 6 months (should have been caught in code review)
- **Gaps identified**: No automated security scanning, insufficient input validation testing

### Recommendations
1. Implement SAST (Static Application Security Testing) in CI/CD
2. Quarterly penetration testing
3. Bug bounty program
4. Annual security audit by external firm
5. Incident response drills (quarterly)

### Sign-off
- **Prepared by**: Security Lead
- **Reviewed by**: DPO, CTO
- **Approved by**: CEO
- **Date**: 2025-12-10
```

### 8.4 Breach Prevention

**Proactive Measures**:
1. **Security Awareness Training** - Quarterly for all staff
2. **Penetration Testing** - Annual by external firm
3. **Code Reviews** - Security-focused reviews for all PRs
4. **Vulnerability Scanning** - Automated SAST/DAST in CI/CD
5. **Access Reviews** - Quarterly review of admin permissions
6. **Encryption Audits** - Verify all PII is encrypted at rest
7. **Third-Party Audits** - Annual SOC 2 Type II audit (future)

---

## 9. Privacy by Design Principles

### 9.1 Proactive not Reactive

**Implementation**:
- Security threat modeling during architecture phase
- Privacy impact assessment before launching features
- Regular security audits (quarterly)

### 9.2 Privacy as Default

**Implementation**:
- Minimal data collection (only what's necessary)
- Opt-in for marketing (not opt-out)
- Strongest privacy settings by default
- Automatic session expiry (30 minutes inactivity)

**Example**:
```javascript
// Default customer object (privacy-preserving)
const newCustomer = {
  phone_number: req.body.phone_number, // Required for service
  first_name: req.body.first_name, // Required for KYC
  last_name: req.body.last_name, // Required for KYC
  // Optional fields NOT collected unless explicitly provided
  email: null, // Not required
  marketing_consent: false, // Opt-in (default: false)
  data_analytics_consent: false, // Opt-in (default: false)
  utm_source: null, // Not tracked by default
};
```

### 9.3 Privacy Embedded into Design

**Implementation**:
- Database schema includes privacy controls (RLS policies)
- API endpoints enforce privacy by default (masked PII)
- Frontend UI respects privacy settings

### 9.4 Full Functionality

**Implementation**:
- Privacy doesn't compromise user experience
- Customers can still get loans without sharing unnecessary data
- Privacy-preserving analytics (anonymized, aggregated)

### 9.5 End-to-End Security

**Implementation**:
- Encryption at rest AND in transit
- Secure data lifecycle (collection → storage → processing → deletion)
- Access controls at every layer

### 9.6 Visibility and Transparency

**Implementation**:
- Clear privacy policy (written in simple English, not legalese)
- Privacy dashboard (customers can view/download their data)
- Consent is informed and specific

**Privacy Dashboard** (Customer View):
```javascript
// GET /customer/privacy-dashboard
{
  "my_data": {
    "personal_info": {
      "name": "John Doe",
      "phone": "+263771234567",
      "national_id": "63-123456-A-12"
    },
    "credit_info": {
      "credit_score": 720,
      "credit_limit": 350,
      "active_loans": 1
    }
  },
  "data_usage": {
    "kyc_verification": "Your ID was verified by Smile Identity on 2025-11-20",
    "credit_scoring": "Your credit score was calculated on 2025-11-21",
    "marketing": "You have opted out of marketing communications"
  },
  "my_rights": {
    "access": "Download a copy of your data",
    "rectify": "Update your personal information",
    "delete": "Request deletion of your account",
    "object": "Object to data processing"
  },
  "third_parties": [
    {
      "name": "Smile Identity",
      "purpose": "Identity verification",
      "data_shared": "National ID, selfie photo",
      "location": "Nigeria"
    },
    {
      "name": "EcoCash",
      "purpose": "Payment processing",
      "data_shared": "Phone number, payment amount",
      "location": "Zimbabwe"
    }
  ]
}
```

### 9.7 Respect for User Privacy

**Implementation**:
- Easy opt-out mechanisms
- No dark patterns (e.g., making privacy settings hard to find)
- Clear language (no legal jargon)
- Customer control over their data

---

## 10. Third-Party Data Processing

### 10.1 Vendor Assessment

**Criteria for Vendor Selection**:
1. **Security Certifications**: ISO 27001, SOC 2 Type II
2. **Data Protection Compliance**: GDPR, Zimbabwe Cyber Act
3. **Encryption**: TLS 1.3, AES-256
4. **Incident Response**: Published breach notification policy
5. **Data Residency**: Preference for African data centers
6. **Audit Rights**: Allow Lynia to audit their security

### 10.2 Data Processing Agreements (DPAs)

**Required for All Vendors** that process customer PII:

**DPA Checklist**:
- [ ] Purpose of processing clearly defined
- [ ] Types of personal data specified
- [ ] Duration of processing specified
- [ ] Processor obligations (security, confidentiality)
- [ ] Sub-processor approval process
- [ ] Data subject rights (access, deletion)
- [ ] Breach notification (within 24 hours to Lynia)
- [ ] Audit rights for Lynia
- [ ] Data return/deletion upon contract termination
- [ ] Liability and indemnification clauses

**Vendors Requiring DPAs**:
| Vendor | Data Processed | DPA Status | Review Date |
|--------|----------------|------------|-------------|
| Smile Identity | National ID, selfie | ✅ Signed | 2025-10-01 |
| AWS | All application data | ✅ Signed (AWS GDPR DPA) | N/A (standard) |
| Supabase | All application data | ✅ Signed | 2025-09-15 |
| Twilio (SMS) | Phone numbers, message content | ⏳ Pending | 2025-12-01 |
| Meta (WhatsApp) | Phone numbers, messages | ✅ Signed (WhatsApp Business ToS) | N/A (standard) |

### 10.3 Vendor Monitoring

- **Quarterly Reviews**: Review vendor security practices
- **Annual Audits**: Request SOC 2 reports from vendors
- **Breach Monitoring**: Monitor news for vendor breaches
- **Contract Renewals**: Re-assess security during renewals

---

## 11. Privacy Policy Summary

### 11.1 Customer-Facing Privacy Policy

**Language**: Simple English (Grade 8 reading level)
**Format**: Mobile-friendly (WhatsApp-first)
**Accessibility**: Available in English and Shona

**Key Sections**:
1. What data we collect and why
2. How we use your data
3. Who we share your data with
4. How we protect your data
5. Your privacy rights
6. How to contact us

**Privacy Policy Excerpt**:
```markdown
# Lynia Finance Privacy Policy

## What We Collect
We collect information you provide when you apply for a loan:
- Your name, phone number, and National ID (for identity verification)
- Your selfie photo (to confirm your identity)
- Your loan and payment history (to assess creditworthiness)
- Your device information (IMEI number for device lock/unlock)

## How We Use It
We use your information to:
- Verify your identity (required by law)
- Decide if you qualify for a loan
- Process your payments
- Send you loan reminders and updates
- Prevent fraud

## Who We Share With
We share your data with:
- Smile Identity (to verify your ID)
- EcoCash/Paynow (to process payments)
- Data Protection Authority (if required by law)

We will NEVER sell your data to third parties.

## Your Rights
You have the right to:
- See what data we have about you (request a copy)
- Correct any mistakes in your data
- Delete your data (if you close your account and have no active loans)
- Object to marketing messages (reply STOP)

## Contact Us
Questions about your privacy?
- WhatsApp: +263771234567
- Email: privacy@lyniafinance.com
```

---

## 12. Implementation Checklist

### Phase 1: Foundation (Weeks 1-2)
- [ ] Appoint Data Protection Officer (DPO)
- [ ] Register as Data Controller with DPAZ
- [ ] Draft privacy policy and terms of service
- [ ] Implement database encryption (AES-256)
- [ ] Set up S3 encryption (SSE-KMS)
- [ ] Create audit_logs table
- [ ] Implement PII masking functions

### Phase 2: Compliance (Weeks 3-4)
- [ ] Sign DPAs with all third-party vendors
- [ ] Implement data retention policies (automated deletion)
- [ ] Create data subject access request (DSAR) process
- [ ] Set up consent management system
- [ ] Document data processing activities (GDPR Article 30)
- [ ] Conduct Data Protection Impact Assessment (DPIA) for credit scoring

### Phase 3: Security (Weeks 5-6)
- [ ] Enforce TLS 1.3 for all API endpoints
- [ ] Implement rate limiting and DDoS protection
- [ ] Set up CloudWatch alarms for security events
- [ ] Enable AWS GuardDuty threat detection
- [ ] Conduct internal security audit
- [ ] Implement incident response runbooks

### Phase 4: Monitoring (Weeks 7-8)
- [ ] Deploy audit logging middleware
- [ ] Create CloudWatch dashboards for privacy metrics
- [ ] Set up weekly audit log reviews
- [ ] Test data breach response plan (tabletop exercise)
- [ ] Train staff on data protection procedures
- [ ] Launch privacy dashboard for customers

### Phase 5: Ongoing
- [ ] Quarterly vendor security reviews
- [ ] Annual penetration testing
- [ ] Annual DPO report to board
- [ ] Continuous monitoring of data protection regulations

---

## 13. Metrics & KPIs

### Privacy Compliance Metrics
| Metric | Target | Current | Trend |
|--------|--------|---------|-------|
| DSAR response time | <30 days | N/A (no requests yet) | - |
| Data retention compliance | 100% | N/A (system not live) | - |
| Vendor DPA coverage | 100% | 60% (3/5 signed) | ↑ |
| Security incidents | 0/year | 0 | - |
| Audit log coverage | 100% of sensitive actions | N/A (in development) | - |
| Customer consent rate | >80% (marketing) | N/A (not launched) | - |
| Encryption coverage | 100% of PII | 100% (design complete) | ✅ |

---

## 14. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-24 | Engineering & Compliance Team | Initial framework |

**Review Schedule**: Quarterly (every 3 months)
**Next Review**: 2026-02-24
**Owner**: Data Protection Officer
**Approvers**: CTO, Legal Counsel, CEO

---

## Appendices

### Appendix A: Glossary
- **PII**: Personally Identifiable Information
- **DPAZ**: Data Protection Authority of Zimbabwe
- **GDPR**: General Data Protection Regulation (EU)
- **DPA**: Data Processing Agreement
- **DSAR**: Data Subject Access Request
- **DPIA**: Data Protection Impact Assessment
- **TDE**: Transparent Data Encryption
- **SSE**: Server-Side Encryption
- **KMS**: Key Management Service
- **RLS**: Row Level Security

### Appendix B: References
- Zimbabwe Cyber and Data Protection Act [Chapter 12:07]
- GDPR Official Text (Regulation EU 2016/679)
- ISO 27001:2013 Information Security Standard
- NIST Cybersecurity Framework
- OWASP Top 10 Security Risks

### Appendix C: Contact Information
- **Data Protection Officer**: dpo@lyniafinance.com
- **Security Team**: security@lyniafinance.com
- **Privacy Inquiries**: privacy@lyniafinance.com
- **Data Protection Authority of Zimbabwe**: info@dpaz.gov.zw
- **Emergency Breach Hotline**: +263771234567 (24/7)

---

**End of Document**
