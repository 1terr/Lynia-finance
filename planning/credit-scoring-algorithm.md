# Credit Scoring Algorithm Design

**Task ID**: P1-T015
**Phase**: Phase 1 - Credit Scoring System Design
**Priority**: Critical
**Estimated**: 12 hours
**Dependencies**: P1-T001 (Architecture), Phase 0 Research

---

## Table of Contents
1. [Overview](#overview)
2. [Hybrid Scoring Strategy](#hybrid-scoring-strategy)
   - Long-Term Strategy: Affordability, Ability-to-Repay, Willingness-to-Pay
   - Advanced Data Enrichment (MNO, Platforms, CSV Upload)
3. [Rule-Based Scoring (Phase 1)](#rule-based-scoring-phase-1)
4. [Machine Learning Model (Phase 2+)](#machine-learning-model-phase-2)
5. [Feature Engineering](#feature-engineering)
6. [Model Versioning Strategy](#model-versioning-strategy)
7. [A/B Testing Framework](#ab-testing-framework)
8. [Advanced Data Integration (Phase 3+)](#advanced-data-integration-phase-3)
   - MNO Airtime Data Integration
   - Platform Integration (InDrive, Bolt, Uber)
   - CSV Data Upload & Processing
   - African Fintech Models Reference (Moove, M-Kopa, GigMile)
9. [Implementation Guide](#implementation-guide)
10. [Monitoring & Evaluation](#monitoring--evaluation)

---

## 1. Overview

The Lynia Finance credit scoring system uses a **hybrid approach** that combines rule-based scoring (Phase 1) with machine learning models (Phase 2+) to assess creditworthiness for informal sector workers in Zimbabwe.

### Scoring Objectives

1. **Predict Default Risk**: Identify customers likely to default on device loans
2. **Assign Credit Limits**: Determine appropriate credit tiers ($200/$350/$500)
3. **Enable Financial Inclusion**: Approve customers with thin/no credit files
4. **Minimize Losses**: Target <5% default rate (industry standard: 8-12%)
5. **Fast Decisions**: Auto-approve 60% of applications in <30 seconds

### Credit Score Range

```
Score Range: 300-850 (FICO-like scale)

┌─────────────────────────────────────────────────────┐
│ 300-549: Very High Risk (REJECT)                   │
├─────────────────────────────────────────────────────┤
│ 550-649: High Risk (MANUAL REVIEW)                 │
├─────────────────────────────────────────────────────┤
│ 650-699: Medium Risk (APPROVE $200, 10% down)      │
├─────────────────────────────────────────────────────┤
│ 700-749: Low Risk (APPROVE $350, 10% down)         │
├─────────────────────────────────────────────────────┤
│ 750-850: Very Low Risk (APPROVE $500, 5% down)     │
└─────────────────────────────────────────────────────┘
```

### Decision Matrix

| Credit Score | Decision | Credit Limit | Down Payment | Interest Rate |
|--------------|----------|--------------|--------------|---------------|
| 300-549 | **REJECT** | $0 | N/A | N/A |
| 550-649 | **MANUAL REVIEW** | TBD | TBD | TBD |
| 650-699 | **APPROVE (Tier 1)** | $200 | 10% | 15% APR |
| 700-749 | **APPROVE (Tier 2)** | $350 | 10% | 12% APR |
| 750-850 | **APPROVE (Tier 3)** | $500 | 5% | 10% APR |

---

## 2. Hybrid Scoring Strategy

### Why Hybrid?

**Phase 1 (Months 1-6)**: Rule-based scoring
- No historical data to train ML models
- Fast implementation (<2 weeks)
- Transparent, explainable decisions
- Cost-effective ($0/month)

**Phase 2 (Months 7-12)**: Hybrid scoring (70% rules + 30% ML)
- 200+ loans with repayment data
- Train lightweight ML model
- Improve approval rate by 10-15%

**Phase 3 (Year 2+)**: ML-first scoring (80% ML + 20% rules)
- 1,000+ loans with 6+ months history
- Advanced models (XGBoost, LightGBM)
- Maximize approval rate and minimize defaults

### Long-Term Scoring Strategy (Phase 3+)

**Inspired by African fintech leaders**: Moove.io (mobility financing), M-Kopa (pay-as-you-go devices), GigMile.com (gig economy financing)

The fully established Lynia Finance credit scoring system will assess **three critical dimensions**:

#### 1. **Affordability** - Can the customer afford the repayment?
- Monthly income vs. monthly installment ratio (target: ≤30% debt-to-income)
- Total financial obligations (rent, utilities, existing debts)
- Income stability indicators (consistent vs. volatile earnings)
- Household size and dependents

**Data Sources**:
- Bank statement analysis (via Plaid-like aggregators)
- Mobile money transaction patterns
- Employer integrations for salary verification
- Platform income data (ride-hailing, gig economy)

#### 2. **Ability-to-Repay** - Does the customer have reliable income streams?
- Income consistency over 3-6 months
- Employment stability (tenure, platform ratings)
- Income growth trends
- Alternative income sources (side hustles, multiple gigs)

**Data Sources**:
- Airtime spending patterns from MNO data (Econet, NetOne, Telecel)
- Platform earnings history (InDrive, Bolt, Uber drivers)
- Business revenue proxies (M-Pesa/EcoCash merchant transactions)
- CSV-uploaded customer data for non-API sources

#### 3. **Willingness-to-Pay** - Will the customer prioritize this repayment?
- Past loan repayment history (internal + credit bureau)
- Bill payment consistency (utilities, rent, subscriptions)
- Communication responsiveness (replies to reminders)
- Device usage patterns (active vs. dormant)

**Data Sources**:
- Internal loan performance history
- Credit bureau data (when available in Zimbabwe)
- Payment behavior on other platforms
- WhatsApp engagement metrics

### Hybrid Architecture

```
┌────────────────────────────────────────────────────┐
│ Customer Application                               │
│ (Phone, National ID, KYC data)                    │
└────────────────┬───────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────┐
│ Data Enrichment Layer (Phase 1)                   │
│ - Smile Identity (KYC verification)               │
│ - Zimbocash API (mobile money history - optional) │
│ - Location data (from phone)                      │
└────────────────┬───────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────┐
│ Advanced Data Enrichment (Phase 3+)               │
│                                                    │
│ 1. MNO Data Integration (Airtime Patterns)        │
│    • Econet/NetOne/Telecel APIs                   │
│    • Airtime purchase frequency & amounts         │
│    • Recharge consistency (proxy for income)      │
│    • Data bundle purchases (usage patterns)       │
│                                                    │
│ 2. Platform Integrations (Gig Economy)            │
│    • InDrive: Driver earnings, ratings, trips     │
│    • Bolt: Ride frequency, income, customer score │
│    • Uber: Trip history, acceptance rate          │
│    • Other platforms: CSV upload fallback         │
│                                                    │
│ 3. Income Verification APIs                        │
│    • Employer payroll integrations                │
│    • Bank statement parsing (Plaid-like)          │
│    • Mobile money merchant analytics              │
│                                                    │
│ 4. CSV Data Upload (Manual Ingestion)             │
│    • Platform income reports                      │
│    • Employer salary confirmations                │
│    • Bank statements (when no API)                │
│    • Processed via ML parsing pipeline            │
└────────────────┬───────────────────────────────────┘
                 ↓
         ┌───────────────┐
         │ Feature Store │
         └───────┬───────┘
                 ↓
    ┌────────────────────────┐
    │  Hybrid Scoring Engine │
    └────────────────────────┘
             │       │
    ┌────────┴───┐  └────────┬─────┐
    ↓            ↓           ↓      ↓
┌─────────┐  ┌──────────┐  ┌──────────────┐
│ Rule 1  │  │  Rule 2  │  │  ML Model    │
│ (KYC)   │  │ (Age)    │  │ (if trained) │
│ Weight  │  │ Weight   │  │  Weight 30%  │
│  40%    │  │  30%     │  │              │
└────┬────┘  └────┬─────┘  └──────┬───────┘
     │            │                │
     └────────────┴────────────────┘
                  ↓
         ┌────────────────┐
         │ Weighted Score │
         │   (300-850)    │
         └────────┬───────┘
                  ↓
         ┌────────────────┐
         │ Decision Engine│
         │ (Approve/Deny) │
         └────────────────┘
```

---

## 3. Rule-Based Scoring (Phase 1)

### 3.1 Scoring Components

**6 Components** with weighted contributions:

| Component | Weight | Score Range | Description |
|-----------|--------|-------------|-------------|
| **KYC Verification** | 35% | 0-300 | National ID validation + selfie match |
| **Age & Employment** | 25% | 0-200 | Age (18-65), employment type |
| **Geographic Risk** | 15% | 0-150 | Location-based risk (Harare vs rural) |
| **Mobile Money History** | 15% | 0-150 | Transaction volume (optional Phase 1) |
| **Social Signals** | 5% | 0-50 | Phone contact list size, app usage |
| **First-Time Bonus** | 5% | 0-100 | New customer incentive |

**Total**: 300-850 (sum of all components)

### 3.2 Component 1: KYC Verification (35%, 0-300 points)

**Data Source**: Smile Identity API

```typescript
async function scoreKYCVerification(kycResult: SmileIdentityResult): Promise<number> {
  let score = 0;

  // 1. ID Document Verification (150 points)
  if (kycResult.id_verification.status === 'verified') {
    score += 150;
  } else if (kycResult.id_verification.status === 'review') {
    score += 75; // Partial credit
  }

  // 2. Selfie-ID Match (100 points)
  const faceMatchScore = kycResult.face_match.confidence;
  if (faceMatchScore >= 0.95) {
    score += 100;
  } else if (faceMatchScore >= 0.85) {
    score += 75;
  } else if (faceMatchScore >= 0.75) {
    score += 50;
  }

  // 3. Liveness Check (50 points)
  if (kycResult.liveness.status === 'passed') {
    score += 50;
  }

  return Math.min(score, 300); // Cap at 300
}
```

**Scoring Table**:
| KYC Status | ID Verified | Face Match | Liveness | Score |
|------------|-------------|------------|----------|-------|
| Perfect | ✅ Yes | ≥95% | ✅ Passed | 300 |
| Good | ✅ Yes | 85-94% | ✅ Passed | 225 |
| Fair | ✅ Yes | 75-84% | ❌ Failed | 200 |
| Poor | ⚠️ Review | <75% | ❌ Failed | 75 |
| Failed | ❌ No | <50% | ❌ Failed | 0 |

### 3.3 Component 2: Age & Employment (25%, 0-200 points)

**Age Risk Curve** (120 points max):

```typescript
function scoreAge(birthDate: Date): number {
  const age = calculateAge(birthDate);

  if (age < 18) return 0; // Not eligible
  if (age >= 18 && age <= 25) return 60; // Young, higher risk
  if (age >= 26 && age <= 35) return 100; // Prime age, lower risk
  if (age >= 36 && age <= 50) return 120; // Established, lowest risk
  if (age >= 51 && age <= 60) return 100; // Pre-retirement
  if (age >= 61 && age <= 65) return 80; // Retirement age
  return 0; // Over 65, not eligible
}
```

**Employment Type** (80 points max):

```typescript
function scoreEmployment(employmentType: string): number {
  const scores = {
    'formal_employed': 80, // Salaried job
    'self_employed': 70, // Small business owner
    'informal_trader': 60, // Market vendor, street vendor
    'gig_worker': 50, // Ride-share, delivery driver
    'unemployed': 20, // Actively seeking work
    'student': 40 // Part-time income
  };

  return scores[employmentType] || 0;
}
```

**Combined Age + Employment**:
```typescript
function scoreAgeAndEmployment(birthDate: Date, employmentType: string): number {
  const ageScore = scoreAge(birthDate);
  const employmentScore = scoreEmployment(employmentType);
  return ageScore + employmentScore; // Max 200
}
```

### 3.4 Component 3: Geographic Risk (15%, 0-150 points)

**Zimbabwe Location Risk Tiers**:

```typescript
interface LocationRisk {
  province: string;
  city: string;
  riskTier: 'low' | 'medium' | 'high';
  score: number;
}

const LOCATION_RISK_SCORES: LocationRisk[] = [
  // Low Risk (Urban centers) - 150 points
  { province: 'Harare', city: 'Harare CBD', riskTier: 'low', score: 150 },
  { province: 'Bulawayo', city: 'Bulawayo CBD', riskTier: 'low', score: 150 },
  { province: 'Harare', city: 'Chitungwiza', riskTier: 'low', score: 140 },

  // Medium Risk (Semi-urban) - 100 points
  { province: 'Manicaland', city: 'Mutare', riskTier: 'medium', score: 100 },
  { province: 'Midlands', city: 'Gweru', riskTier: 'medium', score: 100 },
  { province: 'Masvingo', city: 'Masvingo', riskTier: 'medium', score: 100 },

  // High Risk (Rural) - 50 points
  { province: 'Matabeleland North', city: 'Rural', riskTier: 'high', score: 50 },
  { province: 'Mashonaland Central', city: 'Rural', riskTier: 'high', score: 50 }
];

function scoreGeographicRisk(province: string, city: string): number {
  const match = LOCATION_RISK_SCORES.find(
    loc => loc.province === province && loc.city === city
  );

  return match?.score || 75; // Default to medium risk
}
```

**Rationale**:
- **Urban**: Higher economic activity, easier device recovery
- **Semi-urban**: Moderate risk, local enforcement possible
- **Rural**: Higher risk, harder to recover devices

### 3.5 Component 4: Mobile Money History (15%, 0-150 points)

**Optional in Phase 1** - Requires Zimbocash/EcoCash API integration

```typescript
interface MobileMoneyProfile {
  account_age_months: number;
  avg_monthly_inflow_usd: number;
  avg_monthly_outflow_usd: number;
  transaction_count_3m: number;
  balance_usd: number;
}

function scoreMobileMoneyHistory(profile: MobileMoneyProfile | null): number {
  if (!profile) return 75; // Neutral score if no data

  let score = 0;

  // 1. Account Age (40 points)
  if (profile.account_age_months >= 24) score += 40;
  else if (profile.account_age_months >= 12) score += 30;
  else if (profile.account_age_months >= 6) score += 20;
  else score += 10;

  // 2. Monthly Inflow (50 points) - Income proxy
  if (profile.avg_monthly_inflow_usd >= 500) score += 50;
  else if (profile.avg_monthly_inflow_usd >= 300) score += 40;
  else if (profile.avg_monthly_inflow_usd >= 150) score += 30;
  else score += 10;

  // 3. Transaction Frequency (30 points) - Activity level
  if (profile.transaction_count_3m >= 100) score += 30;
  else if (profile.transaction_count_3m >= 50) score += 20;
  else if (profile.transaction_count_3m >= 20) score += 10;

  // 4. Current Balance (30 points) - Financial stability
  if (profile.balance_usd >= 100) score += 30;
  else if (profile.balance_usd >= 50) score += 20;
  else if (profile.balance_usd >= 20) score += 10;

  return Math.min(score, 150);
}
```

### 3.6 Component 5: Social Signals (5%, 0-50 points)

**Optional** - Requires user consent for app permissions

```typescript
interface SocialSignals {
  phone_contacts_count: number;
  installed_apps_count: number;
  whatsapp_active: boolean;
  email_verified: boolean;
}

function scoreSocialSignals(signals: SocialSignals | null): number {
  if (!signals) return 25; // Neutral score if no data

  let score = 0;

  // 1. Phone Contacts (20 points) - Social network size
  if (signals.phone_contacts_count >= 100) score += 20;
  else if (signals.phone_contacts_count >= 50) score += 15;
  else if (signals.phone_contacts_count >= 20) score += 10;
  else score += 5;

  // 2. WhatsApp Active (15 points) - Primary communication channel
  if (signals.whatsapp_active) score += 15;

  // 3. Email Verified (10 points) - Additional contact method
  if (signals.email_verified) score += 10;

  // 4. Installed Apps (5 points) - Smartphone usage
  if (signals.installed_apps_count >= 20) score += 5;

  return Math.min(score, 50);
}
```

### 3.7 Component 6: First-Time Bonus (5%, 0-100 points)

**New Customer Incentive**:

```typescript
function scoreFirstTimeBonus(
  isFirstLoan: boolean,
  referredBy: string | null,
  marketingCampaign: string | null
): number {
  let score = 0;

  // 1. First-time customer base bonus (50 points)
  if (isFirstLoan) {
    score += 50;
  }

  // 2. Referral bonus (30 points)
  if (referredBy) {
    // Check if referrer has good repayment history
    const referrerScore = getReferrerCreditScore(referredBy);
    if (referrerScore >= 700) score += 30;
    else if (referrerScore >= 650) score += 20;
  }

  // 3. Marketing campaign bonus (20 points)
  if (marketingCampaign === 'launch_promo') {
    score += 20; // Launch promotion
  }

  return Math.min(score, 100);
}
```

### 3.8 Complete Rule-Based Scoring Function

```typescript
interface CreditScoreInput {
  kyc_result: SmileIdentityResult;
  birth_date: Date;
  employment_type: string;
  province: string;
  city: string;
  mobile_money_profile: MobileMoneyProfile | null;
  social_signals: SocialSignals | null;
  is_first_loan: boolean;
  referred_by: string | null;
  marketing_campaign: string | null;
}

async function calculateRuleBasedScore(input: CreditScoreInput): Promise<{
  total_score: number;
  components: Record<string, number>;
  decision: 'approve' | 'review' | 'reject';
  credit_limit: number;
}> {
  // Calculate each component
  const components = {
    kyc_verification: await scoreKYCVerification(input.kyc_result),
    age_employment: scoreAgeAndEmployment(input.birth_date, input.employment_type),
    geographic_risk: scoreGeographicRisk(input.province, input.city),
    mobile_money: scoreMobileMoneyHistory(input.mobile_money_profile),
    social_signals: scoreSocialSignals(input.social_signals),
    first_time_bonus: scoreFirstTimeBonus(
      input.is_first_loan,
      input.referred_by,
      input.marketing_campaign
    )
  };

  // Calculate total score (max 850)
  const total_score = Object.values(components).reduce((sum, score) => sum + score, 0);

  // Determine decision based on score
  let decision: 'approve' | 'review' | 'reject';
  let credit_limit = 0;

  if (total_score >= 750) {
    decision = 'approve';
    credit_limit = 500; // Tier 3
  } else if (total_score >= 700) {
    decision = 'approve';
    credit_limit = 350; // Tier 2
  } else if (total_score >= 650) {
    decision = 'approve';
    credit_limit = 200; // Tier 1
  } else if (total_score >= 550) {
    decision = 'review'; // Manual review required
    credit_limit = 0;
  } else {
    decision = 'reject';
    credit_limit = 0;
  }

  return {
    total_score,
    components,
    decision,
    credit_limit
  };
}
```

### 3.9 Rule-Based Scoring Example

**Example Customer**:
```typescript
const customer = {
  name: 'John Doe',
  birth_date: new Date('1990-05-15'), // Age 34
  employment_type: 'self_employed',
  province: 'Harare',
  city: 'Harare CBD',
  kyc_result: {
    id_verification: { status: 'verified' },
    face_match: { confidence: 0.96 },
    liveness: { status: 'passed' }
  },
  mobile_money_profile: {
    account_age_months: 18,
    avg_monthly_inflow_usd: 400,
    avg_monthly_outflow_usd: 350,
    transaction_count_3m: 75,
    balance_usd: 80
  },
  social_signals: {
    phone_contacts_count: 120,
    whatsapp_active: true,
    email_verified: true,
    installed_apps_count: 25
  },
  is_first_loan: true,
  referred_by: null,
  marketing_campaign: 'launch_promo'
};

// Calculate score
const result = await calculateRuleBasedScore(customer);

console.log(result);
// {
//   total_score: 735,
//   components: {
//     kyc_verification: 300 (35% weight),
//     age_employment: 170 (25% weight) = 100 (age) + 70 (self-employed),
//     geographic_risk: 150 (15% weight) = Harare CBD (low risk),
//     mobile_money: 110 (15% weight),
//     social_signals: 45 (5% weight),
//     first_time_bonus: 70 (5% weight) = 50 (first-time) + 20 (campaign)
//   },
//   decision: 'approve',
//   credit_limit: 350 // Tier 2
// }
```

---

## 4. Machine Learning Model (Phase 2+)

### 4.1 When to Introduce ML

**Prerequisites**:
- ✅ 200+ loans with 3+ months repayment history
- ✅ At least 20 defaults (10% default rate benchmark)
- ✅ Clean, labeled training data
- ✅ Feature engineering pipeline in place

**Estimated Timeline**:
- **Month 7**: First 200 loans with 3-month history
- **Month 9**: Train initial model, shadow mode A/B testing
- **Month 12**: ML model in production (30% weight)

### 4.2 ML Model Architecture

**Model Type**: **Gradient Boosted Trees** (LightGBM or XGBoost)

**Why GBT?**:
- ✅ Excellent for tabular data
- ✅ Handles missing values natively
- ✅ Fast inference (<50ms)
- ✅ Interpretable (feature importance, SHAP values)
- ✅ No need for feature scaling

**Alternatives Considered**:
- ❌ Logistic Regression: Too simple, poor performance on non-linear patterns
- ❌ Neural Networks: Overkill, needs more data (1000+ samples), slow inference
- ❌ Random Forest: Slower than GBT, similar performance

### 4.3 Target Variable

**Binary Classification**: Predict default within 90 days

```python
def label_loan_default(loan: Loan) -> int:
    """
    Label loan as default (1) or good (0)

    Default Definition:
    - 30+ days past due (DPD 30+) OR
    - Missed 2+ consecutive payments
    """
    if loan.days_past_due >= 30:
        return 1  # Default

    if loan.consecutive_missed_payments >= 2:
        return 1  # Default

    return 0  # Good loan
```

### 4.4 Feature Engineering

**60+ Features** across 6 categories:

**Category 1: KYC & Identity (10 features)**
```python
kyc_features = {
    'kyc_face_match_score': float,  # 0.0-1.0
    'kyc_liveness_passed': bool,
    'kyc_id_verified': bool,
    'age': int,
    'age_squared': int,  # Non-linear age effect
    'national_id_province_code': str,  # First 2 digits
    'years_since_id_issued': int,
    'id_verification_attempts': int,  # Number of retries
    'selfie_quality_score': float,
    'id_photo_quality_score': float
}
```

**Category 2: Demographics (8 features)**
```python
demographic_features = {
    'employment_type': str,  # One-hot encoded
    'province': str,
    'city': str,
    'is_urban': bool,
    'distance_from_distributor_km': float,
    'population_density_per_km2': int,
    'avg_income_province_usd': float,  # Census data
    'education_level': str  # Optional, from application
}
```

**Category 3: Mobile Money & Airtime (22 features)**
```python
mobile_money_features = {
    # Mobile Money Transactions (15 features)
    'mm_account_age_months': int,
    'mm_avg_monthly_inflow': float,
    'mm_avg_monthly_outflow': float,
    'mm_inflow_to_outflow_ratio': float,
    'mm_balance_current': float,
    'mm_transaction_count_3m': int,
    'mm_transaction_count_6m': int,
    'mm_avg_transaction_size': float,
    'mm_max_single_transaction': float,
    'mm_unique_recipients_3m': int,
    'mm_utility_payments_3m': int,  # Bill payments indicate stability
    'mm_airtime_purchases_3m': int,
    'mm_cash_out_frequency': int,
    'mm_days_since_last_transaction': int,
    'mm_weekend_transaction_ratio': float,

    # MNO Airtime Data (7 features - Phase 3+)
    'airtime_total_recharges_3m': int,
    'airtime_avg_recharge_amount_usd': float,
    'airtime_recharge_frequency_per_month': float,
    'airtime_consistency_score': float,  # 0-100, regularity of recharges
    'airtime_peak_recharge_day': int,  # Salary day indicator (1-31)
    'data_bundles_purchased_3m': int,
    'total_airtime_spent_3m_usd': float
}
```

**Category 4: Device & Loan (12 features)**
```python
device_loan_features = {
    'device_price_usd': float,
    'device_age_months': int,  # New vs refurbished
    'device_brand': str,  # Samsung, Tecno, Infinix, Xiaomi
    'device_storage_gb': int,
    'loan_amount': float,
    'down_payment_pct': float,
    'loan_to_income_ratio': float,
    'loan_term_months': int,
    'monthly_installment': float,
    'installment_to_income_ratio': float,  # Debt service ratio
    'requested_credit_limit': int,
    'is_first_purchase': bool
}
```

**Category 5: Behavioral (10 features)**
```python
behavioral_features = {
    'whatsapp_response_time_avg_minutes': float,
    'kyc_submission_time_days': float,  # Days from onboarding to KYC
    'application_completion_rate': float,  # 0.0-1.0
    'num_customer_support_contacts': int,
    'num_payment_reminders_needed': int,
    'device_browsing_sessions': int,
    'time_spent_browsing_minutes': float,
    'num_devices_viewed': int,
    'has_email': bool,
    'has_referral': bool
}
```

**Category 6: Platform & Gig Economy (12 features - Phase 3+)**
```python
platform_features = {
    # General Platform Data
    'has_platform_income': bool,
    'platform_type': str,  # 'indrive', 'bolt', 'uber', 'none'
    'platform_driver_verified': bool,

    # Income & Earnings
    'platform_avg_monthly_earnings_usd': float,
    'platform_income_consistency_score': float,  # 0-100
    'platform_earnings_3m_avg': float,
    'platform_income_volatility': float,  # Standard deviation of monthly income

    # Performance Metrics
    'platform_driver_rating': float,  # 0-5
    'platform_total_trips': int,
    'platform_tenure_months': int,
    'platform_active_days_per_week': float,
    'platform_acceptance_rate': float  # 0-1
}
```

**Category 7: Alternative Income Sources (8 features - CSV Upload)**
```python
alternative_income_features = {
    'has_alternative_income': bool,
    'alt_income_source_type': str,  # 'salary', 'bank_statement', 'platform_csv'
    'alt_income_monthly_amount_usd': float,
    'alt_income_consistency_score': float,
    'alt_income_verified': bool,
    'alt_income_data_period_months': int,
    'employer_verified': bool,
    'multi_income_stream_count': int  # Number of different income sources
}
```

**Category 8: Social (5 features)**
```python
social_features = {
    'phone_contacts_count': int,
    'whatsapp_active': bool,
    'installed_apps_count': int,
    'referrer_credit_score': float,  # If referred
    'referrer_default_rate': float
}
```

### 4.5 Model Training Pipeline

```python
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_recall_curve

def train_credit_scoring_model(loans_df: pd.DataFrame):
    # 1. Prepare features and target
    X = loans_df.drop(['default', 'loan_id', 'customer_id'], axis=1)
    y = loans_df['default']

    # 2. Train/test split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    # 3. Train LightGBM model
    params = {
        'objective': 'binary',
        'metric': 'auc',
        'boosting_type': 'gbdt',
        'num_leaves': 31,
        'learning_rate': 0.05,
        'feature_fraction': 0.8,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'max_depth': 6,
        'min_data_in_leaf': 20,
        'verbose': -1
    }

    train_data = lgb.Dataset(X_train, label=y_train)
    test_data = lgb.Dataset(X_test, label=y_test, reference=train_data)

    model = lgb.train(
        params,
        train_data,
        num_boost_round=500,
        valid_sets=[train_data, test_data],
        early_stopping_rounds=50
    )

    # 4. Evaluate
    y_pred_proba = model.predict(X_test)
    auc = roc_auc_score(y_test, y_pred_proba)

    print(f"Test AUC: {auc:.4f}")

    # 5. Feature importance
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importance()
    }).sort_values('importance', ascending=False)

    print("\nTop 10 Features:")
    print(feature_importance.head(10))

    return model, feature_importance
```

### 4.6 Model Calibration

**Convert ML probability to credit score (300-850)**:

```python
def calibrate_ml_score(default_probability: float) -> int:
    """
    Map default probability to credit score

    Low probability (0.01) → High score (850)
    High probability (0.50) → Low score (300)
    """
    # Logit transformation
    if default_probability >= 0.99:
        default_probability = 0.99
    if default_probability <= 0.01:
        default_probability = 0.01

    log_odds = np.log(default_probability / (1 - default_probability))

    # Map log_odds to 300-850 scale
    # log_odds range: -4.6 (1% default) to 0 (50% default)
    score = 850 - ((log_odds + 4.6) / 4.6) * 550

    return int(np.clip(score, 300, 850))

# Examples:
calibrate_ml_score(0.01)  # 850 (very low risk)
calibrate_ml_score(0.05)  # 730
calibrate_ml_score(0.10)  # 650
calibrate_ml_score(0.20)  # 530
calibrate_ml_score(0.50)  # 300 (very high risk)
```

### 4.7 Hybrid Scoring (Rule-Based + ML)

**Phase 2 Weighting**: 70% rules, 30% ML

```typescript
async function calculateHybridScore(input: CreditScoreInput): Promise<number> {
  // 1. Calculate rule-based score
  const ruleScore = await calculateRuleBasedScore(input);

  // 2. Calculate ML score (if model trained)
  let mlScore = 0;
  if (mlModelTrained) {
    const features = await extractMLFeatures(input);
    const defaultProb = await mlModel.predict(features);
    mlScore = calibrateMLScore(defaultProb);
  }

  // 3. Weighted average
  const RULE_WEIGHT = 0.7;
  const ML_WEIGHT = mlModelTrained ? 0.3 : 0.0;

  const hybridScore = (ruleScore.total_score * RULE_WEIGHT) + (mlScore * ML_WEIGHT);

  // If ML not trained, use 100% rule-based
  return Math.round(mlModelTrained ? hybridScore : ruleScore.total_score);
}
```

---

## 5. Feature Engineering

### 5.1 Feature Store Architecture

```
┌──────────────────────────────────────────────────┐
│ Feature Store (PostgreSQL + Redis Cache)        │
├──────────────────────────────────────────────────┤
│ Raw Features:                                    │
│ - customer_features (demographics, KYC)         │
│ - mobile_money_features (transaction history)   │
│ - loan_features (device, amount, terms)         │
│ - behavioral_features (WhatsApp interactions)   │
├──────────────────────────────────────────────────┤
│ Derived Features:                                │
│ - ratios (income/loan, inflow/outflow)          │
│ - aggregations (avg, sum, count over 3/6/12m)   │
│ - time-based (days since, recency)              │
└──────────────────────────────────────────────────┘
```

**Feature Store Schema**:

```sql
CREATE TABLE feature_store (
  customer_id UUID PRIMARY KEY,
  feature_vector JSONB NOT NULL,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_version VARCHAR(50),

  -- Indexed feature columns for fast filtering
  credit_score INTEGER,
  default_probability DECIMAL(5,4),
  kyc_face_match_score DECIMAL(5,4),
  mm_avg_monthly_inflow DECIMAL(10,2),
  age INTEGER,

  CONSTRAINT valid_credit_score CHECK (credit_score BETWEEN 300 AND 850)
);

CREATE INDEX idx_feature_store_credit_score ON feature_store(credit_score);
CREATE INDEX idx_feature_store_computed_at ON feature_store(computed_at);
```

### 5.2 Feature Computation Pipeline

```typescript
async function computeFeatures(customerId: string): Promise<FeatureVector> {
  // 1. Fetch raw data
  const [customer, kycResult, mobileMoneyProfile, loanHistory, behavioralData] = await Promise.all([
    getCustomer(customerId),
    getKYCResult(customerId),
    getMobileMoneyProfile(customerId),
    getLoanHistory(customerId),
    getBehavioralData(customerId)
  ]);

  // 2. Compute KYC features
  const kycFeatures = {
    kyc_face_match_score: kycResult.face_match.confidence,
    kyc_liveness_passed: kycResult.liveness.status === 'passed',
    kyc_id_verified: kycResult.id_verification.status === 'verified',
    age: calculateAge(customer.birth_date),
    age_squared: Math.pow(calculateAge(customer.birth_date), 2)
  };

  // 3. Compute mobile money features
  const mmFeatures = mobileMoneyProfile ? {
    mm_account_age_months: mobileMoneyProfile.account_age_months,
    mm_avg_monthly_inflow: mobileMoneyProfile.avg_monthly_inflow_usd,
    mm_inflow_to_outflow_ratio:
      mobileMoneyProfile.avg_monthly_inflow_usd / mobileMoneyProfile.avg_monthly_outflow_usd,
    mm_transaction_count_3m: mobileMoneyProfile.transaction_count_3m,
    mm_days_since_last_transaction: calculateDaysSince(mobileMoneyProfile.last_transaction_date)
  } : {};

  // 4. Compute loan features
  const loanFeatures = {
    num_previous_loans: loanHistory.length,
    avg_loan_amount: loanHistory.reduce((sum, l) => sum + l.amount, 0) / loanHistory.length || 0,
    total_repaid: loanHistory.reduce((sum, l) => sum + l.total_repaid, 0),
    max_days_past_due: Math.max(...loanHistory.map(l => l.max_dpd), 0),
    on_time_payment_rate: calculateOnTimeRate(loanHistory)
  };

  // 5. Compute behavioral features
  const behavioralFeatures = {
    whatsapp_response_time_avg_minutes: behavioralData.avg_response_time,
    kyc_submission_time_days: behavioralData.kyc_submission_time,
    num_customer_support_contacts: behavioralData.support_contacts
  };

  // 6. Combine all features
  return {
    ...kycFeatures,
    ...mmFeatures,
    ...loanFeatures,
    ...behavioralFeatures
  };
}
```

### 5.3 Feature Validation

```typescript
function validateFeatures(features: FeatureVector): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for missing critical features
  if (features.age === null || features.age === undefined) {
    errors.push('Missing age');
  }

  // Check for out-of-range values
  if (features.age < 18 || features.age > 100) {
    errors.push(`Invalid age: ${features.age}`);
  }

  if (features.kyc_face_match_score < 0 || features.kyc_face_match_score > 1) {
    errors.push(`Invalid face match score: ${features.kyc_face_match_score}`);
  }

  // Check for data quality issues
  if (features.mm_inflow_to_outflow_ratio > 10) {
    errors.push('Suspicious inflow/outflow ratio (possible fraud)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## 6. Model Versioning Strategy

### 6.1 Model Registry

**Track all model versions** with metadata:

```sql
CREATE TABLE ml_models (
  model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version VARCHAR(50) NOT NULL UNIQUE, -- e.g., "v1.0.0", "v1.1.0"
  model_type VARCHAR(50) NOT NULL, -- "lightgbm", "xgboost", "rules"
  training_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Performance metrics
  train_auc DECIMAL(5,4),
  test_auc DECIMAL(5,4),
  precision_at_10pct DECIMAL(5,4),
  recall_at_10pct DECIMAL(5,4),

  -- Model artifacts
  model_s3_path TEXT NOT NULL, -- S3 path to serialized model
  feature_names JSONB NOT NULL, -- List of features used
  hyperparameters JSONB,

  -- Deployment status
  status VARCHAR(20) DEFAULT 'training', -- training, testing, production, retired
  deployed_at TIMESTAMP WITH TIME ZONE,
  retired_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  trained_by VARCHAR(100),
  notes TEXT
);

CREATE INDEX idx_ml_models_version ON ml_models(model_version);
CREATE INDEX idx_ml_models_status ON ml_models(status);
```

### 6.2 Model Deployment Workflow

```
┌─────────────────┐
│ Train New Model │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Evaluate Offline│  (Test AUC > 0.75?)
└────────┬────────┘
         ↓ Yes
┌─────────────────┐
│ Shadow Mode     │  (30 days, no impact on decisions)
│ (A/B Test)      │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Compare Metrics │  (Shadow model AUC > Production + 2%?)
└────────┬────────┘
         ↓ Yes
┌─────────────────┐
│ Champion/       │  (50/50 traffic split, 14 days)
│ Challenger Test │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Promote to Prod │  (100% traffic)
└─────────────────┘
```

### 6.3 Versioning Scheme

**Semantic Versioning**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (new features, removed features)
- **MINOR**: Backward-compatible improvements (retrained with more data)
- **PATCH**: Bug fixes, hyperparameter tuning

**Examples**:
- `v1.0.0`: Initial rule-based model (Phase 1)
- `v1.1.0`: Added mobile money features
- `v2.0.0`: Introduced ML model (Phase 2)
- `v2.1.0`: Retrained with 6 months data
- `v2.1.1`: Fixed feature engineering bug

---

## 7. A/B Testing Framework

### 7.1 A/B Test Design

**Test Allocation**:
```typescript
function assignToExperiment(customerId: string): 'control' | 'treatment' {
  // Deterministic hash-based assignment (consistent per customer)
  const hash = hashCustomerId(customerId);
  const bucket = hash % 100; // 0-99

  // 50/50 split
  return bucket < 50 ? 'control' : 'treatment';
}
```

**Experiment Tracking**:
```sql
CREATE TABLE ab_experiments (
  experiment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_name VARCHAR(100) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,

  control_model_version VARCHAR(50),
  treatment_model_version VARCHAR(50),

  traffic_split JSONB, -- {"control": 0.5, "treatment": 0.5}
  status VARCHAR(20) DEFAULT 'running', -- running, paused, completed
  winner VARCHAR(20) -- control, treatment, inconclusive
);

CREATE TABLE ab_experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES ab_experiments(id),
  customer_id UUID REFERENCES customers(id),
  variant VARCHAR(20), -- control, treatment
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ab_experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES ab_experiments(id),
  customer_id UUID REFERENCES customers(id),
  variant VARCHAR(20),

  -- Credit decision
  credit_score INTEGER,
  decision VARCHAR(20), -- approve, review, reject
  credit_limit INTEGER,

  -- Outcome (measured after 90 days)
  outcome VARCHAR(20), -- good, default, null (pending)
  days_past_due INTEGER,
  total_repaid DECIMAL(10,2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 7.2 A/B Test Metrics

**Primary Metrics**:
1. **Default Rate**: % of loans that default (DPD 30+)
2. **Approval Rate**: % of applications approved
3. **Precision at 10%**: What % of top 10% scores are good loans

**Secondary Metrics**:
1. **Revenue per User**: Avg profit from approved loans
2. **Loss Rate**: % of principal lost to defaults
3. **Customer Satisfaction**: NPS score from approved customers

**Sample Size Calculation**:
```python
from scipy.stats import norm
import numpy as np

def calculate_sample_size(
    baseline_default_rate: float = 0.10,
    minimum_detectable_effect: float = 0.02,  # 2% reduction
    alpha: float = 0.05,  # 5% significance level
    power: float = 0.80  # 80% power
) -> int:
    """Calculate required sample size for A/B test"""
    z_alpha = norm.ppf(1 - alpha/2)
    z_beta = norm.ppf(power)

    p1 = baseline_default_rate
    p2 = baseline_default_rate - minimum_detectable_effect
    p_avg = (p1 + p2) / 2

    n = ((z_alpha * np.sqrt(2 * p_avg * (1 - p_avg)) +
          z_beta * np.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) / \
        ((p1 - p2) ** 2)

    return int(np.ceil(n))

# Example: Detect 2% reduction in 10% default rate
sample_size = calculate_sample_size(0.10, 0.02)
print(f"Required sample size per variant: {sample_size}")  # ~788 per variant
```

### 7.3 Statistical Significance Testing

```python
from scipy.stats import chi2_contingency

def test_statistical_significance(
    control_defaults: int,
    control_total: int,
    treatment_defaults: int,
    treatment_total: int
) -> dict:
    """
    Chi-square test for difference in default rates
    """
    # Contingency table
    observed = np.array([
        [control_defaults, control_total - control_defaults],
        [treatment_defaults, treatment_total - treatment_defaults]
    ])

    chi2, p_value, dof, expected = chi2_contingency(observed)

    control_rate = control_defaults / control_total
    treatment_rate = treatment_defaults / treatment_total
    relative_change = (treatment_rate - control_rate) / control_rate * 100

    return {
        'control_default_rate': control_rate,
        'treatment_default_rate': treatment_rate,
        'relative_change_pct': relative_change,
        'p_value': p_value,
        'is_significant': p_value < 0.05,
        'chi2': chi2
    }

# Example:
result = test_statistical_significance(
    control_defaults=80,
    control_total=800,
    treatment_defaults=64,
    treatment_total=800
)
print(result)
# {
#   'control_default_rate': 0.10 (10%),
#   'treatment_default_rate': 0.08 (8%),
#   'relative_change_pct': -20.0%,
#   'p_value': 0.032,
#   'is_significant': True
# }
```

---

## 7. Advanced Data Integration (Phase 3+)

### 7.1 MNO (Mobile Network Operator) Airtime Data Integration

**Business Value**: Airtime spending patterns are strong proxies for income and financial behavior in Zimbabwe where mobile money is dominant.

#### API Integration Architecture

```typescript
// MNO Data Aggregator Service
interface MNODataProvider {
  provider: 'econet' | 'netone' | 'telecel';
  getAirtimeHistory(phoneNumber: string, months: number): Promise<AirtimeData>;
  getDataBundleHistory(phoneNumber: string, months: number): Promise<DataBundleData>;
}

interface AirtimeData {
  phone_number: string;
  total_recharges_3m: number;
  avg_recharge_amount: number;
  recharge_frequency: number; // times per month
  last_recharge_date: Date;
  recharge_consistency_score: number; // 0-100
  peak_recharge_day_of_month: number; // Salary day indicator
  data_bundles_purchased_3m: number;
  total_data_spent_usd: number;
}

async function fetchMNOData(phoneNumber: string): Promise<AirtimeData> {
  // Determine MNO from phone prefix
  const mno = determineMNO(phoneNumber); // 0771 = Econet, 0712 = NetOne, etc.

  try {
    const response = await axios.post(`https://api.${mno}.co.zw/airtime-history`, {
      phone_number: phoneNumber,
      months: 6,
      api_key: process.env[`${mno.toUpperCase()}_API_KEY`]
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    return response.data;
  } catch (error) {
    // Fallback to CSV upload if API unavailable
    console.warn(`MNO API unavailable for ${mno}, using CSV fallback`);
    return null;
  }
}

// Scoring based on airtime patterns
function scoreAirtimePatterns(airtimeData: AirtimeData): number {
  let score = 0;

  // Consistent recharges = stable income (50 points)
  if (airtimeData.recharge_consistency_score >= 80) score += 50;
  else if (airtimeData.recharge_consistency_score >= 60) score += 35;
  else if (airtimeData.recharge_consistency_score >= 40) score += 20;

  // Recharge frequency (30 points)
  if (airtimeData.recharge_frequency >= 4) score += 30; // Weekly recharges
  else if (airtimeData.recharge_frequency >= 2) score += 20;
  else if (airtimeData.recharge_frequency >= 1) score += 10;

  // Average recharge amount (20 points)
  if (airtimeData.avg_recharge_amount >= 10) score += 20; // $10+ per recharge
  else if (airtimeData.avg_recharge_amount >= 5) score += 15;
  else if (airtimeData.avg_recharge_amount >= 2) score += 10;

  return Math.min(score, 100); // Max 100 points
}
```

### 7.2 Platform Integration (Gig Economy & Ride-Hailing)

**Use Case**: Finance drivers and gig workers based on their platform earnings and ratings

**Supported Platforms**:
- **InDrive**: P2P ride-hailing popular in Zimbabwe
- **Bolt**: Regional ride-hailing with API support
- **Uber**: International standard with driver API
- **Future**: Food delivery (Glovo), logistics (Sendy)

#### InDrive/Bolt Driver Verification

```typescript
interface PlatformDriverData {
  platform: 'indrive' | 'bolt' | 'uber';
  driver_id: string;
  verification_status: 'verified' | 'pending' | 'rejected';

  // Income data
  avg_monthly_earnings_usd: number;
  earnings_last_3_months: number[];
  income_consistency_score: number; // 0-100

  // Performance metrics
  total_trips: number;
  avg_rating: number; // 0-5
  cancellation_rate: number; // 0-1
  acceptance_rate: number; // 0-1
  driver_tenure_months: number;

  // Activity patterns
  active_days_per_week: number;
  peak_hours_worked: string[]; // ['morning', 'afternoon', 'evening', 'night']
  weekends_active: boolean;
}

// Platform API Integration
async function fetchPlatformData(
  platform: string,
  phoneNumber: string,
  userConsent: boolean
): Promise<PlatformDriverData | null> {

  if (!userConsent) {
    throw new Error('User consent required for platform data access');
  }

  // Example: InDrive API integration
  if (platform === 'indrive') {
    const response = await axios.post('https://api.indrive.com/driver/financial-data', {
      phone_number: phoneNumber,
      consent_token: userConsent,
      data_period_months: 6
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.INDRIVE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  // Add more platform integrations...

  return null;
}

// Scoring based on platform data
function scorePlatformDriver(driverData: PlatformDriverData): number {
  let score = 0;

  // Income level (40 points)
  if (driverData.avg_monthly_earnings_usd >= 500) score += 40;
  else if (driverData.avg_monthly_earnings_usd >= 300) score += 30;
  else if (driverData.avg_monthly_earnings_usd >= 200) score += 20;
  else if (driverData.avg_monthly_earnings_usd >= 100) score += 10;

  // Rating (30 points)
  if (driverData.avg_rating >= 4.8) score += 30;
  else if (driverData.avg_rating >= 4.5) score += 20;
  else if (driverData.avg_rating >= 4.0) score += 10;

  // Activity consistency (20 points)
  if (driverData.active_days_per_week >= 6) score += 20;
  else if (driverData.active_days_per_week >= 4) score += 15;
  else if (driverData.active_days_per_week >= 2) score += 10;

  // Tenure (10 points)
  if (driverData.driver_tenure_months >= 12) score += 10;
  else if (driverData.driver_tenure_months >= 6) score += 7;
  else if (driverData.driver_tenure_months >= 3) score += 5;

  return Math.min(score, 100);
}
```

### 7.3 CSV Data Upload & Processing

**Use Case**: When platform APIs are unavailable, allow manual CSV upload of income/employment data

**Supported File Types**:
- Platform earnings reports (InDrive, Bolt exports)
- Employer salary confirmations
- Bank statements
- Mobile money transaction history

#### CSV Upload Architecture

```typescript
// Admin Dashboard: Upload CSV for batch customer scoring
interface CSVUploadRequest {
  file: File; // CSV file
  data_type: 'platform_earnings' | 'salary_confirmation' | 'bank_statement' | 'mobile_money';
  source_platform?: string; // 'indrive', 'bolt', etc.
  uploaded_by: string; // Admin user ID
}

// CSV Parser with ML-based field detection
async function parseAndIngestCSV(uploadRequest: CSVUploadRequest): Promise<{
  records_processed: number;
  customers_matched: number;
  errors: string[];
}> {

  // 1. Upload to S3
  const s3Key = `csv-uploads/${Date.now()}-${uploadRequest.file.name}`;
  await s3.upload({
    Bucket: 'lynia-data-uploads',
    Key: s3Key,
    Body: uploadRequest.file
  }).promise();

  // 2. Parse CSV with Papa Parse
  const csvData = await parseCsvFile(uploadRequest.file);

  // 3. Detect field mappings (ML-based column detection)
  const fieldMappings = await detectFieldMappings(csvData.headers, uploadRequest.data_type);

  // 4. Process each row
  const results = {
    records_processed: 0,
    customers_matched: 0,
    errors: []
  };

  for (const row of csvData.rows) {
    try {
      // Extract phone number (key identifier)
      const phoneNumber = extractPhoneNumber(row, fieldMappings);

      // Find matching customer
      const customer = await supabase
        .from('customers')
        .select('id')
        .eq('phone_number', phoneNumber)
        .single();

      if (!customer) {
        results.errors.push(`No customer found for phone: ${phoneNumber}`);
        continue;
      }

      // Extract income/earnings data based on data_type
      const incomeData = extractIncomeData(row, fieldMappings, uploadRequest.data_type);

      // Store in alternative_income_sources table
      await supabase.from('alternative_income_sources').insert({
        customer_id: customer.id,
        source_type: uploadRequest.data_type,
        source_platform: uploadRequest.source_platform,
        monthly_income_usd: incomeData.monthly_income,
        income_consistency_score: incomeData.consistency_score,
        data_period_months: incomeData.period_months,
        raw_data: row, // Store for audit
        uploaded_by: uploadRequest.uploaded_by,
        upload_file_s3_key: s3Key
      });

      results.customers_matched++;
    } catch (error) {
      results.errors.push(`Row ${results.records_processed}: ${error.message}`);
    }

    results.records_processed++;
  }

  return results;
}

// ML-based field mapping (detects columns automatically)
async function detectFieldMappings(
  headers: string[],
  dataType: string
): Promise<Record<string, string>> {

  // Common field patterns for different data types
  const patterns = {
    'platform_earnings': {
      phone: ['phone', 'mobile', 'number', 'contact'],
      earnings: ['earnings', 'income', 'amount', 'total', 'revenue'],
      date: ['date', 'period', 'month', 'week'],
      trips: ['trips', 'rides', 'orders', 'deliveries']
    },
    'salary_confirmation': {
      phone: ['phone', 'mobile', 'employee_contact'],
      salary: ['salary', 'gross_pay', 'net_pay', 'amount'],
      employer: ['employer', 'company', 'organization'],
      date: ['pay_date', 'payment_date', 'month']
    },
    'bank_statement': {
      phone: ['account_holder_phone', 'mobile'],
      deposits: ['credit', 'deposit', 'incoming', 'received'],
      date: ['date', 'transaction_date', 'value_date']
    }
  };

  // Use fuzzy matching to map CSV headers to expected fields
  const mappings: Record<string, string> = {};
  const expectedFields = patterns[dataType];

  for (const [fieldName, searchTerms] of Object.entries(expectedFields)) {
    const matchedHeader = headers.find(header =>
      searchTerms.some(term =>
        header.toLowerCase().includes(term.toLowerCase())
      )
    );

    if (matchedHeader) {
      mappings[fieldName] = matchedHeader;
    }
  }

  return mappings;
}
```

**CSV Upload Flow**:
```
1. Admin uploads CSV via dashboard
2. System detects column mappings automatically
3. Parses data and matches to existing customers (by phone)
4. Stores in alternative_income_sources table
5. Updates credit score calculation to include new data
6. Returns summary report (records processed, errors)
```

### 7.4 African Fintech Models Reference

**Learning from Industry Leaders**:

#### 1. **Moove.io** - Mobility Financing Model
**What they do**: Finance vehicles for ride-hailing drivers (Uber, Bolt) in Nigeria, Ghana, South Africa

**Key Strategies We Adopt**:
- Platform integration for real-time earnings verification
- Weekly revenue-based repayments (aligned with driver income cycles)
- Asset tracking via GPS/telemetry (we use device locks instead)
- Driver ratings as creditworthiness indicator

**Lynia Implementation**:
```typescript
// Moove-inspired driver financing
interface DriverLoanTerms {
  platform: 'indrive' | 'bolt';
  weekly_repayment: number; // Based on avg weekly earnings
  repayment_as_pct_of_earnings: number; // Target: 20-25%
  automatic_deduction: boolean; // Via platform wallet integration
  credit_limit_based_on_3m_avg_earnings: boolean;
}
```

#### 2. **M-Kopa** - Pay-As-You-Go Device Financing
**What they do**: Finance solar panels and smartphones in Kenya, Uganda, Nigeria via daily micropayments

**Key Strategies We Adopt**:
- Device lock/unlock based on payment status ✅ (already implemented)
- Daily/weekly micro-repayments (we use monthly currently)
- Usage data as willingness-to-pay signal
- Graduation model: successful borrowers get larger credit limits

**Lynia Implementation**:
```typescript
// M-Kopa-inspired features (already implemented)
- Device lock after 7 days overdue ✅
- Credit limit increases after successful repayment ✅
- First-time customer bonuses ✅
- Remote device management ✅

// Future enhancements from M-Kopa model:
- Bi-weekly repayment option (aligned with payday cycles)
- Usage-based credit score adjustments
- Referral rewards (customers refer others)
```

#### 3. **GigMile** - Gig Economy Financing
**What they do**: Finance motorcycles and vehicles for gig workers (delivery, ride-hailing) in Nigeria

**Key Strategies We Adopt**:
- Multi-platform income aggregation (driver works on multiple apps)
- Earnings volatility modeling (gig income fluctuates)
- Performance metrics as credit indicators (ratings, completion rates)

**Lynia Implementation**:
```typescript
// GigMile-inspired multi-platform scoring
interface MultiPlatformIncome {
  platforms: {
    indrive_monthly_avg: number;
    bolt_monthly_avg: number;
    uber_monthly_avg: number;
  };
  total_monthly_income: number;
  income_volatility_score: number; // Lower is better
  diversification_bonus: number; // Extra points for multiple income streams
}

function scoreMultiPlatformWorker(income: MultiPlatformIncome): number {
  let score = 0;

  // Base income score (60 points)
  if (income.total_monthly_income >= 500) score += 60;
  else if (income.total_monthly_income >= 300) score += 40;
  else if (income.total_monthly_income >= 150) score += 20;

  // Diversification bonus (20 points)
  const activePlatforms = Object.values(income.platforms).filter(v => v > 0).length;
  if (activePlatforms >= 3) score += 20;
  else if (activePlatforms >= 2) score += 15;
  else if (activePlatforms >= 1) score += 10;

  // Low volatility bonus (20 points)
  if (income.income_volatility_score <= 0.2) score += 20; // Stable income
  else if (income.income_volatility_score <= 0.4) score += 10;

  return score;
}
```

---

## 8. Implementation Guide

### 8.1 Credit Scoring Service (Lambda)

**File**: `services/credit-scoring/handler.ts`

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { calculateRuleBasedScore, calculateHybridScore } from './scoring-engine';
import { getCustomer, getKYCResult } from './data-fetchers';
import { logCreditDecision } from './logging';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { customer_id } = JSON.parse(event.body || '{}');

    // 1. Fetch customer data
    const customer = await getCustomer(customer_id);
    const kycResult = await getKYCResult(customer_id);

    // 2. Prepare input
    const input = {
      kyc_result: kycResult,
      birth_date: new Date(customer.birth_date),
      employment_type: customer.employment_type,
      province: customer.province,
      city: customer.city,
      mobile_money_profile: await getMobileMoneyProfile(customer.phone_number),
      social_signals: null, // Optional
      is_first_loan: customer.loan_count === 0,
      referred_by: customer.referred_by,
      marketing_campaign: customer.marketing_campaign
    };

    // 3. Calculate credit score
    const result = await calculateHybridScore(input);

    // 4. Save to database
    await supabase.from('credit_scores').insert({
      customer_id,
      score: result.total_score,
      components: result.components,
      decision: result.decision,
      credit_limit: result.credit_limit,
      model_version: 'v1.0.0'
    });

    // 5. Log decision
    await logCreditDecision(customer_id, result);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Credit scoring error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
```

### 8.2 Database Schema

```sql
CREATE TABLE credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Score details
  score INTEGER NOT NULL CHECK (score BETWEEN 300 AND 850),
  components JSONB NOT NULL,

  -- Decision
  decision VARCHAR(20) NOT NULL, -- approve, review, reject
  credit_limit INTEGER DEFAULT 0,
  down_payment_pct DECIMAL(5,2),
  interest_rate_pct DECIMAL(5,2),

  -- Model metadata
  model_version VARCHAR(50) NOT NULL,
  model_type VARCHAR(20) DEFAULT 'rule_based', -- rule_based, hybrid, ml

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100)
);

CREATE INDEX idx_credit_scores_customer_id ON credit_scores(customer_id);
CREATE INDEX idx_credit_scores_score ON credit_scores(score);
CREATE INDEX idx_credit_scores_created_at ON credit_scores(created_at);
```

---

## 9. Monitoring & Evaluation

### 9.1 Model Performance Monitoring

**Track metrics** in real-time:

```typescript
interface ModelMetrics {
  approval_rate: number;
  avg_credit_score: number;
  tier_distribution: { tier1: number; tier2: number; tier3: number };

  // Measured after 30/60/90 days
  default_rate_30d: number;
  default_rate_60d: number;
  default_rate_90d: number;

  // Fairness metrics
  approval_rate_by_province: Record<string, number>;
  avg_score_by_age_group: Record<string, number>;
}

async function calculateModelMetrics(): Promise<ModelMetrics> {
  // Query last 30 days of credit decisions
  const { data: scores } = await supabase
    .from('credit_scores')
    .select('*')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const totalScores = scores.length;
  const approved = scores.filter(s => s.decision === 'approve');

  return {
    approval_rate: approved.length / totalScores,
    avg_credit_score: scores.reduce((sum, s) => sum + s.score, 0) / totalScores,
    tier_distribution: {
      tier1: approved.filter(s => s.credit_limit === 200).length / approved.length,
      tier2: approved.filter(s => s.credit_limit === 350).length / approved.length,
      tier3: approved.filter(s => s.credit_limit === 500).length / approved.length
    },
    // ... calculate default rates
  };
}
```

### 9.2 Alerting Thresholds

**CloudWatch Alarms**:

```typescript
const ALERT_THRESHOLDS = {
  approval_rate_min: 0.40, // Alert if <40% approval rate
  approval_rate_max: 0.80, // Alert if >80% (too lenient?)
  avg_credit_score_min: 650,
  default_rate_30d_max: 0.08, // Alert if >8% default rate
  processing_time_p95_max: 1000 // 1 second max
};
```

---

## Summary

This document defines the credit scoring algorithm for Lynia Finance:

1. **Hybrid Strategy**: Rule-based (Phase 1) → Hybrid (Phase 2) → ML-first (Phase 3)
2. **Rule-Based Scoring**: 6 components (KYC 35%, Age/Employment 25%, Geographic 15%, Mobile Money 15%, Social 5%, Bonus 5%)
3. **ML Model**: LightGBM with 60+ features, binary classification (default prediction)
4. **Feature Engineering**: 6 categories (KYC, demographics, mobile money, device/loan, behavioral, social)
5. **Model Versioning**: Semantic versioning with model registry (training → shadow → champion/challenger → production)
6. **A/B Testing**: Statistical significance testing, sample size calculation, metric tracking

**Key Decisions**:
- Score range: 300-850 (FICO-like)
- Auto-approve threshold: 650+ (60% target)
- Default definition: 30+ DPD or 2+ missed payments
- ML model: LightGBM (fast, interpretable)
- Model update frequency: Quarterly retraining

**Next Steps**: Design risk assessment framework (P1-T016) with fraud detection and portfolio risk management.
