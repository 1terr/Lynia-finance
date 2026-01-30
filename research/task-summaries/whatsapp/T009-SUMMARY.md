# T009: WhatsApp Conversation Flow - Research Summary

**Status:** ✅ Research Complete (Documentation-based)
**Date:** 2025-11-10
**GitHub Issue:** https://github.com/1terr/Lynia-finance/issues/12

---

## Executive Summary

The WhatsApp conversation flow defines the complete customer journey from first contact to loan disbursement. For Lynia Finance, this includes customer onboarding, KYC verification, credit assessment, loan offer, acceptance, and disbursement - all conducted via WhatsApp chat.

**Key Finding:** Conversational UI requires careful state management, clear prompts, and graceful error handling. Average loan application should complete in 5-10 minutes with 15-20 message exchanges.

---

## 1. Complete Conversation Flow Overview

### 1.1 Flow Summary

```
Step 1: Welcome & Discovery (1-2 messages)
   ↓
Step 2: Customer Onboarding (4-6 messages)
   ↓
Step 3: KYC Verification (2-4 messages)
   ↓
Step 4: Credit Assessment (automatic)
   ↓
Step 5: Loan Offer (2-3 messages)
   ↓
Step 6: Loan Acceptance & Disbursement (2-3 messages)
   ↓
Step 7: Active Loan Management (ongoing)
```

**Total Time:** 5-10 minutes
**Total Messages:** 15-25 exchanges
**Success Rate Target:** 70%+ completion rate

---

### 1.2 Conversation States

```javascript
const CONVERSATION_STATES = {
  // Initial states
  IDLE: 'idle',
  WELCOME: 'welcome',

  // Onboarding states
  ONBOARDING_NAME: 'onboarding_name',
  ONBOARDING_NATIONAL_ID: 'onboarding_national_id',
  ONBOARDING_PHONE_VERIFY: 'onboarding_phone_verify',
  ONBOARDING_INCOME: 'onboarding_income',
  ONBOARDING_EMPLOYMENT: 'onboarding_employment',
  ONBOARDING_EMPLOYER_NAME: 'onboarding_employer_name',

  // KYC states
  KYC_ID_PHOTO: 'kyc_id_photo',
  KYC_SELFIE: 'kyc_selfie',
  KYC_PROCESSING: 'kyc_processing',

  // Credit assessment
  CREDIT_ASSESSMENT: 'credit_assessment',

  // Loan offer states
  LOAN_OFFER_PRESENTED: 'loan_offer_presented',
  LOAN_OFFER_DETAILS: 'loan_offer_details',
  LOAN_OFFER_ACCEPTED: 'loan_offer_accepted',
  LOAN_OFFER_DECLINED: 'loan_offer_declined',

  // Disbursement states
  DISBURSEMENT_CONFIRM_DETAILS: 'disbursement_confirm_details',
  DISBURSEMENT_PROCESSING: 'disbursement_processing',
  DISBURSEMENT_COMPLETE: 'disbursement_complete',

  // Active loan states
  LOAN_ACTIVE: 'loan_active',

  // Error/support states
  ERROR: 'error',
  HUMAN_SUPPORT_REQUESTED: 'human_support_requested'
};
```

---

## 2. Step-by-Step Conversation Flow

### Step 1: Welcome & Discovery

**Trigger:** Customer sends first message (typically "Hi", "Hello", or "APPLY")

**Bot Response:**
```
👋 Welcome to Lynia Finance!

Get a device financing loan in minutes - no paperwork, no bank visits!

💰 Loan amounts: $200 - $500
📅 Repayment: 8 months
📱 100% on WhatsApp

Reply *APPLY* to start your application or *INFO* to learn more.
```

**Customer Options:**
- `APPLY` → Start application (go to Step 2)
- `INFO` → Show more information
- `HELP` → Show help menu

**State Transition:** `IDLE` → `WELCOME`

---

**If customer says INFO:**
```
*About Lynia Finance* 📱

We provide device financing to help you get the smartphone you need.

*How it works:*
1️⃣ Apply on WhatsApp (5 mins)
2️⃣ Get instant approval
3️⃣ Collect your device
4️⃣ Pay monthly via mobile money

*Loan Tiers:*
• $200 loan - $28/month for 8 months
• $350 loan - $49/month for 8 months
• $500 loan - $71/month for 8 months

Your tier depends on your credit score.

*Requirements:*
✅ Zimbabwe National ID
✅ Regular income
✅ Valid mobile money account

Reply *APPLY* when ready!
```

---

### Step 2: Customer Onboarding

#### 2.1 Collect Name

**Bot:**
```
Great! Let's get started. 🚀

First, what's your full name?

Example: John Doe
```

**State:** `ONBOARDING_NAME`

**Customer Input:** "John Doe"

**Validation:**
```javascript
function validateName(name) {
  // Trim whitespace
  name = name.trim();

  // Check length (2-100 characters)
  if (name.length < 2 || name.length > 100) {
    return { valid: false, error: 'Name must be 2-100 characters' };
  }

  // Check for at least 2 words (first and last name)
  const parts = name.split(/\s+/);
  if (parts.length < 2) {
    return { valid: false, error: 'Please provide both first and last name' };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  if (!/^[a-zA-Z\s\-']+$/.test(name)) {
    return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
  }

  return { valid: true, name: name };
}
```

**If Valid:**
```
Thanks John! 👋
```

**If Invalid:**
```
Please enter your full name (first and last name).

Example: John Doe
```

---

#### 2.2 Collect National ID

**Bot:**
```
Now I need your Zimbabwe National ID number.

Format: 63-123456-A-12

This helps us verify your identity and prevent fraud.
```

**State:** `ONBOARDING_NATIONAL_ID`

**Customer Input:** "63-1234567-A-12"

**Validation:**
```javascript
function validateNationalId(nationalId) {
  // Remove spaces and convert to uppercase
  nationalId = nationalId.trim().toUpperCase();

  // Check format: XX-XXXXXXX-L-XX
  const pattern = /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/;

  if (!pattern.test(nationalId)) {
    return {
      valid: false,
      error: 'Invalid format. Use: 63-123456-A-12'
    };
  }

  return { valid: true, nationalId: nationalId };
}

// Also check for duplicate
async function checkDuplicateNationalId(nationalId) {
  const existing = await db.customers.findByNationalId(nationalId);

  if (existing) {
    return {
      duplicate: true,
      customerId: existing.id
    };
  }

  return { duplicate: false };
}
```

**If Valid:**
```
✅ National ID verified: 63-1234567-A-12
```

**If Invalid Format:**
```
Invalid National ID format.

Please use this format: 63-123456-A-12

Example:
63-1234567-A-12
```

**If Duplicate:**
```
This National ID is already registered.

If you already have an account, reply *BALANCE* to check your loan status.

If you think this is an error, reply *SUPPORT* for help.
```

---

#### 2.3 Verify Phone Number

**Bot:**
```
Great! Now let's verify your phone number.

I'll send you a verification code.

Your number: 263771234567

Is this correct?

Reply *YES* to confirm or *NO* to change it.
```

**State:** `ONBOARDING_PHONE_VERIFY`

**Implementation:**
```javascript
async function sendVerificationCode(phone) {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in database with 10-minute expiry
  await db.verificationCodes.create({
    phone: phone,
    code: code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });

  // Send via SMS or WhatsApp
  await whatsapp.sendTextMessage(
    phone,
    `Your Lynia Finance verification code is: ${code}\n\nValid for 10 minutes.`
  );
}

async function verifyCode(phone, code) {
  const record = await db.verificationCodes.findLatest(phone);

  if (!record) {
    return { valid: false, error: 'No verification code found' };
  }

  if (new Date() > record.expiresAt) {
    return { valid: false, error: 'Code expired' };
  }

  if (record.code !== code) {
    return { valid: false, error: 'Invalid code' };
  }

  // Mark as verified
  await db.verificationCodes.markUsed(record.id);

  return { valid: true };
}
```

**If YES:**
```
📱 Verification code sent to 263771234567

Please enter the 6-digit code:
```

**Customer Input:** "123456"

**If Valid Code:**
```
✅ Phone verified!
```

**If Invalid Code:**
```
❌ Invalid code. Please try again.

Reply *RESEND* to get a new code.
```

---

#### 2.4 Collect Monthly Income

**Bot:**
```
What is your average monthly income? (in USD)

This helps us determine your loan amount.

Example: 250
```

**State:** `ONBOARDING_INCOME`

**Customer Input:** "300"

**Validation:**
```javascript
function validateIncome(incomeText) {
  // Remove currency symbols and commas
  const cleaned = incomeText.replace(/[$,\s]/g, '');

  // Parse as number
  const income = parseFloat(cleaned);

  if (isNaN(income)) {
    return { valid: false, error: 'Please enter a valid number' };
  }

  if (income < 50) {
    return {
      valid: false,
      error: 'Minimum income requirement: $50/month'
    };
  }

  if (income > 10000) {
    return {
      valid: false,
      error: 'Please enter your monthly income, not yearly'
    };
  }

  return { valid: true, income: income };
}
```

**If Valid:**
```
Monthly income: $300 ✅
```

**If Too Low:**
```
Sorry, we require a minimum monthly income of $50 to qualify.

If you think this is incorrect, please reply *SUPPORT*.
```

---

#### 2.5 Collect Employment Status

**Bot:**
```
What is your employment status?
```

**Interactive Message (3 buttons):**
```javascript
await whatsapp.sendReplyButtons(
  phone,
  'What is your employment status?',
  [
    { id: 'employed', title: 'Employed' },
    { id: 'self_employed', title: 'Self-Employed' },
    { id: 'other', title: 'Other' }
  ]
);
```

**State:** `ONBOARDING_EMPLOYMENT`

**Customer Selects:** "Employed"

---

#### 2.6 Collect Employer Name (if Employed)

**Bot:**
```
Who is your employer?

Example: ABC Company Ltd
```

**State:** `ONBOARDING_EMPLOYER_NAME`

**Customer Input:** "Zimbabwe Mining Corp"

**Validation:**
```javascript
function validateEmployerName(employer) {
  employer = employer.trim();

  if (employer.length < 2 || employer.length > 100) {
    return {
      valid: false,
      error: 'Employer name must be 2-100 characters'
    };
  }

  return { valid: true, employer: employer };
}
```

**If Valid:**
```
✅ Employer: Zimbabwe Mining Corp

Great! We have your basic information.
```

---

### Step 3: KYC Verification

#### 3.1 Request National ID Photo

**Bot:**
```
*Identity Verification* 🆔

To prevent fraud, we need to verify your identity.

Please take a clear photo of your National ID (front side) and send it here.

*Tips for a good photo:*
✅ Good lighting
✅ All text clearly visible
✅ No glare or shadows
✅ Entire ID in frame
```

**State:** `KYC_ID_PHOTO`

**Customer Sends:** Photo message

**Processing:**
```javascript
async function processNationalIdPhoto(phone, imageUrl) {
  try {
    // Download image
    const imageBuffer = await downloadImage(imageUrl);

    // Upload to S3 for storage
    const s3Key = `kyc/national-ids/${phone}/${Date.now()}.jpg`;
    await uploadToS3(s3Key, imageBuffer);

    // Optional: OCR to extract ID number
    const ocrResult = await performOCR(imageBuffer);
    const extractedId = extractNationalId(ocrResult.text);

    // Save to database
    await db.kycDocuments.create({
      phone: phone,
      documentType: 'national_id',
      s3Key: s3Key,
      extractedData: { nationalId: extractedId },
      status: 'pending_review'
    });

    return { success: true, extractedId: extractedId };
  } catch (error) {
    console.error('Failed to process ID photo:', error);
    return { success: false, error: error.message };
  }
}

// Simple OCR using Tesseract or AWS Textract
async function performOCR(imageBuffer) {
  // Using AWS Textract (example)
  const textract = new AWS.Textract();

  const result = await textract.detectDocumentText({
    Document: {
      Bytes: imageBuffer
    }
  }).promise();

  return {
    text: result.Blocks
      .filter(block => block.BlockType === 'LINE')
      .map(block => block.Text)
      .join('\n')
  };
}

function extractNationalId(text) {
  const pattern = /\b\d{2}-\d{6,7}-[A-Z]-\d{2}\b/;
  const match = text.match(pattern);
  return match ? match[0] : null;
}
```

**If Photo Received:**
```
✅ National ID photo received!

Verifying... ⏳
```

**If Verification Successful:**
```
✅ Identity verified!

ID Number: 63-1234567-A-12 (matches your entry)
```

**If Photo Quality Poor:**
```
❌ Photo quality too low

Please send a clearer photo:
• Better lighting
• All text visible
• No blur or glare
```

**If ID Doesn't Match:**
```
⚠️ The ID number in the photo (63-9876543-B-21) doesn't match what you entered (63-1234567-A-12).

Please check and send the correct ID photo, or reply *CORRECT* to update your ID number.
```

---

#### 3.2 Request Selfie

**Bot:**
```
*Selfie Verification* 📸

Now take a selfie holding your National ID next to your face.

This confirms you are the ID owner.

*Tips:*
✅ Face clearly visible
✅ ID clearly visible
✅ Good lighting
✅ Look at camera
```

**State:** `KYC_SELFIE`

**Customer Sends:** Selfie photo

**Processing:**
```javascript
async function processSelfiePhoto(phone, imageUrl) {
  try {
    // Download image
    const imageBuffer = await downloadImage(imageUrl);

    // Upload to S3
    const s3Key = `kyc/selfies/${phone}/${Date.now()}.jpg`;
    await uploadToS3(s3Key, imageBuffer);

    // Optional: Face detection/comparison
    // Using AWS Rekognition or similar
    const faceDetected = await detectFace(imageBuffer);

    // Save to database
    await db.kycDocuments.create({
      phone: phone,
      documentType: 'selfie',
      s3Key: s3Key,
      extractedData: { faceDetected: faceDetected },
      status: 'pending_review'
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**If Selfie Received:**
```
✅ Selfie received!

KYC verification complete! 🎉

Processing your credit assessment...
```

**State Transition:** `KYC_SELFIE` → `CREDIT_ASSESSMENT`

---

### Step 4: Credit Assessment (Automatic)

**Process (backend):**
```javascript
async function performCreditAssessment(customerId) {
  const customer = await db.customers.findById(customerId);

  // Calculate credit score based on various factors
  const score = await calculateCreditScore({
    income: customer.monthlyIncome,
    employment: customer.employmentStatus,
    phoneVerified: customer.phoneVerified,
    kycComplete: customer.kycComplete,
    // Additional factors from external data sources
    mobileMoneyHistory: await getMobileMoneyHistory(customer.phone),
    previousLoans: await getPreviousLoanHistory(customer.nationalId)
  });

  // Determine loan tier
  const tier = determineLoanTier(score.total);

  // Save assessment
  await db.creditAssessments.create({
    customerId: customerId,
    score: score.total,
    scoreBreakdown: score.breakdown,
    tier: tier,
    assessedAt: new Date()
  });

  return { score: score.total, tier: tier };
}

function determineLoanTier(score) {
  if (score >= 86) {
    return {
      name: 'High',
      loanAmount: 500,
      interestRate: 30,
      monthlyPayment: 70.53,
      productId: process.env.PRODUCT_ID_HIGH
    };
  } else if (score >= 71) {
    return {
      name: 'Medium',
      loanAmount: 350,
      interestRate: 35,
      monthlyPayment: 49.23,
      productId: process.env.PRODUCT_ID_MEDIUM
    };
  } else if (score >= 60) {
    return {
      name: 'Low',
      loanAmount: 200,
      interestRate: 40,
      monthlyPayment: 28.13,
      productId: process.env.PRODUCT_ID_LOW
    };
  } else {
    return null; // Not qualified
  }
}
```

**Processing Message (shown while calculating):**
```
⏳ Analyzing your application...

This takes about 30 seconds.
```

**State:** `CREDIT_ASSESSMENT`

---

### Step 5: Loan Offer

#### 5.1 Present Loan Offer

**If Approved (High Tier example):**
```
*🎉 Congratulations John!*

Your loan application has been *APPROVED*!

*Your Loan Offer:*

💰 *Loan Amount:* $500
📊 *Tier:* High (excellent credit!)
📅 *Repayment:* 8 months
💵 *Monthly Payment:* $70.53
📈 *Interest Rate:* 30% annual
💳 *Total Repayment:* $564.24

*First payment due:* 10 Dec 2025

Reply *ACCEPT* to proceed or *DETAILS* for more information.
```

**Interactive Buttons:**
```javascript
await whatsapp.sendReplyButtons(
  phone,
  'What would you like to do?',
  [
    { id: 'accept', title: 'Accept Offer ✅' },
    { id: 'details', title: 'More Details' },
    { id: 'decline', title: 'Decline' }
  ]
);
```

**State:** `LOAN_OFFER_PRESENTED`

---

**If Not Qualified:**
```
Thank you for your application, John.

Unfortunately, we're unable to offer you a loan at this time.

*Common reasons:*
• Income below minimum threshold
• Incomplete verification
• Credit history concerns

*What you can do:*
✅ Reapply in 30 days
✅ Build your mobile money history
✅ Ensure stable employment

Reply *SUPPORT* if you have questions.
```

**State:** `LOAN_OFFER_DECLINED` (terminal state)

---

#### 5.2 Show Loan Details (if requested)

**Customer Clicks:** "More Details"

**Bot:**
```
*Loan Details* 📋

*Loan Amount:* $500
Device financing for smartphone purchase

*Repayment Schedule:*
8 monthly payments of $70.53

Month 1: $70.53 (due 10 Dec)
Month 2: $70.53 (due 10 Jan)
Month 3: $70.53 (due 10 Feb)
... (full schedule on acceptance)

*Interest Breakdown:*
Principal: $500
Total Interest: $64.24
Total Repayment: $564.24

*Payment Methods:*
• EcoCash
• Omari
• Cash (at our office)

*Terms & Conditions:*
• Late payment fee: 5% per week after 7-day grace
• Early repayment: No penalty
• Device collection: Within 48 hours of disbursement

Read full terms: lynia.finance/terms

Reply *ACCEPT* to proceed or *DECLINE* to cancel.
```

---

#### 5.3 Accept Offer

**Customer Clicks:** "Accept Offer ✅"

**Bot:**
```
*Great choice, John!* 🎉

By accepting, you agree to:
✅ Repay $70.53 monthly for 8 months
✅ Pay via EcoCash or Omari
✅ Collect device within 48 hours

Reply *CONFIRM* to finalize or *BACK* to review.
```

**State:** `LOAN_OFFER_ACCEPTED`

**Customer:** "CONFIRM"

---

### Step 6: Disbursement

#### 6.1 Confirm Disbursement Details

**Bot:**
```
*Final Step!* ✅

Please confirm your details:

*Name:* John Doe
*National ID:* 63-1234567-A-12
*Phone:* 263771234567
*Loan Amount:* $500

*Device Collection:*
📍 Lynia Finance Office
123 Main Street, Harare
Mon-Fri: 9AM-5PM, Sat: 9AM-1PM

Is everything correct?

Reply *YES* to complete or *NO* to make changes.
```

**State:** `DISBURSEMENT_CONFIRM_DETAILS`

**Customer:** "YES"

---

#### 6.2 Create Loan in Fineract

**Backend Process:**
```javascript
async function createAndDisburseLoan(customerId) {
  const customer = await db.customers.findById(customerId);
  const assessment = await db.creditAssessments.findLatest(customerId);
  const tier = assessment.tier;

  try {
    // Step 1: Create client in Fineract
    const fineractClient = await fineract.createClient({
      officeId: 1,
      firstname: customer.firstname,
      lastname: customer.lastname,
      externalId: customer.nationalId,
      mobileNo: customer.phone,
      active: true,
      activationDate: formatDate(new Date()),
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });

    // Step 2: Create loan
    const fineractLoan = await fineract.createLoan({
      clientId: fineractClient.clientId,
      productId: tier.productId,
      principal: tier.loanAmount,
      loanTermFrequency: 8,
      loanTermFrequencyType: 2, // Months
      numberOfRepayments: 8,
      repaymentEvery: 1,
      repaymentFrequencyType: 2,
      interestRatePerPeriod: tier.interestRate / 12,
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyId: 1,
      loanType: 'individual',
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
      submittedOnDate: formatDate(new Date()),
      expectedDisbursementDate: formatDate(new Date())
    });

    // Step 3: Approve loan
    await fineract.approveLoan(fineractLoan.loanId, {
      approvedOnDate: formatDate(new Date()),
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });

    // Step 4: Disburse loan
    await fineract.disburseLoan(fineractLoan.loanId, {
      actualDisbursementDate: formatDate(new Date()),
      transactionAmount: tier.loanAmount,
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });

    // Step 5: Update database
    await db.loans.create({
      customerId: customerId,
      fineractLoanId: fineractLoan.loanId,
      fineractClientId: fineractClient.clientId,
      amount: tier.loanAmount,
      tier: tier.name,
      interestRate: tier.interestRate,
      monthlyPayment: tier.monthlyPayment,
      status: 'active',
      disbursedAt: new Date()
    });

    return {
      success: true,
      loanId: fineractLoan.loanId,
      loanNumber: `LYN${String(fineractLoan.loanId).padStart(6, '0')}`
    };
  } catch (error) {
    console.error('Failed to create loan:', error);
    return { success: false, error: error.message };
  }
}
```

---

#### 6.3 Disbursement Confirmation

**Bot:**
```
*🎉 Loan Approved & Disbursed!*

*Loan Number:* LYN000123
*Amount:* $500
*Status:* Active ✅

*Your Repayment Schedule:*

1st Payment: $70.53 on 10 Dec 2025
2nd Payment: $70.53 on 10 Jan 2026
... (continues for 8 months)

*Device Collection:*
Visit our office within 48 hours:
📍 123 Main Street, Harare
🕐 Mon-Fri: 9AM-5PM

Bring your National ID!

*Payment Details:*
EcoCash: Send to 123456
Omari: Code #550#

Reply *SCHEDULE* to view full payment schedule.
Reply *BALANCE* anytime to check your loan status.

Thank you for choosing Lynia Finance! 🇿🇼
```

**State:** `DISBURSEMENT_COMPLETE` → `LOAN_ACTIVE`

---

### Step 7: Active Loan Management

#### 7.1 Check Balance Command

**Customer:** "BALANCE"

**Bot:**
```
*Loan Balance* 📊

*Loan Number:* LYN000123
*Original Amount:* $500

*Current Status:*
💰 *Total Outstanding:* $423.18
📊 *Principal:* $393.97
📈 *Interest:* $29.21

*Next Payment:*
💵 Amount: $70.53
📅 Due: 10 Jan 2026
⏰ Days until due: 15

*Payments Made:* 1 of 8
*Last Payment:* $70.53 on 10 Dec 2025

Reply *SCHEDULE* for full payment schedule.
Reply *PAY* to make a payment.
```

---

#### 7.2 Payment Reminder (Automated)

**Sent 3 days before due date:**
```
*Payment Reminder* 📅

Hi John,

Your monthly payment is due soon!

💵 *Amount Due:* $70.53
📅 *Due Date:* 10 Jan 2026
⏰ *Days Left:* 3 days

*Pay via EcoCash:*
Send $70.53 to 123456

*Pay via Omari:*
Dial #550# and follow prompts

After paying, reply *PAID* with your transaction reference.

Questions? Reply *HELP*
```

---

#### 7.3 Overdue Payment Warning

**Sent 1 day after due date:**
```
*Payment Overdue* ⚠️

Hi John,

Your payment of $70.53 was due yesterday (10 Jan).

*Grace Period:* 7 days (no penalty)
*After Grace:* 5% late fee per week

💰 *Amount Due:* $70.53
📅 *Original Due:* 10 Jan 2026
⏰ *Days Overdue:* 1 day

Please pay today to avoid penalties.

*Pay via EcoCash:* 123456
*Pay via Omari:* #550#

Reply *HELP* if you need assistance.
```

---

#### 7.4 Payment Confirmation

**After customer pays and replies with transaction reference:**

**Customer:** "PAID ABC123456"

**Bot (processing):**
```
⏳ Verifying your payment...

Transaction: ABC123456
```

**After verification:**
```
*✅ Payment Received!*

Thank you, John!

💰 *Amount Paid:* $70.53
📅 *Payment Date:* 11 Jan 2026
🔖 *Reference:* ABC123456

*Updated Loan Status:*
💰 Remaining Balance: $352.65
📊 Payments Made: 2 of 8
📅 Next Payment: $70.53 on 10 Feb 2026

You're doing great! Keep it up! 🌟

Reply *BALANCE* anytime for updated status.
```

---

## 3. Error Handling & Edge Cases

### 3.1 Timeout Handling

**If customer goes silent for 10 minutes during onboarding:**
```
Hi John,

Are you still there? 👋

We saved your progress. Reply *CONTINUE* to pick up where you left off.

Or reply *START* to restart.
```

**If silent for 24 hours:**
```
Hi John,

Your application timed out, but we saved your progress!

Reply *CONTINUE* to resume your application, or *HELP* for assistance.
```

---

### 3.2 Invalid Input Handling

**Customer sends unrecognized command:**
```
I didn't understand that. 🤔

*Active Loan Commands:*
• *BALANCE* - Check your loan balance
• *PAY* - Make a payment
• *SCHEDULE* - View payment schedule
• *HELP* - Get help

Or just ask me a question!
```

---

### 3.3 Too Many Errors

**After 3 consecutive invalid inputs:**
```
I'm having trouble understanding. 😔

Let me connect you with a human agent.

⏳ Please wait...
```

**State:** `HUMAN_SUPPORT_REQUESTED`

---

### 3.4 System Error

**If backend error occurs:**
```
😔 Sorry, something went wrong on our end.

Our team has been notified and will fix this soon.

*Your Reference:* ERR-20251110-1234

Please try again in a few minutes, or reply *SUPPORT* to speak with our team.
```

---

### 3.5 Duplicate Application

**Customer tries to apply while having active application:**
```
You already have an application in progress!

*Status:* Awaiting National ID photo
*Started:* 2 hours ago

Reply *CONTINUE* to resume or *CANCEL* to start over.
```

---

## 4. Conversation Flow Diagram

```
┌─────────────────┐
│  Customer says  │
│  "Hi" or "APPLY"│
└────────┬────────┘
         ↓
┌─────────────────┐
│     WELCOME     │
│  Show overview  │
└────────┬────────┘
         ↓
    [Customer]
    says APPLY
         ↓
┌─────────────────┐
│  ONBOARDING     │
├─────────────────┤
│ 1. Name         │
│ 2. National ID  │
│ 3. Phone verify │
│ 4. Income       │
│ 5. Employment   │
│ 6. Employer     │
└────────┬────────┘
         ↓
┌─────────────────┐
│  KYC VERIFY     │
├─────────────────┤
│ 1. ID Photo     │
│ 2. Selfie       │
└────────┬────────┘
         ↓
┌─────────────────┐
│ CREDIT ASSESS   │
│  (automatic)    │
└────────┬────────┘
         ↓
    ┌────┴────┐
    │Score>=60?│
    └────┬────┘
     NO  │  YES
    ┌────┴────┐
    │         ↓
┌───┴───┐ ┌──────────┐
│DECLINE│ │LOAN OFFER│
│       │ │Present   │
└───────┘ └────┬─────┘
               ↓
          [Customer]
           ACCEPT?
               ↓YES
        ┌──────────┐
        │DISBURSE  │
        │Create    │
        │loan in   │
        │Fineract  │
        └────┬─────┘
             ↓
        ┌──────────┐
        │LOAN      │
        │ACTIVE    │
        │          │
        │•Balance  │
        │•Pay      │
        │•Support  │
        └──────────┘
```

---

## 5. Message Templates Summary

### Application Flow Templates

| Template Name | Purpose | Variables | Approval Status |
|---------------|---------|-----------|-----------------|
| `welcome_message` | First contact greeting | None | Pre-approved |
| `loan_approval` | Approved loan offer | name, tier, amount, monthly, rate | Required |
| `loan_decline` | Application declined | name | Required |
| `disbursement_confirm` | Loan disbursed | name, amount, loan_number, first_due | Required |

### Active Loan Templates

| Template Name | Purpose | Variables | Approval Status |
|---------------|---------|-----------|-----------------|
| `payment_reminder` | 3 days before due | name, amount, due_date, days_left | Required |
| `payment_overdue` | 1+ days overdue | name, amount, days_overdue, late_fee | Required |
| `payment_confirmed` | Payment received | name, amount, balance, next_due | Required |

### Support Templates

| Template Name | Purpose | Variables | Approval Status |
|---------------|---------|-----------|-----------------|
| `human_handoff` | Transfer to agent | name, wait_time | Pre-approved |
| `application_timeout` | Resume reminder | name, last_step | Pre-approved |
| `system_error` | Error message | error_ref | Pre-approved |

---

## 6. Performance Metrics

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Application Completion Rate | 70%+ | Applications started → completed |
| Average Completion Time | 5-10 min | First message → loan disbursed |
| Message Count per Application | 15-25 | Total messages exchanged |
| Drop-off Rate (Onboarding) | <15% | Drop-offs during data collection |
| Drop-off Rate (KYC) | <10% | Drop-offs during photo upload |
| Bot Response Time | <2 sec | Message received → response sent |
| First-Time Success Rate (KYC) | 80%+ | ID photos accepted first try |

### Tracking Implementation

```javascript
// Track application funnel
async function trackApplicationFunnel(customerId, stage, action) {
  await db.analytics.track({
    customerId: customerId,
    event: 'application_funnel',
    stage: stage,
    action: action, // 'enter', 'complete', 'drop_off'
    timestamp: new Date()
  });
}

// Usage
await trackApplicationFunnel(customer.id, 'onboarding_name', 'enter');
await trackApplicationFunnel(customer.id, 'onboarding_name', 'complete');

// Calculate funnel metrics
async function calculateFunnelMetrics() {
  const stages = [
    'welcome',
    'onboarding_name',
    'onboarding_national_id',
    'onboarding_income',
    'kyc_id_photo',
    'kyc_selfie',
    'loan_offer_presented',
    'disbursement_complete'
  ];

  const metrics = {};

  for (const stage of stages) {
    const entered = await db.analytics.count({
      stage: stage,
      action: 'enter'
    });

    const completed = await db.analytics.count({
      stage: stage,
      action: 'complete'
    });

    metrics[stage] = {
      entered: entered,
      completed: completed,
      completionRate: (completed / entered * 100).toFixed(2) + '%'
    };
  }

  return metrics;
}
```

---

## 7. Conversation Testing

### 7.1 Test Scenarios

```javascript
// test/conversation-flow.test.js

describe('Loan Application Conversation Flow', () => {

  describe('Happy Path', () => {
    it('should complete full application successfully', async () => {
      const testPhone = '263771234567';

      // Step 1: Welcome
      await simulateMessage(testPhone, 'APPLY');
      let response = await getLastBotResponse(testPhone);
      expect(response).toContain('Let\'s get started');

      // Step 2: Name
      await simulateMessage(testPhone, 'John Doe');
      response = await getLastBotResponse(testPhone);
      expect(response).toContain('Thanks John');

      // Step 3: National ID
      await simulateMessage(testPhone, '63-1234567-A-12');
      response = await getLastBotResponse(testPhone);
      expect(response).toContain('verified');

      // ... continue for all steps

      // Final: Should receive disbursement confirmation
      response = await getLastBotResponse(testPhone);
      expect(response).toContain('Loan Approved & Disbursed');
      expect(response).toContain('LYN');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid National ID format', async () => {
      const testPhone = '263771234567';

      await simulateMessage(testPhone, 'APPLY');
      await simulateMessage(testPhone, 'John Doe');
      await simulateMessage(testPhone, 'invalid-id');

      const response = await getLastBotResponse(testPhone);
      expect(response).toContain('Invalid National ID format');
      expect(response).toContain('63-123456-A-12');
    });

    it('should handle duplicate National ID', async () => {
      // Create existing customer
      await db.customers.create({
        nationalId: '63-1234567-A-12',
        phone: '263771111111'
      });

      const testPhone = '263772222222';
      await simulateMessage(testPhone, 'APPLY');
      await simulateMessage(testPhone, 'Jane Doe');
      await simulateMessage(testPhone, '63-1234567-A-12');

      const response = await getLastBotResponse(testPhone);
      expect(response).toContain('already registered');
    });
  });

  describe('Timeout Handling', () => {
    it('should send reminder after 10 minutes of inactivity', async () => {
      const testPhone = '263771234567';

      await simulateMessage(testPhone, 'APPLY');
      await simulateMessage(testPhone, 'John Doe');

      // Wait 10 minutes (simulate)
      await advanceTime(10 * 60 * 1000);

      const response = await getLastBotResponse(testPhone);
      expect(response).toContain('Are you still there');
      expect(response).toContain('CONTINUE');
    });
  });
});
```

---

## 8. Completion Checklist

- [x] Document complete conversation flow
- [x] Define all conversation states
- [x] Create step-by-step message scripts
- [x] Implement validation for each input
- [x] Design error handling messages
- [x] Create conversation flow diagram
- [x] Define message templates
- [x] Set performance metrics targets
- [x] Create testing scenarios

---

## 9. Mark as Complete

**Status:** ✅ **Research COMPLETE**

We have:
- ✅ Complete conversation flow (7 steps, 15-25 messages)
- ✅ All conversation states defined
- ✅ Message scripts for every scenario
- ✅ Input validation for all data points
- ✅ Error handling and edge cases
- ✅ Performance metrics and tracking
- ✅ Conversation flow diagram
- ✅ Testing scenarios

**Recommendation:** Mark GitHub issue #12 (T009) as **COMPLETE** and proceed to T010 (Document Message Templates).

---

**Research completed by:** Claude
**Date:** 2025-11-10
**Next:** T010 - Document WhatsApp message templates for all scenarios
