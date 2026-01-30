# T030: Score-Based Loan Tiers

**Task ID**: T030 (GitHub Issue #42)
**Phase**: Phase 0 - Research
**Date**: 2025-11-14
**Status**: ✅ Completed

---

## Overview

Lynia Finance implements a risk-based pricing model with **three loan tiers** determined by customer credit scores. Higher scores unlock larger loan amounts, incentivizing responsible borrowing and on-time payments.

---

## Loan Tier Structure

| Tier | Credit Score Range | Max Loan Amount | Monthly Interest | Total Repayment (12 months) |
|------|-------------------|-----------------|------------------|----------------------------|
| **Bronze** | 60-70 | $200 | 2% | $248 |
| **Silver** | 71-85 | $350 | 2% | $434 |
| **Gold** | 86-100 | $500 | 2% | $620 |

### Tier Details

#### Bronze Tier (Score: 60-70)
- **Max Loan**: $200
- **Target Customer**: New customers, rebuilding credit
- **Device Options**: Entry-level smartphones ($150-250)
- **Risk Level**: Medium-High
- **Deposit Required**: $50 minimum (25%)

#### Silver Tier (Score: 71-85)
- **Max Loan**: $350
- **Target Customer**: Established payment history
- **Device Options**: Mid-range smartphones ($300-400)
- **Risk Level**: Medium
- **Deposit Required**: $87.50 minimum (25%)

#### Gold Tier (Score: 86-100)
- **Max Loan**: $500
- **Target Customer**: Excellent payment history
- **Device Options**: Premium smartphones ($450-550)
- **Risk Level**: Low
- **Deposit Required**: $125 minimum (25%)

---

## Implementation

### JavaScript/TypeScript

```typescript
enum LoanTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD'
}

interface LoanTierConfig {
  tier: LoanTier;
  minScore: number;
  maxScore: number;
  maxLoanAmount: number;
  monthlyInterestRate: number;
}

const LOAN_TIERS: LoanTierConfig[] = [
  {
    tier: LoanTier.BRONZE,
    minScore: 60,
    maxScore: 70,
    maxLoanAmount: 200,
    monthlyInterestRate: 0.02
  },
  {
    tier: LoanTier.SILVER,
    minScore: 71,
    maxScore: 85,
    maxLoanAmount: 350,
    monthlyInterestRate: 0.02
  },
  {
    tier: LoanTier.GOLD,
    minScore: 86,
    maxScore: 100,
    maxLoanAmount: 500,
    monthlyInterestRate: 0.02
  }
];

function getLoanTier(creditScore: number): LoanTierConfig | null {
  if (creditScore < 60 || creditScore > 100) {
    return null; // Score out of valid range
  }

  return LOAN_TIERS.find(
    tier => creditScore >= tier.minScore && creditScore <= tier.maxScore
  ) || null;
}

function calculateRepaymentSchedule(loanAmount: number, creditScore: number) {
  const tier = getLoanTier(creditScore);

  if (!tier) {
    throw new Error('Invalid credit score');
  }

  if (loanAmount > tier.maxLoanAmount) {
    throw new Error(`Loan amount exceeds tier maximum of $${tier.maxLoanAmount}`);
  }

  const months = 12;
  const monthlyInterest = loanAmount * tier.monthlyInterestRate;
  const principal = loanAmount / months;
  const monthlyPayment = principal + monthlyInterest;
  const totalRepayment = monthlyPayment * months;

  return {
    tier: tier.tier,
    loanAmount: loanAmount,
    months: months,
    monthlyPayment: monthlyPayment.toFixed(2),
    totalInterest: (monthlyInterest * months).toFixed(2),
    totalRepayment: totalRepayment.toFixed(2)
  };
}

// Usage examples
const bronzeCustomer = calculateRepaymentSchedule(200, 65);
console.log(bronzeCustomer);
// {
//   tier: 'BRONZE',
//   loanAmount: 200,
//   months: 12,
//   monthlyPayment: '20.67',
//   totalInterest: '48.00',
//   totalRepayment: '248.00'
// }

const silverCustomer = calculateRepaymentSchedule(350, 78);
console.log(silverCustomer);
// {
//   tier: 'SILVER',
//   loanAmount: 350,
//   months: 12,
//   monthlyPayment: '36.17',
//   totalInterest: '84.00',
//   totalRepayment: '434.00'
// }

const goldCustomer = calculateRepaymentSchedule(500, 92);
console.log(goldCustomer);
// {
//   tier: 'GOLD',
//   loanAmount: 500,
//   months: 12,
//   monthlyPayment: '51.67',
//   totalInterest: '120.00',
//   totalRepayment: '620.00'
// }
```

---

## Credit Score Calculation

Credit scores (60-100) are calculated based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Payment History** | 40% | On-time payments, late payments, defaults |
| **Credit Utilization** | 20% | Current debt vs available credit |
| **Account Age** | 15% | Length of relationship with Lynia |
| **Payment Consistency** | 15% | Regularity of payments |
| **External Data** | 10% | Mobile money transaction history, airtime purchases |

### Starting Score

- **New Customers**: 65 (Bronze tier)
- **With Referral**: 70 (Bronze tier, upper bound)
- **Previous Lynia Customer**: Retain last score

### Score Improvements

| Action | Score Change |
|--------|--------------|
| On-time payment | +2 points |
| Early payment (7+ days early) | +3 points |
| Complete loan successfully | +5 points |
| Late payment (1-7 days) | -3 points |
| Late payment (8-30 days) | -5 points |
| Default (30+ days) | -15 points |
| Loan write-off | -25 points (minimum score 60) |

---

## Business Logic

### Tier Progression Example

**Month 0**: New customer John gets score 65 (Bronze tier)
- Qualifies for: $200 loan
- Selects: Samsung A04 ($150 device + $50 deposit)
- Loan: $150 over 12 months = $12.50/month + $3 interest = **$15.50/month**

**Month 12**: John makes all 12 payments on time (+24 points) and completes loan (+5 points)
- New score: 65 + 24 + 5 = **94 (Gold tier)**
- Next loan qualifies for: $500 maximum
- Can now purchase: High-end devices

### Tier Downgrade Example

**Month 0**: Returning customer Sarah has score 88 (Gold tier)
- Qualifies for: $500 loan
- Selects: iPhone 12 ($450 device + $112.50 deposit)
- Loan: $450 over 12 months

**Month 6**: Sarah misses 2 payments (8+ days late each)
- Score: 88 - 5 - 5 = **78 (Silver tier)**
- Current loan continues at original terms
- Next loan limited to: $350 maximum

---

## Database Schema

```sql
CREATE TABLE loan_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name VARCHAR(10) NOT NULL, -- 'BRONZE', 'SILVER', 'GOLD'
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  max_loan_amount DECIMAL(10, 2) NOT NULL,
  monthly_interest_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0200, -- 2%
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_score_range UNIQUE (min_score, max_score),
  CONSTRAINT valid_score_range CHECK (min_score >= 0 AND max_score <= 100 AND min_score < max_score)
);

-- Insert default tiers
INSERT INTO loan_tiers (tier_name, min_score, max_score, max_loan_amount, monthly_interest_rate)
VALUES
  ('BRONZE', 60, 70, 200.00, 0.0200),
  ('SILVER', 71, 85, 350.00, 0.0200),
  ('GOLD', 86, 100, 500.00, 0.0200);

-- Add tier to customers table
ALTER TABLE customers
ADD COLUMN credit_score INTEGER DEFAULT 65 CHECK (credit_score >= 60 AND credit_score <= 100),
ADD COLUMN current_tier VARCHAR(10) GENERATED ALWAYS AS (
  CASE
    WHEN credit_score BETWEEN 60 AND 70 THEN 'BRONZE'
    WHEN credit_score BETWEEN 71 AND 85 THEN 'SILVER'
    WHEN credit_score BETWEEN 86 AND 100 THEN 'GOLD'
  END
) STORED;

-- Get customer's max loan amount
CREATE FUNCTION get_max_loan_amount(customer_id UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
AS $$
DECLARE
  customer_score INTEGER;
  max_amount DECIMAL(10, 2);
BEGIN
  SELECT credit_score INTO customer_score
  FROM customers
  WHERE id = customer_id;

  SELECT max_loan_amount INTO max_amount
  FROM loan_tiers
  WHERE customer_score BETWEEN min_score AND max_score;

  RETURN max_amount;
END;
$$;
```

---

## API Endpoints

### GET /api/customers/:id/loan-eligibility

```json
{
  "customerId": "abc123",
  "creditScore": 78,
  "tier": "SILVER",
  "maxLoanAmount": 350,
  "monthlyInterestRate": 0.02,
  "eligibleDevices": [
    {
      "id": "device_001",
      "model": "Samsung Galaxy A14",
      "price": 300,
      "requiredDeposit": 75,
      "loanAmount": 225,
      "monthlyPayment": 22.75
    },
    {
      "id": "device_002",
      "model": "Tecno Spark 10",
      "price": 250,
      "requiredDeposit": 62.50,
      "loanAmount": 187.50,
      "monthlyPayment": 18.94
    }
  ]
}
```

### POST /api/loans/calculate-repayment

**Request**:
```json
{
  "customerId": "abc123",
  "devicePrice": 300,
  "depositAmount": 75
}
```

**Response**:
```json
{
  "loanAmount": 225,
  "tier": "SILVER",
  "months": 12,
  "monthlyInterestRate": 0.02,
  "monthlyPayment": 22.75,
  "totalInterest": 54,
  "totalRepayment": 279,
  "schedule": [
    {
      "month": 1,
      "principal": 18.75,
      "interest": 4.50,
      "payment": 23.25,
      "balance": 206.25
    },
    // ... months 2-12
  ]
}
```

---

## Summary

Lynia Finance's **three-tier loan structure** (Bronze $200, Silver $350, Gold $500) incentivizes responsible borrowing through score-based access to larger loans. Starting at 65 points (Bronze), customers can progress to Gold tier (86-100) through consistent on-time payments, unlocking access to premium devices and larger loan amounts.

**Implementation**: Simple score-based lookup with automatic tier assignment via database generated column and API endpoints for real-time eligibility checks.

---

**Document Information**:
- **Created**: 2025-11-14
- **Author**: Research Team
- **Task**: T030 (GitHub Issue #42)
- **Phase**: Phase 0 - Research
- **Next Task**: T031 (GitHub Issue #43)
