# Test Onboarding Flow - Complete Journey

This document outlines the complete test flow for customer onboarding.

## Test Scenario: First-Time Customer (Successful Application)

**Customer**: Tendai Moyo
**Phone**: +263 77 123 4567
**Expected Outcome**: Tier 1 Approval ($200 limit)

### Message Flow

**Step 1: Welcome**
```
Customer: Hi
Bot: 👋 Welcome to Lynia Finance!
     Get a smartphone today, pay over 6-8 months.
     ✅ No credit history needed
     ✅ Fast approval (<10 min)
     ...
     What's your full name? (as it appears on your National ID)
```

**Step 2: Collect Name**
```
Customer: Tendai Mukanya Moyo
Bot: Great, Tendai! 👍
     Now, what's your date of birth?
     Format: DD/MM/YYYY
```

**Step 3: Collect DOB**
```
Customer: 15/03/1990
Bot: Perfect! Now, what's your gender?
     1️⃣ Male
     2️⃣ Female
     3️⃣ Other
```

**Step 4: Collect Gender**
```
Customer: 1
Bot: Great! What city/town do you live in?
     Examples: Harare, Bulawayo, Chitungwiza
```

**Step 5: Collect Location**
```
Customer: Harare
Bot: ✅ Personal Info Complete!
     Now let's talk about your income...
     What type of work do you do?
```

**Step 6: Collect Employment Type**
```
Customer: Self-employed
Bot: Got it! What's your average monthly income (in USD)?
     Please enter a number: Example: 350
```

**Step 7: Collect Income**
```
Customer: 350
Bot: Do you have any existing debt obligations?
     Enter monthly amount in USD, or type 0 if none
```

**Step 8: Collect Debts**
```
Customer: 50
Bot: How many people live in your household?
     Example: 3
```

**Step 9: Collect Household Size**
```
Customer: 3
Bot: ✅ Income Info Complete!
     What would you like to apply for?
     1️⃣ Smartphone Financing 📱
     2️⃣ Digital Credit 💰 (Coming Soon)
```

**Step 10: Product Selection**
```
Customer: 1
Bot: 📱 Smartphone Financing Selected!
     First, we need to verify your identity.
     📸 Step 1: Upload your National ID
```

**Step 11: ID Upload**
```
Customer: [Sends image]
Bot: ✅ ID Photo Received!
     📸 Step 2: Take a Selfie
```

**Step 12: Selfie Upload**
```
Customer: [Sends image]
Bot: ✅ Identity Verified!
     ⏳ Assessing your eligibility...
```

**Step 13: Credit Scoring (Automatic)**
```
Bot: 🎉 Congratulations! You're Approved!
     Your Loan Details:
     💰 Loan Limit: $200
     🏆 Credit Tier: Tier 1
     📊 Credit Score: 680/850

     Ready to continue? Reply Yes
```

**Step 14: Loan Offer Acceptance**
```
Customer: Yes
Bot: 📄 Loan Terms & Conditions
     1. You'll make 6-8 monthly payments
     2. Device will be locked if payment is missed
     ...
     Do you accept these terms? Reply I Accept
```

**Step 15: Terms Acceptance**
```
Customer: I Accept
Bot: ✅ Onboarding Complete!
     Next Steps:
     1. Visit a Lynia distributor
     2. Choose your device
     3. Pay deposit ($20 USD)
     ...
```

## Test Cases

### 1. Valid Zimbabwe Phone Numbers
- `+263 77 123 4567` ✅
- `263771234567` ✅
- `0771234567` ✅

### 2. Invalid Phone Numbers
- `+1 555 123 4567` ❌ (Non-Zimbabwean)
- `263791234567` ❌ (Invalid prefix)
- `77123` ❌ (Too short)

### 3. Age Validation
- DOB: `01/01/2010` (Age 15) ❌ Too young
- DOB: `15/03/1990` (Age 35) ✅ Valid
- DOB: `01/01/1940` (Age 85) ❌ Too old

### 4. Income Validation
- Income: `30` ❌ Below minimum ($50)
- Income: `350` ✅ Valid
- Income: `abc` ❌ Invalid format

### 5. Credit Scoring Outcomes

**Tier 1 Approval (Score: 650-699)**
- Income: $200-350
- Debts: <$100
- Household: 2-4 people
- Expected: $200 limit

**Tier 2 Approval (Score: 700-749)**
- Income: $400-600
- Debts: <$100
- Previous loans: 1-2 paid
- Expected: $350 limit

**Tier 3 Approval (Score: 750+)**
- Income: $600+
- Debts: <$150
- Previous loans: 3+ paid
- Platform verified
- Expected: $500 limit

**Manual Review (Score: 550-649)**
- Income: $150-200
- High debt ratio
- Expected: 24h review period

**Rejection (Score: <550)**
- Income: <$100
- Debt ratio >60%
- Expected: Application denied

## Session Management Tests

### Test: Session Timeout
```
Customer: Hi
Bot: Welcome message...
[Wait 31 minutes]
Customer: Tendai Moyo
Bot: Starts new session (timeout occurred)
```

### Test: Session Resume
```
Customer: Hi
Bot: Welcome message, asks for name
Customer: Tendai Moyo
Bot: Asks for DOB
[Customer leaves for 10 minutes]
Customer: 15/03/1990
Bot: Continues from DOB (session active)
```

### Test: Restart Command
```
Customer: [Mid-flow] Restart
Bot: Resets to welcome screen
```

## Error Handling Tests

### Test: Invalid Input
```
Customer: My name is X
Bot: Please provide full name (2-5 words)
```

### Test: Image Processing Error
```
Customer: [Sends corrupted image]
Bot: Please send a clear photo...
```

### Test: Credit Scoring Service Down
```
Bot: Applies fallback scoring
Bot: Returns basic approval for testing
```

## Performance Metrics

- **Average Time to Complete**: 8-12 minutes
- **Drop-off Points**: ID upload (15%), Selfie upload (10%)
- **Approval Rate Target**: >70%
- **Session Timeout Rate**: <5%

## Database State After Completion

**whatsapp_onboarding_sessions**:
```json
{
  "phone_number": "263771234567",
  "current_state": "completed",
  "state_data": {
    "full_name": "Tendai Mukanya Moyo",
    "date_of_birth": "15/03/1990",
    "gender": "male",
    "location": "Harare",
    "employment_type": "Self-employed",
    "monthly_income_usd": 350,
    "existing_debt_obligations_usd": 50,
    "household_size": 3,
    "dependents": 2,
    "selected_product": "smartphone",
    "requested_loan_amount": 250,
    "kyc_status": "verified",
    "credit_score": 680,
    "credit_tier": "Tier 1",
    "credit_limit_usd": 200,
    "decision": "approve"
  }
}
```

**customers**:
```json
{
  "whatsapp_number": "263771234567",
  "full_name": "Tendai Mukanya Moyo",
  "kyc_status": "verified",
  "credit_tier": "Tier 1",
  "max_loan_amount_usd": 200
}
```

**customer_consents**:
```json
{
  "customer_id": "...",
  "consent_type": "loan_terms",
  "accepted_at": "2025-12-05T16:00:00Z",
  "version": "1.0"
}
```
