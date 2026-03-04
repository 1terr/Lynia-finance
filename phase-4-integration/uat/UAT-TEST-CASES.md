# Lynia Finance - UAT Test Cases

**Document ID:** LYN-UAT-TC-001
**Version:** 1.0
**Date:** 2026-02-10
**Total Test Cases:** 87
**Reference:** UAT Test Plan LYN-UAT-PLAN-001

---

## Test Case Conventions

- **Test ID Format:** `UAT-S{scenario}-{number}` (e.g., UAT-S1-001)
- **Priority:** CRITICAL / HIGH / MEDIUM / LOW
- **Result:** PASS / FAIL / BLOCKED / NOT RUN
- **Severity of defects found:** CRITICAL / HIGH / MEDIUM / LOW

---

## Scenario 1: New Customer Onboarding via WhatsApp (Shona Language)

**Objective:** Validate end-to-end customer registration via WhatsApp in Shona language.
**Preconditions:** WhatsApp test number active, DIDIT sandbox ready.
**Test Data:** Phone: `+263771000001`, National ID: `63-2345678A90`

### UAT-S1-001: WhatsApp Initial Contact

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Test WhatsApp number `+263771000001` not previously registered |
| **Steps** | 1. Send "Hi" to Lynia WhatsApp business number from test phone<br>2. Observe response message |
| **Expected Result** | System responds with welcome message and language selection: "Welcome to Lynia Finance! / Mauya kuLynia Finance! / Siyakwamukela kuLynia Finance!" with options: 1 - English, 2 - Shona, 3 - Ndebele |
| **Result** | |
| **Notes** | |

### UAT-S1-002: Shona Language Selection

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S1-001 completed |
| **Steps** | 1. Reply "2" to select Shona<br>2. Observe response language |
| **Expected Result** | System responds in Shona: "Makakosha! Tichakubatsira kuita account yenyu." All subsequent messages are in Shona. |
| **Result** | |
| **Notes** | Verify Shona text is grammatically correct and culturally appropriate |

### UAT-S1-003: Personal Information Collection (Shona)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S1-002 completed |
| **Steps** | 1. System prompts for first name in Shona<br>2. Reply with "Tatenda"<br>3. System prompts for last name<br>4. Reply with "Musara"<br>5. System prompts for date of birth<br>6. Reply with "15/05/1992" |
| **Expected Result** | Each response is acknowledged in Shona. Data is stored correctly in database. |
| **Result** | |
| **Notes** | Verify simple language (8th-grade reading level) |

### UAT-S1-004: Phone Number Validation

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S1-003 completed |
| **Steps** | 1. Verify system uses the WhatsApp phone number (+263...) automatically<br>2. Confirm number starts with +263 prefix<br>3. Verify number has at least 12 characters |
| **Expected Result** | Phone number `+263771000001` is captured and validated as Zimbabwe number. Database stores full international format. |
| **Result** | |
| **Notes** | |

### UAT-S1-005: National ID Submission and Validation

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S1-004 completed |
| **Steps** | 1. System prompts for national ID in Shona<br>2. Enter invalid ID "ABC123" and submit<br>3. Observe error message<br>4. Enter valid ID "63-2345678A90" and submit |
| **Expected Result** | Step 3: Error message in Shona explaining correct ID format. Step 4: ID accepted, system confirms in Shona. Format regex `^[0-9]{2}-[0-9]{7}[A-Z][0-9]{2}$` is enforced. |
| **Result** | |
| **Notes** | Error message must be clear and not use technical jargon |

### UAT-S1-006: KYC Document Upload (ID Photo)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S1-005 completed |
| **Steps** | 1. System prompts for ID document photo in Shona<br>2. Take photo of test ID document and send via WhatsApp<br>3. Observe processing confirmation |
| **Expected Result** | Image received and processed. System confirms in Shona: "Tawana mifananidzo yenyu. Tiri kuitarisa..." |
| **Result** | |
| **Notes** | Test with both clear and slightly blurry images |

### UAT-S1-007: KYC Selfie Capture

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S1-006 completed |
| **Steps** | 1. System prompts for selfie in Shona<br>2. Send selfie photo via WhatsApp<br>3. Observe processing confirmation |
| **Expected Result** | Selfie received. System sends to DIDIT for face match and liveness check. Confirmation in Shona. |
| **Result** | |
| **Notes** | |

### UAT-S1-008: DIDIT Verification Callback

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S1-007 completed |
| **Steps** | 1. Wait for DIDIT sandbox callback (up to 30 seconds)<br>2. Observe KYC status update<br>3. Verify WhatsApp notification to customer |
| **Expected Result** | Callback received with ResultCode "1012" (Verified). KYC status updated to "verified" in database. Customer receives Shona notification: "Makorokoto! Mazita enyu averified." Confidence score >= 95%. |
| **Result** | |
| **Notes** | Face match score >= 0.95, liveness status "passed", country "ZW" |

### UAT-S1-009: Customer Record Verification

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S1-008 completed |
| **Steps** | 1. Query database for customer record<br>2. Verify all fields populated correctly<br>3. Verify KYC submission record exists<br>4. Verify audit log entries |
| **Expected Result** | Customer record exists with: phone=+263771000001, kyc_status=verified, country=Zimbabwe. KYC submission has: verification_confidence >= 95, verification_decision=APPROVED. Audit log has registration and KYC events. |
| **Result** | |
| **Notes** | |

### UAT-S1-010: Low-End Device WhatsApp Flow

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Samsung Galaxy A14 available |
| **Steps** | 1. Repeat UAT-S1-001 through UAT-S1-008 on Samsung Galaxy A14<br>2. Note any rendering issues, slow loading, or message truncation |
| **Expected Result** | All messages render correctly on low-end device. No message truncation. Images load within 10 seconds on 3G connection. Flow completes without errors. |
| **Result** | |
| **Notes** | Test on 3G connection speed if possible |

### UAT-S1-011: Ndebele Language Verification

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Test phone `+263771000003` available |
| **Steps** | 1. Send "Hi" to Lynia WhatsApp number from `+263771000003`<br>2. Select "3" for Ndebele<br>3. Verify all prompts appear in Ndebele<br>4. Complete first 3 registration steps |
| **Expected Result** | Ndebele language messages are grammatically correct and display properly. No English fallback for Ndebele-translated content. |
| **Result** | |
| **Notes** | |

### UAT-S1-012: Non-Zimbabwe Number Rejection

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Non-Zimbabwe phone available (e.g., +254...) |
| **Steps** | 1. Send "Hi" from a non-Zimbabwe number (+254712345678)<br>2. Observe response |
| **Expected Result** | System responds with polite rejection: service currently available only for Zimbabwe. No customer record created. |
| **Result** | |
| **Notes** | |

---

## Scenario 2: Loan Application, Scoring, and Approval

**Objective:** Validate credit scoring and loan decision workflow.
**Preconditions:** Customer with verified KYC exists (from Scenario 1 or seeded data).
**Test Data:** Customer `cust_test_001` (Tendai Moyo, monthly income $500, KYC verified).

### UAT-S2-001: Loan Application Initiation via WhatsApp

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Customer with KYC verified, WhatsApp active |
| **Steps** | 1. Customer sends "I want a phone" via WhatsApp<br>2. System presents available devices with prices<br>3. Customer selects Samsung Galaxy A14 ($350) |
| **Expected Result** | Device catalog shown with model, price, and storage. Price formatted as "$350.00". Selection confirmed. |
| **Result** | |
| **Notes** | |

### UAT-S2-002: Credit Score Calculation

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S2-001 completed |
| **Steps** | 1. System collects financial information: monthly income ($500), existing debt ($0), household size (3), dependents (1)<br>2. System calculates credit score<br>3. Verify score components |
| **Expected Result** | Score calculated with components: affordability > 0, kyc_verification > 0, income_stability > 0, employment > 0. Total raw score between 0-1000. Scaled score >= 650 for this profile. |
| **Result** | |
| **Notes** | Verify all component weights sum correctly |

### UAT-S2-003: Tier Assignment - Auto Approve (Tier 1)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Customer with score >= 750 |
| **Steps** | 1. Use test customer `cust_test_004` (Joseph Ndlovu, score 780)<br>2. Submit loan application for $500 device<br>3. Verify tier assignment and auto-approval |
| **Expected Result** | Tier 1 assigned. Decision = "approve" (automatic). Interest rate = 12% APR. Down payment = 5%. Credit limit >= $500. No manual review needed. |
| **Result** | |
| **Notes** | |

### UAT-S2-004: Tier Assignment - Manual Review (Tier 3)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Customer with score 600-649 |
| **Steps** | 1. Use test customer `cust_test_003` (Grace Chiweshe, score 640)<br>2. Submit loan application<br>3. Verify tier assignment and review decision |
| **Expected Result** | Tier 3 or Manual Review assigned. Decision = "review". Application flagged for admin review. Customer notified via WhatsApp that application is under review. |
| **Result** | |
| **Notes** | |

### UAT-S2-005: Tier Assignment - Auto Reject

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Customer with score < 600 |
| **Steps** | 1. Submit scoring request with: monthly_income=$100, existing_debt=$30, household_size=6, dependents=4, face_match=0.72, id_verification="review"<br>2. Verify rejection |
| **Expected Result** | Decision = "reject". Credit limit = $0. Tier = "Rejected". Rejection reason provided: "Credit score below minimum threshold". Customer notified politely via WhatsApp. |
| **Result** | |
| **Notes** | Verify rejection message is empathetic and suggests next steps |

### UAT-S2-006: Loan Terms Calculation

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S2-003 completed (Tier 2 approval for $350 device) |
| **Steps** | 1. Verify deposit calculation: 20% of $350 = $70<br>2. Verify principal: $350 - $70 = $280<br>3. Verify loan term: 6 months<br>4. Verify monthly payment calculation<br>5. Verify total repayment |
| **Expected Result** | Deposit = $70.00. Principal = $280.00. Interest applied per tier rate. Monthly payment < $280. Total repayment = principal * (1 + APR). All amounts formatted with 2 decimal places. |
| **Result** | |
| **Notes** | |

### UAT-S2-007: Loan Terms WhatsApp Disclosure

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S2-006 completed |
| **Steps** | 1. Verify WhatsApp message to customer includes:<br>   - Device name and price<br>   - Down payment amount<br>   - Monthly payment amount<br>   - Number of payments<br>   - Total amount to repay<br>   - APR interest rate<br>   - "No early repayment penalty" statement |
| **Expected Result** | All financial terms disclosed clearly in customer's selected language. No financial jargon. Amounts shown with currency (USD). Confirmation prompt: "Reply 1 to accept, 2 to decline". |
| **Result** | |
| **Notes** | Regulatory requirement: full fee disclosure before acceptance |

### UAT-S2-008: Credit Limit Enforcement

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Customer with credit limit of $500 |
| **Steps** | 1. Attempt loan application for device priced at $600 (above limit)<br>2. Verify rejection |
| **Expected Result** | Application rejected with reason "Requested amount exceeds credit limit". Customer shown their credit limit and eligible devices within range. |
| **Result** | |
| **Notes** | |

### UAT-S2-009: Score Retrieval for Existing Customer

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | Customer with previously calculated score |
| **Steps** | 1. GET /scoring/{customerId} for existing customer<br>2. Verify cached score returned |
| **Expected Result** | Returns previously calculated score with all components. Score timestamp included. No recalculation triggered. |
| **Result** | |
| **Notes** | Scores cached for 24 hours per caching strategy |

### UAT-S2-010: Score for Non-Existent Customer

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | None |
| **Steps** | 1. GET /scoring/cust_nonexistent<br>2. Verify 404 response |
| **Expected Result** | Returns 404 with error message "not found". No system error or crash. |
| **Result** | |
| **Notes** | |

---

## Scenario 3: Payment Processing (EcoCash, OneMoney)

**Objective:** Validate deposit and installment payments via mobile money.
**Preconditions:** Approved loan, sandbox credentials configured.
**Test Data:** Loan `loan_test_001` ($350, deposit $70), customer phone `+263771234567`.

### UAT-S3-001: Deposit Payment via EcoCash

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Approved loan requiring deposit of $70.00 |
| **Steps** | 1. Initiate payment: POST /payments/initiate with loan_id, customer_id, amount=7000 (cents), customer_phone=+263771234567, payment_type=deposit, payment_method=ecocash<br>2. Verify EcoCash sandbox USSD prompt<br>3. Confirm payment on sandbox<br>4. Wait for callback |
| **Expected Result** | Payment initiated with status "pending". EcoCash USSD prompt sent to phone. After confirmation, callback updates status to "completed". Provider reference captured. |
| **Result** | |
| **Notes** | Amount in cents for internal processing |

### UAT-S3-002: Deposit Payment via OneMoney

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Approved loan requiring deposit |
| **Steps** | 1. Initiate payment with payment_method=onemoney<br>2. Verify OneMoney sandbox USSD prompt<br>3. Confirm payment on sandbox<br>4. Wait for callback |
| **Expected Result** | Payment initiated, OneMoney prompt delivered, callback received, status updated to "completed". |
| **Result** | |
| **Notes** | |

### UAT-S3-003: Installment Payment Processing

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Active loan with outstanding balance |
| **Steps** | 1. Initiate installment payment for monthly amount ($51.33)<br>2. Process through EcoCash sandbox<br>3. Verify balance update |
| **Expected Result** | Payment completed. Outstanding balance reduced by payment amount. Paid installments count incremented. Next payment date updated to +30 days. |
| **Result** | |
| **Notes** | |

### UAT-S3-004: Payment Receipt via WhatsApp

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S3-001 or UAT-S3-003 completed |
| **Steps** | 1. Verify WhatsApp message sent after payment completion<br>2. Check receipt contents |
| **Expected Result** | Customer receives WhatsApp message with: payment amount (formatted), payment date, provider reference, remaining balance, next payment date. Message in customer's selected language. |
| **Result** | |
| **Notes** | Trust-building requirement: immediate transaction receipts |

### UAT-S3-005: Payment with Missing Required Fields

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | None |
| **Steps** | 1. POST /payments/initiate with only loan_id (missing customer_id, amount, customer_phone, payment_type)<br>2. Verify error response |
| **Expected Result** | Returns 400 with error "Missing required fields". Required fields listed: customer_id, amount, customer_phone, payment_type. No payment record created. |
| **Result** | |
| **Notes** | |

### UAT-S3-006: Single Transaction Limit Enforcement ($2,000)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | None |
| **Steps** | 1. Attempt payment of $2,500 (above $2,000 single limit)<br>2. Verify rejection |
| **Expected Result** | Payment rejected with error referencing transaction limit. No payment initiated with provider. Customer informed of limit. |
| **Result** | |
| **Notes** | RBZ regulatory requirement |

### UAT-S3-007: Daily Transaction Limit Enforcement ($5,000)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Customer has made $4,500 in payments today |
| **Steps** | 1. Attempt additional payment of $1,000 (would exceed $5,000 daily limit)<br>2. Verify rejection |
| **Expected Result** | Payment rejected with error referencing daily transaction limit. Customer informed of remaining daily limit. |
| **Result** | |
| **Notes** | RBZ regulatory requirement |

### UAT-S3-008: Monthly Transaction Limit Enforcement ($50,000)

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Customer has made $49,500 in payments this month |
| **Steps** | 1. Attempt additional payment of $1,000 (would exceed $50,000 monthly limit)<br>2. Verify rejection |
| **Expected Result** | Payment rejected with error referencing monthly transaction limit. |
| **Result** | |
| **Notes** | RBZ regulatory requirement |

### UAT-S3-009: Duplicate Payment Prevention (Idempotency)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Payment just initiated (status pending) |
| **Steps** | 1. Submit identical payment request within 5 minutes<br>2. Verify no duplicate transaction created |
| **Expected Result** | System detects duplicate and returns existing transaction reference. No second payment initiated with provider. Customer not double-charged. |
| **Result** | |
| **Notes** | Critical for financial integrity |

### UAT-S3-010: Failed Payment Handling

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | None |
| **Steps** | 1. Initiate payment with sandbox configured to simulate failure (insufficient funds)<br>2. Verify failure handling |
| **Expected Result** | Payment status updated to "failed". Failure reason recorded ("Insufficient funds"). Customer notified via WhatsApp. Loan balance unchanged. Retry option provided. |
| **Result** | |
| **Notes** | |

### UAT-S3-011: Payment Timeout Handling

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | None |
| **Steps** | 1. Initiate payment and let sandbox timeout (>30 seconds)<br>2. Verify timeout handling |
| **Expected Result** | Payment marked as "timeout" or "pending_verification". Customer informed to check with provider. No balance update until confirmation received. |
| **Result** | |
| **Notes** | EcoCash/OneMoney timeout is 30 seconds per config |

---

## Scenario 4: Device Handover and Activation

**Objective:** Validate device handover from distributor to customer.
**Preconditions:** Approved loan with deposit paid, device in_stock.
**Test Data:** Loan `loan_test_004`, device `device_test_001` (Samsung Galaxy A14, $350).

### UAT-S4-001: Handover Readiness Check - All Conditions Met

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Loan approved, deposit paid, device available |
| **Steps** | 1. POST /handovers/check-readiness with loan_id<br>2. Verify all readiness conditions |
| **Expected Result** | Returns ready=true with: loan_status=approved, deposit_paid=true, device_available=true. No blocking conditions. |
| **Result** | |
| **Notes** | |

### UAT-S4-002: Handover Readiness Check - Missing Deposit

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Loan approved but deposit not yet paid |
| **Steps** | 1. POST /handovers/check-readiness with loan_id where deposit_paid=false<br>2. Verify blocking condition |
| **Expected Result** | Returns ready=false with blocking_reason: "Deposit not yet paid". Handover cannot proceed. |
| **Result** | |
| **Notes** | |

### UAT-S4-003: Handover Readiness Check - Missing loan_id

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | None |
| **Steps** | 1. POST /handovers/check-readiness with empty body<br>2. Verify validation error |
| **Expected Result** | Returns 400 with error "loan_id is required". |
| **Result** | |
| **Notes** | |

### UAT-S4-004: Initiate Handover

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Readiness check passed (UAT-S4-001) |
| **Steps** | 1. POST /handovers/initiate with loan_id, customer_id, device_id, distributor_id<br>2. Verify handover record created |
| **Expected Result** | Handover created with status "initiated". identity_verified=false, deposit_verified=false, device_inspected=false. Handover ID returned. |
| **Result** | |
| **Notes** | |

### UAT-S4-005: Identity Verification Step

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S4-004 completed |
| **Steps** | 1. POST /handovers/verify-identity with handover_id, verification_method, id_number_last4<br>2. Verify identity confirmed |
| **Expected Result** | Handover updated: identity_verified=true. Customer identity matched against KYC records. |
| **Result** | |
| **Notes** | Distributor verifies customer's physical ID matches system records |

### UAT-S4-006: Deposit Verification Step

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S4-005 completed |
| **Steps** | 1. POST /handovers/verify-deposit with handover_id<br>2. Verify deposit payment confirmed |
| **Expected Result** | System checks payment records for completed deposit. Handover updated: deposit_verified=true, status="deposit_verified". |
| **Result** | |
| **Notes** | |

### UAT-S4-007: Complete Handover

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Identity and deposit verified |
| **Steps** | 1. POST /handovers/complete with handover_id<br>2. Verify device assignment<br>3. Verify status updates<br>4. Verify notifications |
| **Expected Result** | Handover status="completed". Device status changed from "in_stock" to "assigned". Device customer_id and loan_id populated. Trustonic device activation command sent. WhatsApp confirmation sent to customer. Commission calculated for distributor. |
| **Result** | |
| **Notes** | |

### UAT-S4-008: Commission Calculation

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S4-007 completed |
| **Steps** | 1. Verify commission record for distributor<br>2. Check calculation: 5% of device retail price |
| **Expected Result** | Commission = 5% x $350 = $17.50. Commission record linked to handover_id and distributor_id. Status = "pending" (awaiting payout). |
| **Result** | |
| **Notes** | |

### UAT-S4-009: Handover with Missing Required Fields

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | None |
| **Steps** | 1. POST /handovers/initiate with only loan_id (missing other fields)<br>2. Verify validation error |
| **Expected Result** | Returns 400 with "Missing required fields". Required fields listed. No handover created. |
| **Result** | |
| **Notes** | |

### UAT-S4-010: First Payment Date Calculation

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S4-007 completed |
| **Steps** | 1. Verify loan's next_payment_date is set to handover date + 30 days<br>2. Verify customer notified of first payment date |
| **Expected Result** | First payment due exactly 30 days from handover completion. Date communicated to customer via WhatsApp in their selected language. |
| **Result** | |
| **Notes** | |

---

## Scenario 5: Overdue Payment -> Device Lock -> Payment -> Unlock

**Objective:** Validate the collections and device lock lifecycle.
**Preconditions:** Active loan with payment 10 days overdue.
**Test Data:** Loan `loan_test_002` (overdue), device `device_test_002`.

### UAT-S5-001: Overdue Payment Detection

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Loan with next_payment_date 10 days in the past |
| **Steps** | 1. Run overdue payment detection process<br>2. Verify loan flagged as overdue |
| **Expected Result** | Loan identified as overdue (10 days past due). Overdue status recorded. Days overdue calculated correctly. |
| **Result** | |
| **Notes** | |

### UAT-S5-002: Payment Reminder - Day 1

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Payment 1 day overdue |
| **Steps** | 1. Trigger Day 1 reminder process<br>2. Verify WhatsApp notification sent |
| **Expected Result** | Customer receives friendly reminder via WhatsApp in their language: "Your payment of $XX.XX was due yesterday. Reply 1 to pay now." Tone is helpful, not threatening. |
| **Result** | |
| **Notes** | Simple language, actionable options |

### UAT-S5-003: Payment Reminder - Day 3

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Payment 3 days overdue, Day 1 reminder sent |
| **Steps** | 1. Trigger Day 3 reminder<br>2. Verify escalated notification |
| **Expected Result** | Customer receives second reminder with slightly more urgency. Mentions that device may be temporarily locked if payment not received. Extension request option provided. |
| **Result** | |
| **Notes** | |

### UAT-S5-004: Payment Reminder - Day 5 (Final Warning)

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Payment 5 days overdue |
| **Steps** | 1. Trigger Day 5 final warning<br>2. Verify warning content |
| **Expected Result** | Customer receives final warning: device will be temporarily locked in 2 days if payment not received. Contact support option provided. Human escalation path available. |
| **Result** | |
| **Notes** | Must include human support escalation option |

### UAT-S5-005: Automated Device Lock (Day 7)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Payment 7+ days overdue, all reminders sent |
| **Steps** | 1. Trigger automated lock process for 7+ day overdue loans<br>2. Verify Trustonic lock command sent<br>3. Verify device status update<br>4. Verify customer notification |
| **Expected Result** | Trustonic lock command sent and confirmed (trustonic_status="success"). Device lock_status changed to "locked". Lock history record created with: action="lock", trigger_type="automated", reason="Payment overdue 7+ days". Customer notified via WhatsApp with payment instructions. |
| **Result** | |
| **Notes** | |

### UAT-S5-006: Lock Audit Trail

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S5-005 completed |
| **Steps** | 1. Query device_locks table for the locked device<br>2. Verify audit trail completeness |
| **Expected Result** | Lock record includes: device_id, loan_id, action="lock", reason, trigger_type="automated", triggered_by="system", trustonic_status="success", performed_at timestamp. |
| **Result** | |
| **Notes** | Required for regulatory audit |

### UAT-S5-007: Payment While Device Locked

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Device locked, loan overdue |
| **Steps** | 1. Customer initiates overdue payment via WhatsApp<br>2. Process payment through EcoCash/OneMoney sandbox<br>3. Payment completes successfully |
| **Expected Result** | Payment accepted and processed normally despite device being locked. Payment amount covers at least the overdue installment. Balance updated. |
| **Result** | |
| **Notes** | Locked device must not prevent payment |

### UAT-S5-008: Automated Device Unlock After Payment

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S5-007 completed |
| **Steps** | 1. Verify automatic unlock triggered after payment confirmation<br>2. Check Trustonic unlock command<br>3. Verify device status<br>4. Verify customer notification |
| **Expected Result** | Trustonic unlock command sent and confirmed. Device lock_status changed to "unlocked". Unlock history record: action="unlock", trigger_type="payment", triggered_by="system". Customer receives WhatsApp notification: "Your device has been unlocked. Thank you for your payment!" |
| **Result** | |
| **Notes** | |

### UAT-S5-009: Manual Admin Override Unlock

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Device locked, admin logged into portal |
| **Steps** | 1. Admin navigates to device management in admin portal<br>2. Finds locked device<br>3. Initiates manual unlock with reason "Payment dispute resolved"<br>4. Confirms action |
| **Expected Result** | Device unlocked. Unlock record: trigger_type="manual", triggered_by=admin_user_id, reason provided. Requires double-confirmation (destructive action pattern). Audit log entry created. |
| **Result** | |
| **Notes** | Double-confirm for manual overrides per UI patterns |

### UAT-S5-010: Lock Notification Content Verification

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | UAT-S5-005 completed |
| **Steps** | 1. Review lock notification WhatsApp message content<br>2. Verify it includes: reason, how to pay, support contact |
| **Expected Result** | Message is empathetic, not punitive. Includes clear payment instructions. Support contact provided. No threatening language. Message in customer's selected language. |
| **Result** | |
| **Notes** | Financial inclusion principle: build trust, not fear |

---

## Scenario 6: Admin Dashboard Workflow (Loan Review, Approval)

**Objective:** Validate admin portal for loan management.
**Preconditions:** Admin account, pending/active loans in system.
**Test Data:** Admin user `uat-admin@lynia.co.zw`, loans in various statuses.

### UAT-S6-001: Admin Login

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Admin account created in Supabase Auth |
| **Steps** | 1. Navigate to staging admin portal URL<br>2. Enter credentials for `uat-admin@lynia.co.zw`<br>3. Submit login form |
| **Expected Result** | Successful authentication. Redirected to dashboard. JWT token stored. Session active. |
| **Result** | |
| **Notes** | |

### UAT-S6-002: Dashboard Overview

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S6-001 completed |
| **Steps** | 1. View main dashboard<br>2. Verify key metrics displayed<br>3. Check data freshness |
| **Expected Result** | Dashboard shows: active loans count, pending applications, total disbursed, collection rate, overdue count. Data refreshes within 30 seconds via Supabase subscriptions. Skeleton loading while data fetches. |
| **Result** | |
| **Notes** | FCP < 1.5s, TTI < 3s targets |

### UAT-S6-003: Loan Application List with Filters

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Multiple loans in various statuses |
| **Steps** | 1. Navigate to loan applications page<br>2. Filter by status: "review"<br>3. Search by customer name<br>4. Sort by date (newest first) |
| **Expected Result** | List displays all loan applications. Filters work correctly: only "review" status shown. Search finds matching customers. Sort order correct. Pagination works for large lists. |
| **Result** | |
| **Notes** | |

### UAT-S6-004: Loan Detail View

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S6-003 completed |
| **Steps** | 1. Click on a loan application in "review" status<br>2. View loan details<br>3. Review customer information<br>4. Review credit score breakdown |
| **Expected Result** | Detail view shows: customer name, phone (masked), national ID (masked), credit score with component breakdown, requested amount, calculated terms, KYC status. All money values formatted with USD and 2 decimal places with thousand separators. |
| **Result** | |
| **Notes** | Sensitive data masked: phone +263****567, ID 63-****78A90 |

### UAT-S6-005: Loan Approval Action

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Viewing loan in "review" status |
| **Steps** | 1. Click "Approve" button<br>2. Confirmation dialog appears<br>3. Confirm approval<br>4. Verify status update |
| **Expected Result** | Confirmation dialog: "Are you sure you want to approve this loan for $XXX.XX?" Upon confirmation: loan status changes to "approved". UI optimistically updates. Customer notified via WhatsApp. Audit log entry created with admin user ID. |
| **Result** | |
| **Notes** | |

### UAT-S6-006: Loan Rejection Action

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Viewing loan in "review" status |
| **Steps** | 1. Click "Reject" button<br>2. Rejection reason required (dropdown + freetext)<br>3. Enter reason: "Insufficient income verification"<br>4. Confirm rejection |
| **Expected Result** | Rejection requires reason (cannot submit without). Upon confirmation: loan status changes to "rejected". Rejection reason stored. Customer notified via WhatsApp with guidance on next steps. Double-confirmation required (destructive action). |
| **Result** | |
| **Notes** | Destructive action: requires double-confirm |

### UAT-S6-007: Status Indicators

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Loans in all statuses visible |
| **Steps** | 1. Verify color coding for each status on loan list |
| **Expected Result** | Pending = yellow. Approved = green. Rejected = red. Locked = orange. Active = blue. Completed = gray. Colors consistent across all views. |
| **Result** | |
| **Notes** | Per fintech UI patterns in CLAUDE.md |

### UAT-S6-008: Money Formatting

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Various amounts displayed |
| **Steps** | 1. Verify money formatting across dashboard<br>2. Check amounts > $1,000<br>3. Check small amounts |
| **Expected Result** | All amounts show: currency symbol ($), 2 decimal places, thousand separators. Examples: "$1,234.56", "$70.00", "$0.50". No raw numbers without formatting. |
| **Result** | |
| **Notes** | |

### UAT-S6-009: Date Formatting

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | Various dates displayed |
| **Steps** | 1. Verify recent dates show relative format<br>2. Verify older dates show absolute format |
| **Expected Result** | Recent: "2 hours ago", "Yesterday", "3 days ago". Older: "Feb 1, 2026", "Jan 15, 2026". Consistent across all views. |
| **Result** | |
| **Notes** | Per CLAUDE.md date formatting guidelines |

### UAT-S6-010: Responsive Layout - Tablet

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Android tablet available |
| **Steps** | 1. Access admin portal on tablet<br>2. Navigate through all major pages<br>3. Verify usability |
| **Expected Result** | All content readable. Navigation accessible. Tables scroll horizontally if needed. Buttons are tap-friendly (minimum 44x44px). No content clipped or overlapping. |
| **Result** | |
| **Notes** | Field agents use tablets |

### UAT-S6-011: Keyboard Navigation

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | Desktop browser |
| **Steps** | 1. Navigate loan list using Tab key<br>2. Open loan detail with Enter<br>3. Navigate actions with keyboard |
| **Expected Result** | All interactive elements reachable via keyboard. Focus indicators visible. Tab order logical. Actions triggerable with Enter/Space. |
| **Result** | |
| **Notes** | WCAG 2.1 AA requirement |

### UAT-S6-012: Data Export

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | Loan data available |
| **Steps** | 1. Click export button on loan list<br>2. Select CSV format<br>3. Download and verify<br>4. Repeat with PDF format |
| **Expected Result** | CSV: contains all visible columns, proper encoding, opens in Excel/Sheets. PDF: formatted table, includes generation timestamp, Lynia branding. Both exclude masked PII fields. |
| **Result** | |
| **Notes** | |

### UAT-S6-013: Payment History View

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Customer with payment history |
| **Steps** | 1. Navigate to customer detail<br>2. View payment history tab<br>3. Verify transaction list |
| **Expected Result** | All payments listed chronologically. Each shows: date, amount, type (deposit/installment), method (EcoCash/OneMoney), status, provider reference. Running balance shown. |
| **Result** | |
| **Notes** | |

### UAT-S6-014: Admin Logout

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Admin logged in |
| **Steps** | 1. Click logout<br>2. Attempt to access protected page<br>3. Verify redirect to login |
| **Expected Result** | Session cleared. JWT token removed. Attempting to access dashboard redirects to login. Back button does not show cached protected content. |
| **Result** | |
| **Notes** | Security requirement |

---

## Scenario 7: Distributor Device Inventory and Commission Tracking

**Objective:** Validate distributor dashboard for inventory and commission management.
**Preconditions:** Distributor account, devices assigned to distributor.
**Test Data:** Distributor `uat-distributor@lynia.co.zw`, 15 in_stock + 10 assigned devices.

### UAT-S7-001: Distributor Login

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Distributor account created |
| **Steps** | 1. Navigate to distributor dashboard URL<br>2. Login with distributor credentials<br>3. Verify dashboard loads |
| **Expected Result** | Successful authentication. Dashboard shows: total devices, in_stock count, assigned count, pending commissions. |
| **Result** | |
| **Notes** | |

### UAT-S7-002: Device Inventory Overview

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S7-001 completed |
| **Steps** | 1. Navigate to inventory page<br>2. Review device counts by status<br>3. Verify total matches seeded data |
| **Expected Result** | Inventory shows: in_stock (15), assigned (10), locked (count matches). Total count correct. Status breakdown with visual indicators. |
| **Result** | |
| **Notes** | |

### UAT-S7-003: Device Search by IMEI

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S7-002 completed |
| **Steps** | 1. Enter IMEI "123456789012345" in search<br>2. Verify result |
| **Expected Result** | Device found: Samsung Galaxy A14, 128GB, Black, in_stock, $350.00. Single result displayed with full details. |
| **Result** | |
| **Notes** | |

### UAT-S7-004: Device Search by Serial Number

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | UAT-S7-002 completed |
| **Steps** | 1. Enter serial "SN123456" in search<br>2. Verify result |
| **Expected Result** | Device found with matching serial number. Full device details displayed. |
| **Result** | |
| **Notes** | |

### UAT-S7-005: Inventory Filtering by Status

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | UAT-S7-002 completed |
| **Steps** | 1. Filter by "in_stock"<br>2. Verify only in_stock devices shown<br>3. Filter by "assigned"<br>4. Filter by "locked" |
| **Expected Result** | Each filter shows correct subset. Counts match filter results. Clear filter returns all devices. |
| **Result** | |
| **Notes** | |

### UAT-S7-006: Handover Initiation from Dashboard

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | In_stock device available, approved loan |
| **Steps** | 1. Navigate to handovers page<br>2. Click "New Handover"<br>3. Select customer/loan<br>4. Select device<br>5. Initiate handover |
| **Expected Result** | Handover form validates: customer has approved loan, deposit paid, device is in_stock. Handover created in "initiated" status. Distributor guided through verification steps. |
| **Result** | |
| **Notes** | |

### UAT-S7-007: Commission Tracking

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Completed handovers exist |
| **Steps** | 1. Navigate to commissions page<br>2. Verify commission list<br>3. Check calculation accuracy |
| **Expected Result** | Each completed handover has commission entry. Amount = 5% of device retail price. Status shown (pending/paid). Total pending commissions calculated. Running total displayed. |
| **Result** | |
| **Notes** | |

### UAT-S7-008: Commission History Export

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | Commission data available |
| **Steps** | 1. Click export on commissions page<br>2. Download CSV<br>3. Verify contents |
| **Expected Result** | CSV includes: handover date, customer name, device model, device price, commission amount, status. Totals row at bottom. |
| **Result** | |
| **Notes** | |

### UAT-S7-009: Distributor Profile

| Field | Value |
|-------|-------|
| **Priority** | LOW |
| **Precondition** | UAT-S7-001 completed |
| **Steps** | 1. Navigate to profile page<br>2. Verify distributor details |
| **Expected Result** | Shows: distributor name, region, contact, total handovers, total commissions earned. |
| **Result** | |
| **Notes** | |

---

## Scenario 8: Regulatory Report Generation

**Objective:** Validate RBZ-required report generation capabilities.
**Preconditions:** Sufficient transaction/loan data, compliance admin account.
**Test Data:** Admin `uat-compliance@lynia.co.zw`, 50+ payment transactions, 10+ active loans.

### UAT-S8-001: Loan Portfolio Summary Report

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Active, completed, and overdue loans in system |
| **Steps** | 1. Access report generation in admin portal<br>2. Select "Loan Portfolio Summary"<br>3. Set period: current month<br>4. Generate report |
| **Expected Result** | Report includes: total loans outstanding (count and amount), loans by status (active/review/completed/overdue), new disbursements this period, closed loans, collection rate, portfolio yield. All amounts in USD with proper formatting. |
| **Result** | |
| **Notes** | RBZ monthly reporting requirement |

### UAT-S8-002: Delinquency Report with PAR Buckets

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Loans with various overdue periods |
| **Steps** | 1. Generate delinquency report<br>2. Verify PAR bucket breakdown |
| **Expected Result** | Report shows Portfolio at Risk (PAR) buckets: 1-30 days, 31-60 days, 61-90 days, 90+ days. Each bucket shows: loan count, outstanding amount, percentage of portfolio. Write-offs, recoveries, provision amounts included. |
| **Result** | |
| **Notes** | |

### UAT-S8-003: KYC Compliance Report

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | KYC submissions with various outcomes |
| **Steps** | 1. Generate KYC compliance report<br>2. Set period: current quarter<br>3. Verify report data |
| **Expected Result** | Report includes: total verifications attempted, verification success rate, average processing time, verifications by type (national ID), high-risk customer count, documents by type. |
| **Result** | |
| **Notes** | Quarterly report per RBZ requirements |

### UAT-S8-004: Suspicious Transaction Report (STR) Generation

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | Customer with suspicious activity (unusual transaction patterns) |
| **Steps** | 1. Navigate to STR generation<br>2. Select customer with suspicious activity<br>3. Generate STR<br>4. Verify report contents<br>5. Submit to RBZ (mark as submitted) |
| **Expected Result** | STR includes: STR reference (format: STR-{timestamp}-{random}), customer ID and name, suspicious activity type, last 30 days of transactions, risk indicators, action taken. Report saved to regulatory_reports table. Submission tracked with timestamp. Generated within 24-hour window. |
| **Result** | |
| **Notes** | RBZ requires STR within 24 hours of detection |

### UAT-S8-005: Monthly Transaction Aggregate Report

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Payment transactions for current month |
| **Steps** | 1. Generate monthly transaction report<br>2. Set period: current month<br>3. Verify aggregations |
| **Expected Result** | Report includes: total transactions (count and volume), by payment method (EcoCash/OneMoney), by type (deposit/installment), success/failure rates, average transaction amount. |
| **Result** | |
| **Notes** | |

### UAT-S8-006: Report Data Accuracy Verification

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | UAT-S8-001 completed |
| **Steps** | 1. Query database directly for loan counts and amounts<br>2. Compare with generated report values<br>3. Verify no discrepancies |
| **Expected Result** | Report figures match database query results exactly. No rounding errors. No missing records. Count and sum totals match. |
| **Result** | |
| **Notes** | Financial accuracy is paramount |

### UAT-S8-007: Report Export

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Report generated |
| **Steps** | 1. Export report as PDF<br>2. Export report as CSV<br>3. Verify both formats |
| **Expected Result** | PDF: Formatted with Lynia branding, generation date, period, totals. CSV: Machine-readable, proper headers, all data fields present. Both include report reference number. |
| **Result** | |
| **Notes** | |

### UAT-S8-008: Report Lifecycle Tracking

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Report generated |
| **Steps** | 1. Verify report status is "generated"<br>2. Mark as "reviewed"<br>3. Mark as "submitted" to RBZ<br>4. Verify status transitions |
| **Expected Result** | Lifecycle: generated -> reviewed -> submitted -> archived. Each transition logged with timestamp and user. Submission timestamp recorded for compliance. |
| **Result** | |
| **Notes** | |

### UAT-S8-009: Record Retention Verification

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Database access |
| **Steps** | 1. Verify retention policies configured<br>2. Check: transactions = 7 years, KYC = 10 years, audit = 5 years<br>3. Verify record_retention_policies table |
| **Expected Result** | Retention policies exist in database for: payments (7yr), loans (7yr), kyc_submissions (10yr), audit_log (5yr), regulatory_reports (7yr), customer_consents (7yr). No auto-delete configured for records within retention period. |
| **Result** | |
| **Notes** | RBZ regulatory requirement |

### UAT-S8-010: Audit Trail for Report Generation

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | UAT-S8-001 through UAT-S8-005 completed |
| **Steps** | 1. Query audit_log for report generation events<br>2. Verify entries for each report generated |
| **Expected Result** | Audit log entries exist for each report: action="report.generate", user_id, report_type, period, timestamp. |
| **Result** | |
| **Notes** | |

---

## Cross-Scenario Validation Tests

### UAT-CS-001: Multi-Language Consistency

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Three test customers (English, Shona, Ndebele) |
| **Steps** | 1. Execute Scenario 1 steps 1-5 in English<br>2. Execute Scenario 1 steps 1-5 in Shona<br>3. Execute Scenario 1 steps 1-5 in Ndebele<br>4. Compare message quality |
| **Expected Result** | All three languages: grammatically correct, culturally appropriate, simple (8th-grade reading level), no English fallback in Shona/Ndebele flows. All action options present in all languages. |
| **Result** | |
| **Notes** | |

### UAT-CS-002: End-to-End Customer Journey (Full Flow)

| Field | Value |
|-------|-------|
| **Priority** | CRITICAL |
| **Precondition** | New test customer |
| **Steps** | 1. Onboard via WhatsApp (Scenario 1)<br>2. Apply for loan (Scenario 2)<br>3. Pay deposit (Scenario 3)<br>4. Receive device (Scenario 4)<br>5. Make 2 installment payments (Scenario 3)<br>6. Verify account status |
| **Expected Result** | Complete journey works without errors. Customer has: active loan, 2 paid installments, assigned device, accurate balance. All WhatsApp notifications received. |
| **Result** | |
| **Notes** | Most important integration test |

### UAT-CS-003: Error Message Quality

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | None |
| **Steps** | 1. Trigger each type of error (invalid input, unauthorized, not found)<br>2. Review error messages in WhatsApp and dashboards |
| **Expected Result** | All errors: use standardized error codes (SERVICE_CATEGORY_CODE format), include requestId for support, never expose stack traces or system internals, provide actionable guidance. WhatsApp errors: simple language, support contact option. |
| **Result** | |
| **Notes** | Error messages must not leak system information |

### UAT-CS-004: Concurrent Operations

| Field | Value |
|-------|-------|
| **Priority** | MEDIUM |
| **Precondition** | Multiple test users |
| **Steps** | 1. Two users simultaneously submit loan applications<br>2. Two distributors simultaneously initiate handovers<br>3. Verify no data conflicts |
| **Expected Result** | Both operations complete successfully. No cross-contamination of data. Each transaction has unique IDs. Database constraints prevent conflicts. |
| **Result** | |
| **Notes** | |

### UAT-CS-005: Session Security

| Field | Value |
|-------|-------|
| **Priority** | HIGH |
| **Precondition** | Admin portal access |
| **Steps** | 1. Login to admin portal<br>2. Copy JWT token<br>3. Logout<br>4. Attempt API call with expired/revoked token |
| **Expected Result** | After logout, token is invalidated. API calls with old token return 401. No cached data accessible. Rate limiting on failed auth attempts. |
| **Result** | |
| **Notes** | Security requirement |

---

## Test Case Summary

| Scenario | Test Cases | Critical | High | Medium | Low |
|----------|-----------|----------|------|--------|-----|
| S1: WhatsApp Onboarding | 12 | 8 | 3 | 0 | 1 |
| S2: Loan Application | 10 | 6 | 2 | 2 | 0 |
| S3: Payment Processing | 11 | 5 | 4 | 0 | 2 |
| S4: Device Handover | 10 | 5 | 3 | 2 | 0 |
| S5: Lock/Unlock Cycle | 10 | 4 | 4 | 1 | 1 |
| S6: Admin Dashboard | 14 | 4 | 5 | 4 | 1 |
| S7: Distributor Dashboard | 9 | 3 | 3 | 2 | 1 |
| S8: Regulatory Reports | 10 | 4 | 4 | 2 | 0 |
| CS: Cross-Scenario | 5 | 1 | 2 | 2 | 0 |
| **Total** | **91** | **40** | **30** | **15** | **6** |

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Engineering | Initial test cases for all 8 scenarios |
