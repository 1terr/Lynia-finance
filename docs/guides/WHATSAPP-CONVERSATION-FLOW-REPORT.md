# LYNIA FINANCE — COMPLETE WHATSAPP CONVERSATION FLOW REPORT

---

## 1. WHATSAPP SERVICE ENTRY POINT & ROUTING

**Lambda Entry** (`services/whatsapp-service/src/index.ts`):
- `POST /whatsapp/send` — Outbound message sending
- `GET /whatsapp/webhook` — Meta webhook verification (hub.mode, hub.verify_token, hub.challenge)
- `POST /whatsapp/webhook` — Incoming messages & status updates

**Security**: HMAC-SHA256 signature validation via `META_APP_SECRET` on every incoming POST. Constant-time comparison to prevent timing attacks. Skipped only in dev.

**Message Router** (`services/whatsapp-service/src/message-router.ts`) — 8 layers applied in strict order:
1. **Deduplication** — check `whatsapp_message_id` already processed
2. **Rapid message detection** — 5 messages in 5 seconds triggers cooldown
3. **Input sanitization** — XSS/SQL injection patterns blocked
4. **Message length validation** — max 500 chars
5. **Inappropriate language check** — profanity filter
6. **Unexpected message type** — wrong type for current state (e.g., audio when expecting text)
7. **Global commands** — HELP, CANCEL, BACK, RESTART, SUPPORT, LANGUAGE
8. **Onboarding routing** — find/create customer, route to state handler

**Message Sender** (`services/whatsapp-service/src/message-sender.ts`):
- WhatsApp Cloud API v18.0
- Circuit breaker: 5 failures to open, 60s reset
- Failed messages queued to SQS for retry (max 3 attempts)
- Phone normalization: strips formatting, adds `263` prefix for Zimbabwe

---

## 2. COMPLETE STATE MACHINE — ALL STATES WITH EXACT MESSAGES

### STATE: `welcome`

**Bot sends (English):**
```
Welcome to Lynia Finance!

Get a smartphone today, pay over 6-8 months.

✅ No credit history needed
✅ Fast approval (<10 min)
✅ Flexible payment plans

Let's get started! What's your full name?
(as it appears on your National ID)

Example: *Tendai Mukanya Moyo*
```

**Bot sends (Shona):**
```
Mauya kuLynia Finance!

Tora smartphone nhasi, ubhadhare kwemwedzi 6-8.

✅ Hapana credit history inodiwa
✅ Kupihwa nekukurumidza (<10 min)
✅ Payment plans dzinochinjika

Ngatitangei! Zita rako rizere ndiani?
(sezvazviri paID yeNational)

Muenzaniso: *Tendai Mukanya Moyo*
```

**Bot sends (Ndebele):**
```
Siyalemukela kuLynia Finance!

Thola i-smartphone lamuhla, ubhadale ngenyanga ezingu 6-8.

✅ Kakudingi i-credit history
✅ Ukuphathwa ngokushesha (<10 min)
✅ Amapulani okubhadala atshintshekayo

Asiqaleni! Ibizo lakho eligcweleyo ngubani?
(njengoba libhalwe ku-ID yakho)

Isibonelo: *Tendai Mukanya Moyo*
```

**Non-Zimbabwean number rejection:**
```
❌ *Service Not Available*

We currently only serve customers with Zimbabwean phone numbers (+263).

We will notify you when we expand to your country!
```
Logs to `international_interest` table.

**Transition:** `welcome` → `collecting_personal_info`

---

### STATE: `collecting_personal_info`

Collects 4 fields sequentially (checks which is `undefined` in session data):

**Sub-step 1 — Full Name** (already prompted in welcome)
- Validation: 2-5 words
- Error: `Please provide your full name (2-5 words). Example: *Tendai Mukanya Moyo*`

**Sub-step 2 — Date of Birth:**
```
What is your date of birth?

Format: *DD/MM/YYYY*
Example: *15/03/1990*
```
- Validation: DD/MM/YYYY regex, age 18-75
- Error: `Invalid date format. Please use DD/MM/YYYY`

**Sub-step 3 — Gender:**
```
What is your gender?

Reply:
1 - Male
2 - Female
3 - Other
```
- Accepts: "male", "female", "other", "1", "2", "3"

**Sub-step 4 — Location:**
```
What city or town do you live in?

Examples: *Harare*, *Bulawayo*, *Mutare*
```
- Validation: min 2 characters

**Transition message:**
```
✅ *Personal Info Complete!*

Now let us talk about your income.

What type of work do you do?

Examples:
• Formal employment
• Self-employed
• Informal trader
• Driver (Uber/Bolt)
```

**Transition:** `collecting_personal_info` → `collecting_employment`

---

### STATE: `collecting_employment`

Collects 4 fields sequentially:

**Sub-step 1 — Employment Type** (already prompted)

**Sub-step 2 — Monthly Income:**
```
What is your average monthly income (in USD)?

Please enter a number:
Example: *350*
```
- Validation: number > 0, minimum $50
- Error: `Please enter a valid number for your monthly income.`

**Sub-step 3 — Existing Debts:**
```
Do you have any existing debts? (loans, rent, etc.)

Enter monthly amount in USD, or *0* if none.
```

**Sub-step 4 — Household Size:**
```
How many people live in your household?
(including yourself)

Example: *3*
```
- Validation: integer 1-20
- Auto-calculates: `dependents = max(0, household - 1)`

**Transition message:**
```
✅ *Income Info Complete!*

What would you like to apply for?

1 - Smartphone Financing 📱
2 - Digital Credit 💰 (Coming Soon)
```

**Transition:** `collecting_employment` → `product_selection`

---

### STATE: `product_selection`

**Option 1 selected (smartphone):**
```
📱 *Smartphone Financing Selected!*

Perfect! We will assess your eligibility and show you available devices.

First, we need to verify your identity.

🪪 *Step 1: Enter your National ID number*

Please type your National ID number:
Format: *XX-XXXXXXX-X-XX*
Example: *63-2345678-B-08*
```
Sets `selected_product: 'smartphone'`, `requested_loan_amount: 250`

**Option 2 (digital credit):**
```
💰 *Digital Credit Coming Soon!*

We are launching digital credit soon.

For now, you can apply for smartphone financing.

Reply *Yes* to continue
```

**Transition:** `product_selection` → `kyc_id_upload`

---

### STATE: `kyc_id_upload`

Accepts both text AND image (the only `any`-type state).

**Sub-step 1 — National ID Number (text input):**

Validation regex: `^(\d{2})(\d{6,7})([A-Z])(\d{2})$` after stripping all dash variants.

Error:
```
Invalid ID number format.

Please enter your National ID number:
Format: *XX-XXXXXXX-X-XX*
Example: *63-2345678-B-08*
```

Success:
```
✅ *ID Number Received!*

📸 *Now send a photo of your National ID*

Tips for a clear photo:
✅ Place ID on flat surface
✅ Good lighting, no shadows
✅ All text visible
✅ Hold phone steady

*Send photo now*
```

**Sub-step 2 — ID Photo (image input):**

Success:
```
✅ *ID Photo Received!*

📸 *Step 2: Take a Selfie*

This helps us match your face to your ID.

Tips:
✅ Face the camera directly
✅ Remove sunglasses/hat
✅ Good lighting on face
✅ Neutral expression

🔒 Your privacy matters - we never share your photos.

*Send selfie now*
```

**Transition:** `kyc_id_upload` → `kyc_selfie_upload`

---

### STATE: `kyc_selfie_upload`

Expected input: **image only**

Wrong type response:
```
Please send a clear selfie.

Make sure:
✅ Your face is clearly visible
✅ Looking directly at camera
✅ Good lighting
✅ No sunglasses or hat

*Send selfie now*
```

**On image received — full processing:**
1. Downloads both images from WhatsApp Cloud API as base64
2. Calls `POST /kyc/initiate` with customer_id, id_number, id_image_base64, selfie_image_base64, name, DOB, phone

**If KYC verified synchronously:**
```
✅ *Identity Verified!*

Great news! Your identity has been confirmed.

⏳ *Assessing your eligibility...*

We're calculating your loan amount based on:
✓ Identity verification
✓ Income information
✓ First-time borrower status

This takes about 10 seconds...
```
→ `credit_scoring`

**If KYC rejected (retries remaining):**
```
❌ *Verification Unsuccessful*

{reason}

You have {N} attempts remaining.

Please enter your National ID number to try again:
Format: *XX-XXXXXXX-X-XX*
```
→ `kyc_id_upload` (clears photos, increments retry_count)

**If KYC rejected (0 retries, max 3):**
```
❌ *Verification Failed*

You have used all 3 verification attempts.

Please contact support for assistance: support@lynia.finance
```
→ `rejected`

**If KYC async:**
```
⏳ *Verifying Your Identity...*

Your documents have been submitted for verification.

This usually takes 1-5 minutes. We'll message you as soon as it's complete.

Please wait...
```
→ `kyc_processing`

---

### STATE: `kyc_processing`

If customer messages while waiting, checks DB for result:
- Verified → transitions to `credit_scoring`
- Rejected → retry logic
- Still pending:
```
⏳ *Still Verifying...*

Your identity verification is being processed.

This usually takes 1-5 minutes. We'll message you as soon as it's complete.

Please wait a bit longer.
```

For `manual_review`:
```
⏸️ *Manual Review Required*

Your verification needs additional review by our team. This typically takes 2-12 hours.

You'll receive a WhatsApp message when complete.
```

---

### STATE: `credit_scoring`

Calls `POST /scoring/calculate` with:
- customer_id, monthly_income_usd, existing_debt_obligations_usd
- household_size, dependents, requested_loan_amount
- kyc_result (from latest KYC submission)

**On approve:**
```
🎉 *Congratulations! You're Approved!*

Your Loan Details:
💰 *Loan Limit:* $500
🏆 *Credit Tier:* Tier 2
📊 *Credit Score:* 620/850

You can now choose a smartphone up to $500.

📱 *Available Devices:*
• Samsung A15 - $180
• Tecno Spark 20 - $150
• Infinix Note 30 - $195

*Payment Plan:*
• 6 months installments
• 20% down payment
• 4% APR

Ready to continue?
Reply *Yes* to see loan terms
```

**On review:**
```
⏸️ *Manual Review Required*

We need to manually review your application. This takes up to 24 hours.

You'll receive a WhatsApp message when ready.

Our team will review:
• Income information
• Identity verification
• Eligibility criteria

Usually takes 2-12 hours.
```

**On reject:**
```
❌ *Application Not Approved*

Unfortunately, we cannot approve your application at this time.

Possible reasons:
• Income below minimum threshold
• Debt-to-income ratio too high
• Incomplete information

You can try again in 30 days or contact support: support@lynia.finance
```

**Transition:** `credit_scoring` → `loan_offer`

---

### STATE: `loan_offer`

On "yes"/"continue":

**Calculation:**
```
downPayment = round(creditLimit * downPaymentPct / 100)
financed = creditLimit - downPayment
monthlyPayment = round((financed * (1 + APR/100)) / 6)
```

**Message:**
```
📄 *Loan Terms & Conditions*

Before we proceed, please review:

1. You'll make 6-12 monthly payments
2. Device will be locked if payment is missed
3. Device unlocks after final payment
4. No early repayment penalties
5. 20% down payment required

*Your Loan Details:*
• Maximum: $500
• Term: 6-12 months
• Interest rate: 4% APR
• Monthly payment: ~$69
• Down payment: $100 (20%)

Do you accept these terms?

Reply *I Accept* to continue
```

**Transition:** `loan_offer` → `terms_acceptance`

---

### STATE: `terms_acceptance`

On "accept"/"i accept":
- Logs consent to `customer_consents` table
- Calculates deposit amount

**Message:**
```
✅ *Application Approved!*

Congratulations! Your loan application is approved.

*Step 1: Pay Your Deposit*
💵 Amount: $100 USD (20% of $500)

*How to pay:*
• EcoCash: Dial *151*2*1# and pay to merchant code *LYNIA*
• OneMoney: Dial *111# and pay to merchant *LYNIA*
• InnBucks: Send to LYNIA in the InnBucks app

Use your phone number as reference.

*Step 2: Visit a Distributor (after deposit is confirmed)*
We'll send you a confirmation message once your deposit is received. Then visit:

📍 *Tech Hub Harare*
   123 Jason Moyo Ave, Harare
   Mon-Sat, 9am-6pm

*What to bring:*
✅ Your National ID
✅ This phone (for verification)
✅ Deposit payment confirmation

Welcome to Lynia Finance! 🎉
```

**Transition:** `terms_acceptance` → `completed`

---

### STATE: `completed`

```
You've already completed onboarding!

Your application is approved. Visit your nearest distributor to collect your device.

Need help? Reply *Support*
```

Loan management commands now activate (BALANCE, HISTORY, SCHEDULE, DEVICE, EXTENSION, UPDATE, HELP).

---

## 3. GLOBAL COMMANDS & ERROR HANDLING

| Command | Response |
|---------|----------|
| **HELP** | Lists all available commands |
| **CANCEL** | Pauses application, saves progress for 48h, resets to welcome |
| **BACK** | Returns to previous state in flow |
| **RESTART** | Clears session, starts over |
| **SUPPORT** | `Connecting you with support... A human agent will respond within 5 minutes.` |
| **LANGUAGE** | Offers English/Shona/Ndebele selection |

**Error responses:**
- Rapid messages: `I received multiple messages from you. Please send one message at a time.`
- Suspicious input (XSS/SQL): `For security reasons, your session has been paused.`
- Inappropriate language: `Please keep the conversation professional.`
- Message too long: `That message was quite long! Please keep your answer short and simple.`
- Wrong type (audio when expecting text): `I received your voice message, but I need a text reply.`
- Max retries (3): `Let me connect you with a human agent who can help.`

---

## 4. PRODUCT CATALOG

| Device | Price (USD) |
|--------|-------------|
| Samsung A15 | $180 |
| Tecno Spark 20 | $150 |
| Infinix Note 30 | $195 |

---

## 5. CREDIT SCORING — COMPLETE FORMULA

**Score range:** 300-850 (scaled from 0-1000 raw)
**Formula:** `scaled = 300 + (raw / 1000) x 550`

### 5 Components (Smartphone):

| Component | Weight | Max Points |
|-----------|--------|------------|
| Affordability | 30% | 300 |
| Repayment Willingness | 25% | 250 |
| Mobile Money Activity | 20% | 200 |
| External Credit | 15% | 150 |
| KYC Verification | 10% | 100 |

### Component 1: Affordability (0-300)

**DTI Ratio** (150 pts): `totalObligations / income`

| DTI | Points |
|-----|--------|
| <= 30% | 150 |
| <= 40% | 120 |
| <= 50% | 80 |
| <= 60% | 40 |
| > 60% | 0 |

**Income Level** (100 pts):

| Income | Points |
|--------|--------|
| >= $500 | 100 |
| >= $300 | 75 |
| >= $150 | 50 |
| >= $100 | 25 |
| < $100 | 0 |

**Household Stress** (50 pts): `income / household_size`

| Per Person | Points |
|-----------|--------|
| >= $100 | 50 |
| >= $75 | 35 |
| >= $50 | 20 |
| < $50 | 10 |

### Component 2: Repayment Willingness (0-250)
- First-time customers: **125** (neutral)
- Returning: based on on-time rate (0-150), bill consistency (0-50), communication responsiveness (0-50)

### Component 3: Mobile Money Activity (0-200)
- No data: **100** (neutral)
- With data: account age (0-40), monthly inflow (0-70), transaction frequency (0-40), airtime purchases (0-30), balance (0-20)

### Component 4: External Credit (0-150)
- No data: **75** (neutral)
- With data: credit bureau score (0-80), platform integration (0-40), bank account (0-30)

### Component 5: KYC Verification (0-100)
- ID verified: 50 pts
- Face match >= 95: 35 pts (>= 85: 25, >= 75: 15)
- Liveness passed: 15 pts

### Decision Thresholds

| Score | Decision | Tier | Limit | Down Payment | APR |
|-------|----------|------|-------|-------------|-----|
| 650-850 | approve | Tier 3 | $2,000 | 10% | 3% |
| 500-649 | approve | Tier 2 | $500 | 20% | 4% |
| 350-499 | approve | Tier 1 | $200 | 30% | 5% |
| 300-349 | review | Manual | $0 | -- | -- |
| < 300 | reject | -- | $0 | -- | -- |

---

## 6. LOAN CALCULATIONS — WORKED EXAMPLES

**Formula:** `monthlyPayment = round((financed x (1 + APR/100)) / 6)`

| | Tier 1 | Tier 2 | Tier 3 |
|---|--------|--------|--------|
| Limit | $200 | $500 | $2,000 |
| Down payment | $60 (30%) | $100 (20%) | $200 (10%) |
| Financed | $140 | $400 | $1,800 |
| With interest | $147 | $416 | $1,854 |
| Monthly x 6 | **$25** | **$69** | **$309** |
| Total cost | $207 | $516 | $2,054 |
| Interest paid | $7 | $16 | $54 |

---

## 7. PAYMENT / DEPOSIT FLOW

**Gateways:** EcoCash (default, ~70% market), OneMoney, O'mari, InnBucks

**RBZ Limits:** Single $2,000 | Daily $5,000 | Monthly $50,000

**Payment state machine:** `pending` → `held` → `processing` → `completed`/`failed`

**Two-phase commit:** PREPARE (reserve) → COMMIT (finalize). On failure: release.

**Deposit confirmation triggers:**
1. Update loan: `deposit_paid = true`, `status = 'paid_deposit'`
2. WhatsApp notification to customer
3. Queue loan status update via SQS

**EcoCash payment instructions:**
```
💰 *EcoCash Payment Instructions*

1. Dial *151#
2. Select option 4 (Make Payment)
3. Select option 3 (Merchant)
4. Enter merchant code: *{merchant_id}*
5. Enter amount: *${amount}*
6. Enter your PIN

After payment: Reply with your EcoCash reference number
```

---

## 8. DEVICE HANDOVER FLOW

### Readiness Checks
1. Loan status = `paid_deposit`
2. Deposit paid = true
3. KYC verified
4. Device assigned and `in_stock`

### 5-Step Handover Process
1. **Initiate** — create handover record
2. **Verify Identity** — match presented ID number against KYC submission
3. **Verify Deposit** — confirm completed deposit payment exists
4. **Device Inspection** — record screen/body condition, buttons, ports, cameras, connectivity
5. **Complete** — activate loan, assign device, record commission

### On Completion
- Loan status → `active`
- Device status → `assigned`
- Agent inventory → `sold`
- First payment date = handover + 30 days
- Distributor commission = 5% of principal (default, configurable)

**Handover confirmation message:**
```
🎉 *Device Handover Complete!*

You've received your Samsung A15

*Loan Details*:
Amount Financed: $400.00
Monthly Payment: $69.00
First Payment Due: April 4, 2026

*Payment Instructions*:
You'll receive payment reminders 3 days before your due date.

Welcome to Lynia Finance! 💚
```

### Device Locking
- Trigger: 7+ days overdue
- Grace period: 3 additional days (total 10 days)
- Lock warning sent 3 days before lock
- Emergency calls always available (999, 994, 993, 112)
- Auto-unlock on payment

---

## 9. FINERACT INTEGRATION

### Sync Points
1. **Customer creation** → `syncCustomerToFineract()` — creates Fineract client
2. **Loan approval** → `syncLoanToFineract()` — creates loan application
3. **Loan approval** → `approveLoanInFineract()` — approves in Fineract
4. **Device handover** → `disburseLoanInFineract()` — marks disbursed
5. **Each payment** → `syncRepaymentToFineract()` — posts repayment

### Product Mapping

| Tier | Fineract Product ID | Code |
|------|-------------------|------|
| Tier 1 | 1 | LT1E |
| Tier 2 | 2 | LT2S |
| Tier 3 | 3 | LT3P |

Interest rate conversion: `APR / 12` = monthly rate for Fineract

### Interop (Optional, feature-flagged)
Two-phase transfers via Mojaloop: PREPARE (reserve) → COMMIT (finalize)

---

## 10. POST-ONBOARDING LOAN COMMANDS

| Command | Aliases | Description |
|---------|---------|-------------|
| **BALANCE** | bal, check, owe | Current balance, next payment date/amount |
| **HISTORY** | payments, paid | Last 5 payments with status icons |
| **SCHEDULE** | plan, dates | Full 6-month payment schedule |
| **DEVICE** | phone, lock, status | Device lock status and IMEI |
| **EXTENSION** | extend, delay | Request 7-day extension (max 2 per loan, $2 fee) |
| **UPDATE** | change, edit | Update phone/email/address |
| **HELP** | menu, commands, ? | List all commands |

Rate limited: 10 commands per hour. Fuzzy matching with Levenshtein distance <= 2.

---

## 11. CONFIGURATION SUMMARY

| Parameter | Value |
|-----------|-------|
| Session timeout | 30 minutes |
| Progress saved | 48 hours |
| KYC max retries | 3 |
| Supported languages | English, Shona, Ndebele |
| Loan term | 6 months |
| First payment | Handover + 30 days |
| Early repayment penalty | None |
| Max extensions | 2 per loan |
| Extension duration | 7 days |
| Extension fee | $2 |
| Lock trigger | 7 days overdue |
| Lock grace period | 3 more days |
| Default commission | 5% of principal |
| Circuit breaker | 5 failures / 60s reset |
| WhatsApp API | v18.0 |
| Message max length | 500 chars |
