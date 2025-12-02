# Phase 2 Development Tasks

**Phase**: Phase 2 - Infrastructure + Core Services (MVP Foundation)
**Duration**: 6-8 weeks (November 28, 2025 - January 22, 2025)
**Status**: Ready to Start
**Goal**: Build production-ready infrastructure and core services for MVP demo

---

## Task Overview

| Task ID | Task Name | Priority | Estimate | Status | Dependencies |
|---------|-----------|----------|----------|--------|--------------|
| P2-T001 | Supabase Project Setup & Configuration | High | 4h | Pending | None |
| P2-T002 | Database Schema Implementation | High | 8h | Pending | P2-T001 |
| P2-T003 | AWS Lambda Project Structure Setup | High | 6h | Pending | None |
| P2-T004 | Credit Scoring Service Implementation | Critical | 16h | Pending | P2-T002, P2-T003 |
| P2-T005 | WhatsApp Cloud API Setup & Configuration | High | 6h | Pending | P2-T001 |
| P2-T006 | WhatsApp Bot - Customer Onboarding Flow | Critical | 20h | Pending | P2-T005, P2-T002 |
| P2-T007 | Smile Identity KYC Integration | High | 12h | Pending | P2-T002, P2-T003 |
| P2-T008 | Mobile Money Payment Integration | High | 16h | Pending | P2-T002, P2-T003 |
| P2-T009 | Device Handover Process Implementation | High | 10h | Pending | P2-T002, P2-T008 |
| P2-T010 | Device Lock/Unlock Management | Medium | 8h | Pending | P2-T002, P2-T009 |
| P2-T011 | Admin Dashboard - Core Features | High | 24h | Pending | P2-T002 |
| P2-T012 | Integration Testing & E2E Tests | High | 16h | Pending | All services |
| P2-T013 | AWS Lambda Deployment & CI/CD | Medium | 12h | Pending | All services |
| P2-T014 | Demo Preparation & Documentation | High | 8h | Pending | P2-T012 |

**Total Estimated Time**: 166 hours (4-5 weeks)

---

## Week 1: Foundation Setup (Nov 28 - Dec 4)

### P2-T001: Supabase Project Setup & Configuration
**Priority**: High
**Estimate**: 4 hours
**Status**: Pending

**Objective**: Set up production-ready Supabase project with proper security and configuration.

**Tasks**:
- [ ] Create Supabase project (region: eu-west-2 London)
- [ ] Configure authentication settings
- [ ] Set up Row Level Security (RLS) policies
- [ ] Configure API keys and service roles
- [ ] Set up database backups
- [ ] Configure CORS settings for frontend
- [ ] Test connection from local environment

**Deliverables**:
- Supabase project URL and credentials
- RLS policies configured
- Connection tested and verified

**Success Criteria**:
- [ ] Can connect to Supabase from local environment
- [ ] RLS policies prevent unauthorized access
- [ ] API keys stored securely in .env

**Reference Specs**:
- `planning/database-schema.md`
- `SETUP.md#step-3-supabase-setup`

---

### P2-T002: Database Schema Implementation
**Priority**: High
**Estimate**: 8 hours
**Status**: Pending
**Dependencies**: P2-T001

**Objective**: Deploy complete database schema with all 19 tables, indexes, and constraints.

**Tasks**:
- [ ] Review `database/migrations/001_initial_schema.sql`
- [ ] Deploy migration to Supabase (via SQL Editor or CLI)
- [ ] Verify all 19 tables created correctly
- [ ] Test all RLS policies
- [ ] Create indexes for performance
- [ ] Set up triggers for updated_at timestamps
- [ ] Deploy materialized views for reporting
- [ ] Load test seed data (`database/seed/001_test_data.sql`)
- [ ] Verify test data loaded correctly (3 customers, 2 loans, etc.)

**19 Tables to Create**:
1. customers
2. loan_products
3. loans
4. payments
5. kyc_submissions
6. credit_scores
7. devices
8. device_locks
9. distributors
10. agent_inventory
11. admin_users
12. notifications
13. support_tickets
14. international_interest
15. product_interest_waitlist
16. whatsapp_sessions
17. whatsapp_messages
18. audit_log
19. system_config

**Deliverables**:
- All 19 tables deployed to Supabase
- Test data loaded and verified
- Database documentation updated

**Success Criteria**:
- [ ] All 19 tables visible in Supabase Table Editor
- [ ] RLS policies tested and working
- [ ] Test data queries return expected results
- [ ] Indexes created for frequently queried columns

**Reference Specs**:
- `planning/database-schema.md`
- `database/migrations/001_initial_schema.sql`

---

### P2-T003: AWS Lambda Project Structure Setup
**Priority**: High
**Estimate**: 6 hours
**Status**: Pending

**Objective**: Set up AWS Lambda project structure with SAM CLI and TypeScript.

**Tasks**:
- [ ] Install AWS SAM CLI
- [ ] Configure AWS credentials
- [ ] Create SAM template (`template.yaml`)
- [ ] Set up TypeScript configuration for all services
- [ ] Create shared types and utilities (`services/shared/`)
- [ ] Set up build scripts (esbuild/webpack)
- [ ] Configure environment variables per service
- [ ] Set up local testing with SAM Local
- [ ] Create package.json for each service

**6 Microservices to Set Up**:
1. scoring-service
2. whatsapp-service
3. kyc-service
4. payment-service
5. lock-service
6. notification-service

**Deliverables**:
- SAM template.yaml with all 6 Lambda functions
- TypeScript build working for all services
- Shared types and utilities created
- Local testing environment working

**Success Criteria**:
- [ ] `sam build` completes successfully
- [ ] `sam local invoke` works for test function
- [ ] TypeScript compilation works without errors
- [ ] Shared code can be imported across services

**Reference Specs**:
- `planning/api-specifications.md`
- `SETUP.md#step-7-aws-lambda-configuration`

---

## Week 2: Core Services - Credit Scoring (Dec 5 - Dec 11)

### P2-T004: Credit Scoring Service Implementation ⭐ HIGHEST PRIORITY
**Priority**: Critical
**Estimate**: 16 hours
**Status**: Pending
**Dependencies**: P2-T002, P2-T003

**Objective**: Implement complete 5-component credit scoring algorithm.

**Tasks**:
- [ ] Create scoring service Lambda handler
- [ ] Implement affordability component (30%, 0-300 points)
  - [ ] DTI ratio calculation
  - [ ] Household affordability adjustment
  - [ ] Requested amount vs income validation
- [ ] Implement repayment willingness component (25%, 0-250 points)
  - [ ] Payment history analysis
  - [ ] Bill payment consistency scoring
- [ ] Implement mobile money activity component (20%, 0-200 points)
  - [ ] Transaction frequency scoring
  - [ ] Airtime purchase patterns
- [ ] Implement external credit data component (15%, 0-150 points)
  - [ ] Credit bureau data integration
  - [ ] Platform data (Bolt/Uber) integration
- [ ] Implement KYC verification component (10%, 0-100 points)
  - [ ] ID + selfie match scoring
- [ ] Create score scaling function (300-1000 raw → 300-850 scaled)
- [ ] Implement tier assignment logic
  - [ ] Tier 3: 750+ ($500 limit)
  - [ ] Tier 2: 700-749 ($350 limit)
  - [ ] Tier 1: 650-699 ($200 limit)
- [ ] Create API endpoint: POST /api/scoring/calculate
- [ ] Write unit tests (80%+ coverage target)
- [ ] Write integration tests with test data
- [ ] Document scoring API

**API Specification**:
```typescript
POST /api/scoring/calculate
Request: {
  customer_id: string;
  monthly_income_usd: number;
  existing_debt_obligations_usd: number;
  household_size: number;
  dependents: number;
  requested_loan_amount: number;
  mobile_money_data?: {
    transactions_last_3_months: number;
    airtime_purchases_last_month: number;
  };
  payment_history?: Array<{
    amount: number;
    due_date: string;
    paid_date: string;
    status: 'on_time' | 'late' | 'missed';
  }>;
}

Response: {
  total_score: number;           // 0-1000 raw
  scaled_score: number;          // 300-850
  components: {
    affordability: number;        // 0-300
    repayment_willingness: number; // 0-250
    mobile_money: number;         // 0-200
    external_credit: number;      // 0-150
    kyc_verification: number;     // 0-100
  };
  decision: 'approve' | 'review' | 'reject';
  credit_limit: number;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  reason_codes: string[];
}
```

**Deliverables**:
- Working credit scoring Lambda function
- All 5 components implemented and tested
- API endpoint deployed and documented
- Unit tests with 80%+ coverage
- Integration tests passing

**Success Criteria**:
- [ ] Score calculation matches spec exactly
- [ ] Weights sum to 100% (30+25+20+15+10)
- [ ] Raw points sum to 1000 max
- [ ] Scaled score in 300-850 range
- [ ] Tier assignment correct for all test cases
- [ ] API response time < 500ms
- [ ] Tests passing with 80%+ coverage

**Reference Specs**:
- `planning/credit-scoring-algorithm.md` ⭐ PRIMARY SPEC
- `planning/api-specifications.md`

---

## Week 2-3: WhatsApp Integration (Dec 5 - Dec 18)

### P2-T005: WhatsApp Cloud API Setup & Configuration
**Priority**: High
**Estimate**: 6 hours
**Status**: Pending
**Dependencies**: P2-T001

**Objective**: Set up WhatsApp Cloud API with webhook and phone number configuration.

**Tasks**:
- [ ] Create Meta Developer account
- [ ] Create WhatsApp Business App
- [ ] Get Phone Number ID
- [ ] Generate access token
- [ ] Configure webhook URL (use ngrok for local testing)
- [ ] Set webhook verify token
- [ ] Subscribe to webhook events:
  - [ ] messages
  - [ ] message_status
- [ ] Test webhook with test message
- [ ] Configure phone number display name
- [ ] Test sending test message via API

**Webhook Configuration**:
```
Webhook URL: https://your-domain.com/api/whatsapp/webhook
Verify Token: lynia_webhook_2025
Subscribed Events: messages, message_status
```

**Deliverables**:
- WhatsApp Business App configured
- Webhook receiving messages
- Can send messages via API
- Credentials in .env

**Success Criteria**:
- [ ] Can receive messages in webhook
- [ ] Can send messages via API
- [ ] Webhook verification passes
- [ ] Test message sent and received

**Reference Specs**:
- `planning/whatsapp-bot-specifications.md`
- `SETUP.md#step-4-whatsapp-cloud-api-setup`

---

### P2-T006: WhatsApp Bot - Customer Onboarding Flow ⭐ CRITICAL
**Priority**: Critical
**Estimate**: 20 hours
**Status**: Pending
**Dependencies**: P2-T005, P2-T002

**Objective**: Implement complete 8-step WhatsApp onboarding flow with Zimbabwe phone validation.

**8-Step Onboarding Flow**:
1. **Welcome & Language Selection**
   - Send welcome message
   - Offer English/Shona language choice
   - Store language preference

2. **Phone Number Collection & Validation**
   - Request phone number
   - Validate Zimbabwe format: `/^(\+?263|0)(7[1-8]{1}\d{7})$/`
   - Reject non-Zimbabwe numbers with clear message
   - Send SMS OTP (6-digit)
   - Verify OTP

3. **Personal Information Collection**
   - Request first name
   - Request last name
   - Request date of birth
   - Request residential address

4. **Employment & Income Information**
   - Request employment type (self-employed, employed, unemployed, informal)
   - Request monthly income (USD)
   - Request existing debt obligations
   - Request household size
   - Request number of dependents

5. **Product Selection**
   - Show available products:
     - Smartphone Financing (active)
     - Digital Credit (launching soon - add to waitlist)
   - For Smartphone Financing: show device catalog
   - Request desired loan amount

6. **KYC Document Upload**
   - Request national ID photo
   - Request selfie photo
   - Submit to Smile Identity API
   - Wait for verification result

7. **Credit Scoring**
   - Calculate credit score using P2-T004 service
   - Show decision:
     - Approved: Show tier, credit limit, next steps
     - Review: Inform of manual review (1-2 business days)
     - Rejected: Show reason codes, reapply guidance

8. **Loan Terms Acceptance**
   - Show loan terms (amount, interest rate, repayment schedule)
   - Request acceptance
   - Calculate deposit amount (20% of device value)
   - Send payment instructions (EcoCash/OneMoney)
   - Create loan record with status 'pending_deposit'

**State Machine**:
Store state in `whatsapp_sessions` table:
- session_id
- customer_id
- current_step (1-8)
- current_state (waiting_input, processing, completed)
- state_data (JSON with collected data)
- language
- created_at, updated_at

**Tasks**:
- [ ] Create webhook Lambda handler
- [ ] Implement state machine for session management
- [ ] Implement Step 1: Welcome & language selection
- [ ] Implement Step 2: Phone validation (Zimbabwe +263 only)
- [ ] Implement Step 3: Personal info collection
- [ ] Implement Step 4: Employment & income collection
- [ ] Implement Step 5: Product selection
- [ ] Implement Step 6: KYC document upload
- [ ] Implement Step 7: Credit scoring integration
- [ ] Implement Step 8: Loan terms acceptance
- [ ] Create message templates for all steps
- [ ] Implement error handling for each step
- [ ] Implement timeout handling (24h session expiry)
- [ ] Create API endpoint: POST /api/whatsapp/webhook
- [ ] Write integration tests for full flow
- [ ] Test with real WhatsApp number

**Zimbabwe Phone Validation**:
```typescript
const ZIMBABWE_PHONE_REGEX = /^(\+?263|0)(7[1-8]{1}\d{7})$/;

function validateZimbabwePhone(phone: string): boolean {
  return ZIMBABWE_PHONE_REGEX.test(phone);
}

// Valid examples:
// +263771234567
// +263781234567
// 0771234567
// 0781234567

// Invalid (reject):
// +254... (Kenya)
// +27... (South Africa)
// +263891234567 (invalid prefix)
```

**Deliverables**:
- Complete 8-step onboarding flow implemented
- Zimbabwe phone validation working
- State machine managing sessions
- Message templates created
- Integration tests passing
- Tested with real WhatsApp

**Success Criteria**:
- [ ] All 8 steps working end-to-end
- [ ] Zimbabwe phone validation working (rejects non-ZW)
- [ ] SMS OTP sent and verified
- [ ] State persists between messages
- [ ] Session timeout working (24h)
- [ ] Credit scoring integration working
- [ ] Can complete full onboarding in <20 minutes
- [ ] Error messages clear and helpful
- [ ] Tests covering all steps and error cases

**Reference Specs**:
- `planning/customer-onboarding-flow.md` ⭐ PRIMARY SPEC
- `planning/whatsapp-bot-specifications.md`
- `planning/sms-otp-specifications.md`

---

## Week 3-4: KYC & Payments (Dec 12 - Dec 25)

### P2-T007: Smile Identity KYC Integration
**Priority**: High
**Estimate**: 12 hours
**Status**: Pending
**Dependencies**: P2-T002, P2-T003

**Objective**: Integrate Smile Identity for ID + selfie verification (Zimbabwe only).

**Tasks**:
- [ ] Sign up for Smile Identity sandbox account
- [ ] Get partner ID and API key
- [ ] Create KYC service Lambda handler
- [ ] Implement ID document upload endpoint
- [ ] Implement selfie upload endpoint
- [ ] Integrate Smile Identity Enhanced KYC API
- [ ] Set country filter: Zimbabwe only
- [ ] Handle verification results:
  - [ ] Approved: Update customer kyc_status = 'verified'
  - [ ] Rejected: Update kyc_status = 'rejected', store reason
  - [ ] Review: Update kyc_status = 'review', notify admin
- [ ] Store verification data in kyc_submissions table
- [ ] Create webhook endpoint for async results
- [ ] Implement retry logic for failed verifications
- [ ] Write integration tests with test documents
- [ ] Document KYC API

**API Specification**:
```typescript
POST /api/kyc/submit
Request: {
  customer_id: string;
  id_type: 'national_id' | 'passport' | 'drivers_license';
  id_number: string;
  id_image_base64: string;
  selfie_image_base64: string;
}

Response: {
  submission_id: string;
  status: 'pending' | 'verified' | 'rejected' | 'review';
  confidence_score?: number;
  match_result?: {
    id_verified: boolean;
    selfie_match: boolean;
    liveness_check: boolean;
  };
  reason?: string;
}
```

**Deliverables**:
- Working KYC Lambda function
- Smile Identity integration complete
- Webhook handling async results
- Integration tests passing

**Success Criteria**:
- [ ] Can submit ID + selfie to Smile Identity
- [ ] Receives verification results correctly
- [ ] Updates customer kyc_status
- [ ] Stores verification data
- [ ] Handles errors gracefully
- [ ] Tests passing with sandbox data

**Reference Specs**:
- `planning/kyc-verification-specifications.md`
- `planning/api-specifications.md`

---

### P2-T008: Mobile Money Payment Integration
**Priority**: High
**Estimate**: 16 hours
**Status**: Pending
**Dependencies**: P2-T002, P2-T003

**Objective**: Integrate EcoCash and OneMoney for deposit and repayment processing.

**Tasks**:
- [ ] Sign up for EcoCash API sandbox
- [ ] Sign up for OneMoney API sandbox
- [ ] Create payment service Lambda handler
- [ ] Implement EcoCash payment provider
  - [ ] Initiate payment endpoint
  - [ ] Check payment status endpoint
  - [ ] Handle webhook callbacks
- [ ] Implement OneMoney payment provider
  - [ ] Initiate payment endpoint
  - [ ] Check payment status endpoint
  - [ ] Handle webhook callbacks
- [ ] Create unified payment API
- [ ] Implement payment reconciliation
- [ ] Store payments in payments table
- [ ] Link payments to loans
- [ ] Implement payment status polling (if no webhook)
- [ ] Handle failed payments
- [ ] Implement refund logic (if needed)
- [ ] Write integration tests for both providers
- [ ] Document payment API

**Payment Flow**:
1. Customer completes onboarding (loan approved)
2. System calculates deposit amount (20% of device value)
3. System sends payment request to customer via WhatsApp
4. Customer chooses payment method (EcoCash or OneMoney)
5. System initiates USSD push or payment link
6. Customer completes payment on their phone
7. System receives webhook callback or polls status
8. System verifies payment and updates loan status
9. If payment confirmed: Update loan status to 'paid_deposit'
10. Trigger device handover process (P2-T009)

**API Specification**:
```typescript
POST /api/payments/initiate
Request: {
  customer_id: string;
  loan_id: string;
  amount: number;
  currency: 'USD';
  payment_method: 'ecocash' | 'onemoney';
  phone_number: string; // Zimbabwe +263 format
  payment_type: 'deposit' | 'repayment';
}

Response: {
  payment_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  provider_reference: string;
  ussd_code?: string; // For USSD push
  payment_link?: string; // For web payment
}

POST /api/payments/webhook/ecocash
POST /api/payments/webhook/onemoney
Request: {
  // Provider-specific webhook payload
}

Response: {
  acknowledged: boolean;
}

GET /api/payments/:payment_id/status
Response: {
  payment_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  transaction_date?: string;
  provider_reference: string;
}
```

**Deliverables**:
- Working payment Lambda function
- EcoCash integration complete
- OneMoney integration complete
- Webhook handling working
- Payment reconciliation working
- Integration tests passing

**Success Criteria**:
- [ ] Can initiate payments via both providers
- [ ] Receives webhook callbacks correctly
- [ ] Updates payment status accurately
- [ ] Links payments to loans
- [ ] Handles failed payments gracefully
- [ ] Tests passing with sandbox data
- [ ] Payment processing time < 30 seconds

**Reference Specs**:
- `planning/payment-integration-specifications.md`
- `planning/api-specifications.md`

---

### P2-T009: Device Handover Process Implementation
**Priority**: High
**Estimate**: 10 hours
**Status**: Pending
**Dependencies**: P2-T002, P2-T008

**Objective**: Implement device handover process with mandatory deposit enforcement.

**Critical Business Rule**: NO CASH ON DELIVERY. Deposit MUST be paid and confirmed before device handover.

**Handover Flow**:
1. Customer completes onboarding (loan approved)
2. Customer pays deposit via mobile money (P2-T008)
3. System verifies deposit payment
4. System notifies distributor of pending handover
5. Distributor confirms device availability
6. System schedules handover appointment
7. Customer arrives at distributor location
8. Distributor verifies customer identity
9. Distributor hands over device
10. Distributor marks handover as complete in system
11. System updates loan status to 'active'
12. System starts repayment schedule

**Tasks**:
- [ ] Create handover workflow state machine
- [ ] Implement deposit verification logic
- [ ] Block handover if deposit not confirmed
- [ ] Create distributor notification system
- [ ] Implement appointment scheduling
- [ ] Create handover verification checklist
- [ ] Implement device serial number tracking
- [ ] Link device to loan in database
- [ ] Update loan status to 'active' after handover
- [ ] Generate repayment schedule
- [ ] Send customer confirmation WhatsApp message
- [ ] Write integration tests for full flow
- [ ] Document handover process

**Deposit Enforcement**:
```typescript
async function canProceedWithHandover(loanId: string): Promise<boolean> {
  const loan = await getLoan(loanId);
  const deposit = await getDepositPayment(loanId);

  // CRITICAL: Must have confirmed deposit
  if (!deposit || deposit.status !== 'completed') {
    return false;
  }

  // CRITICAL: Deposit amount must match required amount
  const requiredDeposit = loan.device_value * 0.20; // 20%
  if (deposit.amount < requiredDeposit) {
    return false;
  }

  return true;
}
```

**API Specification**:
```typescript
POST /api/handover/schedule
Request: {
  loan_id: string;
  distributor_id: string;
  appointment_date: string;
  device_serial_number: string;
}

Response: {
  handover_id: string;
  status: 'scheduled' | 'blocked_no_deposit';
  appointment_date: string;
  distributor: {
    name: string;
    location: string;
    phone: string;
  };
}

POST /api/handover/complete
Request: {
  handover_id: string;
  distributor_id: string;
  customer_id: string;
  device_serial_number: string;
  verified: boolean;
}

Response: {
  handover_id: string;
  status: 'completed';
  loan_status: 'active';
  repayment_schedule: Array<{
    payment_number: number;
    due_date: string;
    amount: number;
  }>;
}
```

**Deliverables**:
- Working handover Lambda function
- Deposit enforcement working (blocks if not paid)
- Distributor notifications working
- Appointment scheduling working
- Device tracking working
- Integration tests passing

**Success Criteria**:
- [ ] Cannot proceed without confirmed deposit
- [ ] Distributor receives handover notification
- [ ] Device linked to loan correctly
- [ ] Loan status updates to 'active'
- [ ] Repayment schedule generated
- [ ] Customer receives confirmation
- [ ] Tests covering all scenarios

**Reference Specs**:
- `planning/device-handover-process.md` ⭐ PRIMARY SPEC
- `planning/distributor-workflow.md`

---

### P2-T010: Device Lock/Unlock Management
**Priority**: Medium
**Estimate**: 8 hours
**Status**: Pending
**Dependencies**: P2-T002, P2-T009

**Objective**: Implement device lock/unlock functionality for payment enforcement.

**Lock Triggers**:
- Payment is 7+ days overdue
- Loan marked as defaulted by admin

**Unlock Triggers**:
- Overdue payment received and confirmed
- Admin manually unlocks (e.g., dispute resolution)

**Tasks**:
- [ ] Create lock service Lambda handler
- [ ] Research device lock APIs:
  - [ ] Google Find My Device API
  - [ ] Samsung Knox API
  - [ ] Generic MDM options
- [ ] Implement lock device endpoint
- [ ] Implement unlock device endpoint
- [ ] Create automated lock job (runs daily, checks overdue loans)
- [ ] Store lock/unlock events in device_locks table
- [ ] Implement lock notification (WhatsApp message to customer)
- [ ] Implement unlock notification
- [ ] Create admin override functionality
- [ ] Write integration tests
- [ ] Document lock API

**Lock Business Logic**:
```typescript
async function checkAndLockOverdueDevices() {
  const overdueLoans = await getOverdueLoans(7); // 7+ days overdue

  for (const loan of overdueLoans) {
    const device = await getDeviceByLoanId(loan.id);

    if (device && device.lock_status === 'unlocked') {
      await lockDevice(device.id);
      await notifyCustomerOfLock(loan.customer_id, loan.amount_overdue);
    }
  }
}
```

**API Specification**:
```typescript
POST /api/locks/lock-device
Request: {
  device_id: string;
  loan_id: string;
  reason: 'payment_overdue' | 'default' | 'admin_action';
  days_overdue?: number;
}

Response: {
  lock_id: string;
  device_id: string;
  lock_status: 'locked';
  locked_at: string;
}

POST /api/locks/unlock-device
Request: {
  device_id: string;
  reason: 'payment_received' | 'admin_override';
}

Response: {
  device_id: string;
  lock_status: 'unlocked';
  unlocked_at: string;
}
```

**Deliverables**:
- Working lock service Lambda function
- Device lock API integrated
- Automated daily lock job working
- Lock/unlock notifications working
- Integration tests passing

**Success Criteria**:
- [ ] Can lock device successfully
- [ ] Can unlock device successfully
- [ ] Automated job locks overdue devices (7+ days)
- [ ] Customer notified before locking
- [ ] Lock events stored in database
- [ ] Admin can manually override
- [ ] Tests passing

**Reference Specs**:
- `planning/device-lock-unlock-process.md`
- `planning/api-specifications.md`

---

## Week 5-6: Admin Dashboard (Dec 26 - Jan 8)

### P2-T011: Admin Dashboard - Core Features
**Priority**: High
**Estimate**: 24 hours
**Status**: Pending
**Dependencies**: P2-T002

**Objective**: Build Next.js 14 admin dashboard with core management features.

**Core Features**:
1. **Authentication & Authorization**
   - Admin login with Supabase Auth
   - Role-based access control (admin, manager, support)

2. **Dashboard Overview**
   - Key metrics cards:
     - Total customers
     - Active loans
     - Total disbursed (USD)
     - Default rate (%)
   - Recent activity feed
   - Alerts (overdue payments, pending KYC, etc.)

3. **Customer Management**
   - Customer list (searchable, filterable)
   - Customer detail view
   - KYC status and documents
   - Credit score history
   - Loan history

4. **Loan Management**
   - Loan list (searchable, filterable by product, status, date)
   - Loan detail view
   - Payment history
   - Repayment schedule
   - Manual loan approval/rejection
   - Add notes to loans

5. **Payment Management**
   - Payment list (searchable, filterable)
   - Payment detail view
   - Payment reconciliation
   - Manual payment recording

6. **Device Management**
   - Device list
   - Device detail view
   - Lock/unlock controls
   - Device assignment to loans

7. **Reporting** (Basic)
   - Loan disbursement report (filterable by product, date range)
   - Payment collection report (filterable by product, date range)
   - KYC status report
   - Default rate report (filterable by product)
   - Export to CSV

**NO P&L or Balance Sheet reports in Phase 2** (moved to Phase 4)

**Tasks**:
- [ ] Initialize Next.js 14 project with App Router
- [ ] Set up Tailwind CSS and UI components (shadcn/ui)
- [ ] Configure Supabase client for frontend
- [ ] Implement authentication pages (login, logout)
- [ ] Create protected route middleware
- [ ] Build dashboard layout with sidebar navigation
- [ ] Implement dashboard overview page
- [ ] Build customer management pages
- [ ] Build loan management pages
- [ ] Build payment management pages
- [ ] Build device management pages
- [ ] Build reporting pages with product filters
- [ ] Implement CSV export functionality
- [ ] Add toast notifications
- [ ] Make responsive for mobile/tablet
- [ ] Write integration tests
- [ ] Deploy to Vercel

**Tech Stack**:
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Supabase client
- React Query (data fetching)
- Recharts (charts)
- date-fns (date formatting)

**Deliverables**:
- Working admin dashboard deployed to Vercel
- All 7 core features implemented
- Responsive design
- Tests passing
- Deployed and accessible

**Success Criteria**:
- [ ] Can login as admin user
- [ ] Can view all customers and loans
- [ ] Can approve/reject loans manually
- [ ] Can view payment history
- [ ] Can lock/unlock devices
- [ ] Can generate reports filtered by product
- [ ] Can export data to CSV
- [ ] Dashboard loads in < 2 seconds
- [ ] Works on mobile and desktop
- [ ] Tests covering key workflows

**Reference Specs**:
- `planning/admin-dashboard-features.md` ⭐ PRIMARY SPEC
- `planning/reporting-requirements.md`

---

## Week 7: Testing & Demo Prep (Jan 9 - Jan 15)

### P2-T012: Integration Testing & E2E Tests
**Priority**: High
**Estimate**: 16 hours
**Status**: Pending
**Dependencies**: All services (P2-T004 through P2-T011)

**Objective**: Comprehensive testing of all services and end-to-end flows.

**Test Coverage Target**: 80%+

**Integration Tests**:
- [ ] Credit scoring service tests
- [ ] WhatsApp bot flow tests
- [ ] KYC integration tests
- [ ] Payment integration tests
- [ ] Device handover flow tests
- [ ] Device lock/unlock tests
- [ ] Admin dashboard API tests

**End-to-End Tests**:
- [ ] E2E-001: Complete onboarding flow (Zimbabwe customer)
  - Register via WhatsApp
  - Validate phone (+263)
  - Complete KYC
  - Get approved
  - Pay deposit
  - Receive device
- [ ] E2E-002: Payment collection flow
  - Active loan
  - Make repayment via EcoCash
  - Payment confirmed
  - Loan balance updated
- [ ] E2E-003: Device lock flow
  - Payment becomes overdue (7+ days)
  - Automated lock triggered
  - Customer notified
  - Device locked
- [ ] E2E-004: Admin loan approval
  - Customer in 'review' status
  - Admin reviews loan
  - Admin approves manually
  - Customer notified
- [ ] E2E-005: Non-Zimbabwe rejection
  - User with +254 (Kenya) number tries to register
  - System rejects with clear message
  - Added to international_interest table

**Tasks**:
- [ ] Set up test database (separate from dev)
- [ ] Create test data fixtures
- [ ] Write integration tests for all services
- [ ] Write E2E tests with Playwright or Cypress
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Configure test coverage reporting
- [ ] Fix any failing tests
- [ ] Achieve 80%+ coverage
- [ ] Document testing approach

**Deliverables**:
- All integration tests passing
- All E2E tests passing
- Test coverage report showing 80%+
- CI/CD pipeline running tests automatically

**Success Criteria**:
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All 5 E2E tests passing
- [ ] Test coverage ≥ 80%
- [ ] CI/CD pipeline green
- [ ] No critical bugs found

**Reference Specs**:
- `planning/testing-strategy.md`
- All service specifications

---

### P2-T013: AWS Lambda Deployment & CI/CD
**Priority**: Medium
**Estimate**: 12 hours
**Status**: Pending
**Dependencies**: All services

**Objective**: Deploy all Lambda functions to AWS and set up CI/CD pipeline.

**Tasks**:
- [ ] Create AWS account (if not exists)
- [ ] Configure AWS credentials
- [ ] Review and finalize SAM template.yaml
- [ ] Configure Lambda function settings:
  - [ ] Memory: 512MB
  - [ ] Timeout: 30s
  - [ ] Environment variables from .env
- [ ] Deploy to AWS staging environment
  - [ ] `sam build`
  - [ ] `sam deploy --guided`
- [ ] Configure API Gateway
- [ ] Set up custom domain (optional)
- [ ] Configure CloudWatch logs
- [ ] Set up CloudWatch alarms for errors
- [ ] Test all endpoints in staging
- [ ] Set up GitHub Actions CI/CD:
  - [ ] Run tests on push
  - [ ] Deploy to staging on merge to develop
  - [ ] Manual approval for production
- [ ] Create production environment
- [ ] Deploy to production
- [ ] Document deployment process

**Deliverables**:
- All Lambda functions deployed to AWS
- API Gateway configured
- CloudWatch monitoring active
- CI/CD pipeline automated
- Deployment documentation

**Success Criteria**:
- [ ] All Lambda functions deployed successfully
- [ ] All API endpoints accessible
- [ ] CloudWatch logs showing function invocations
- [ ] CI/CD pipeline deploying automatically
- [ ] No deployment errors
- [ ] API response times < 500ms

**Reference Specs**:
- `SETUP.md#step-7-aws-lambda-configuration`
- `planning/deployment-architecture.md`

---

### P2-T014: Demo Preparation & Documentation
**Priority**: High
**Estimate**: 8 hours
**Status**: Pending
**Dependencies**: P2-T012

**Objective**: Prepare comprehensive demo and finalize documentation.

**Demo Scenarios**:
1. **Scenario 1: Successful Onboarding**
   - Zimbabwe customer (+263) registers via WhatsApp
   - Completes 8-step onboarding
   - Gets approved (Tier 2, $350 limit)
   - Pays deposit via EcoCash
   - Picks up device from distributor

2. **Scenario 2: Non-Zimbabwe Rejection**
   - Customer with +254 (Kenya) tries to register
   - System rejects with message
   - Customer added to international_interest waitlist

3. **Scenario 3: Manual Review**
   - Customer gets 'review' decision (score 640)
   - Admin reviews in dashboard
   - Admin approves with adjusted limit
   - Customer notified and proceeds

4. **Scenario 4: Payment & Lock**
   - Active loan with missed payment
   - System locks device after 7 days
   - Customer makes payment
   - Device unlocked automatically

**Tasks**:
- [ ] Create demo test accounts
- [ ] Prepare demo script
- [ ] Record demo video (optional)
- [ ] Create demo presentation slides
- [ ] Write final documentation:
  - [ ] Update README.md
  - [ ] API documentation
  - [ ] User guides (admin, distributor)
  - [ ] Deployment guide
- [ ] Create changelog
- [ ] Prepare handover materials
- [ ] Schedule demo meeting

**Deliverables**:
- Demo environment ready
- Demo script documented
- Demo video (optional)
- Complete documentation
- Handover materials

**Success Criteria**:
- [ ] All 4 demo scenarios work perfectly
- [ ] Documentation complete and clear
- [ ] Demo can be run in < 30 minutes
- [ ] All stakeholders prepared

**Reference Specs**:
- All planning documents

---

## Week 8: Buffer & Refinements (Jan 16 - Jan 22)

### Buffer Week Activities:
- Fix any bugs found during testing
- Performance optimization
- Security review
- Documentation updates
- Final testing
- Preparation for production launch

---

## Success Metrics

### Technical Metrics
- [ ] All 19 database tables deployed
- [ ] 6 Lambda functions deployed and working
- [ ] Test coverage ≥ 80%
- [ ] API response time < 500ms
- [ ] Zero critical bugs

### Business Metrics
- [ ] Customer can complete onboarding in < 20 minutes
- [ ] Zimbabwe phone validation working (100% rejection of non-ZW)
- [ ] Deposit enforcement working (100% blocking without payment)
- [ ] Auto-approval rate > 50% (target: 60%)
- [ ] Device lock working for overdue payments

### Demo Readiness
- [ ] All 4 demo scenarios working
- [ ] Admin dashboard fully functional
- [ ] WhatsApp bot responsive
- [ ] Documentation complete
- [ ] Ready to present to stakeholders

---

## Risk Mitigation

### High-Risk Items
1. **WhatsApp API Approval** (P2-T005)
   - Risk: May take 1-2 weeks for business verification
   - Mitigation: Start application immediately, use test numbers meanwhile

2. **Third-Party API Access** (P2-T007, P2-T008)
   - Risk: Smile Identity, EcoCash, OneMoney may require business docs
   - Mitigation: Contact sales early, use sandbox for development

3. **Device Lock API** (P2-T010)
   - Risk: May not have API access to Google/Samsung lock
   - Mitigation: Research alternatives (MDM solutions), may need manual process initially

4. **Testing Coverage** (P2-T012)
   - Risk: 80% coverage is ambitious
   - Mitigation: Focus on critical paths first, accept lower coverage if needed

### Medium-Risk Items
1. **AWS Costs**
   - Mitigation: Use free tier, set billing alerts

2. **Database Performance**
   - Mitigation: Proper indexing, use materialized views

3. **Timeline Slippage**
   - Mitigation: Weekly checkpoints, buffer week built in

---

## Dependencies & Blockers

### External Dependencies
- Supabase account (can create immediately)
- Meta Developer account (can create immediately)
- WhatsApp Business approval (1-2 weeks)
- Smile Identity API access (1 week)
- EcoCash API access (1-2 weeks, may require business docs)
- OneMoney API access (1-2 weeks, may require business docs)
- AWS account (can create immediately)

### Internal Dependencies
- All tasks depend on P2-T002 (database schema)
- Services depend on P2-T003 (Lambda structure)
- WhatsApp bot depends on P2-T005 (WhatsApp setup)
- Handover depends on P2-T008 (payments working)
- Testing depends on all services complete

---

## Weekly Checkpoints

### Week 1 Checkpoint (Dec 4)
- [ ] Supabase project created
- [ ] Database schema deployed
- [ ] Test data loaded
- [ ] AWS Lambda structure set up
- [ ] Can invoke test Lambda function locally

### Week 2 Checkpoint (Dec 11)
- [ ] Credit scoring service working
- [ ] WhatsApp API configured
- [ ] WhatsApp bot Steps 1-4 implemented

### Week 3 Checkpoint (Dec 18)
- [ ] WhatsApp bot complete (all 8 steps)
- [ ] KYC integration working
- [ ] Payment integration started

### Week 4 Checkpoint (Dec 25)
- [ ] Payment integration complete
- [ ] Device handover flow working
- [ ] Device lock service working

### Week 5 Checkpoint (Jan 1)
- [ ] Admin dashboard started
- [ ] Authentication working
- [ ] Customer management pages complete

### Week 6 Checkpoint (Jan 8)
- [ ] Admin dashboard complete
- [ ] All features working
- [ ] Ready for testing

### Week 7 Checkpoint (Jan 15)
- [ ] All tests passing
- [ ] Deployed to AWS
- [ ] Demo scenarios working

### Week 8 Checkpoint (Jan 22)
- [ ] Phase 2 complete
- [ ] Ready for production
- [ ] Demo presented

---

## Notes

### Zimbabwe-Only Policy
**CRITICAL**: All phone validation must enforce Zimbabwe +263 numbers only. Any non-Zimbabwe numbers should be:
1. Rejected with clear message
2. Added to `international_interest` table for future expansion
3. NOT allowed to proceed with onboarding

### Deposit Enforcement
**CRITICAL**: Device handover CANNOT proceed without confirmed deposit payment. This is a hard business rule to prevent cash-on-delivery abuse.

### Multi-Product Architecture
The system supports multiple loan products:
- **Smartphone Financing**: Active in Phase 2
- **Digital Credit**: "Launching soon" status, customers added to waitlist

All reports and dashboards must support product filtering.

### Credit Scoring Transparency
When rejecting loans, always provide reason codes to help customers understand:
- "Income too low for requested amount"
- "Debt-to-income ratio too high"
- "Insufficient mobile money activity"
- "KYC verification failed"

---

## Getting Started

**Ready to start Phase 2?**

1. Read [QUICKSTART.md](QUICKSTART.md) (30 minutes)
2. Complete P2-T001 (Supabase setup)
3. Complete P2-T002 (Database deployment)
4. Start P2-T004 (Credit Scoring) - highest priority!

**Questions?**
- Check specifications in `planning/` folder
- Review [SETUP.md](SETUP.md) for detailed setup
- Review [PHASE-2-KICKOFF-PLAN.md](PHASE-2-KICKOFF-PLAN.md) for context

---

**Let's build Lynia Finance Phase 2! 🚀**
