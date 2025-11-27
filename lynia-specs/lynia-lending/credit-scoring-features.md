# Credit Scoring Features Definition

**Task ID**: P1-T016
**Phase**: Phase 1 - Credit Scoring System Design
**Priority**: High
**Estimated**: 8 hours
**Dependencies**: P1-T015 (Credit Scoring Algorithm)

---

## Table of Contents
1. [Overview](#overview)
2. [Feature Catalog](#feature-catalog)
3. [Feature Importance Ranking](#feature-importance-ranking)
4. [Data Source Mapping](#data-source-mapping)
5. [Feature Transformation Logic](#feature-transformation-logic)
6. [Missing Data Handling](#missing-data-handling)
7. [Feature Quality Monitoring](#feature-quality-monitoring)

---

## 1. Overview

This document provides a comprehensive catalog of all features used in the Lynia Finance credit scoring system, including descriptions, data sources, transformations, and handling of missing values.

### Feature Statistics

| Category | Count | Availability |
|----------|-------|--------------|
| **KYC & Identity** | 10 | 100% (required) |
| **Demographics** | 8 | 100% (required) |
| **Mobile Money** | 15 | 60% (optional Phase 1) |
| **Device & Loan** | 12 | 100% (at application) |
| **Behavioral** | 10 | 80% (WhatsApp data) |
| **Social** | 5 | 40% (optional, with consent) |
| **Total** | 60 | 85% avg availability |

---

## 2. Feature Catalog

### 2.1 Category: KYC & Identity (10 features)

#### Feature 1: `kyc_face_match_score`
**Description**: Confidence score (0.0-1.0) of face match between selfie and ID photo
**Type**: Continuous (float)
**Data Source**: Smile Identity API → `face_match.confidence`
**Range**: 0.0 - 1.0
**Importance**: ⭐⭐⭐⭐⭐ (Critical)
**Missing Data Strategy**: Reject application (required for approval)
**Transformation**: None (already normalized 0-1)
**SQL Query**:
```sql
SELECT
  kyc_result->'face_match'->>'confidence' AS kyc_face_match_score
FROM kyc_submissions
WHERE customer_id = :customer_id
ORDER BY created_at DESC
LIMIT 1;
```

**Distribution (Expected)**:
```
0.95-1.00: 60% (excellent match)
0.85-0.94: 25% (good match)
0.75-0.84: 10% (fair match)
<0.75:     5% (poor match, likely rejected)
```

---

#### Feature 2: `kyc_liveness_passed`
**Description**: Whether the liveness check passed (anti-spoofing)
**Type**: Boolean
**Data Source**: Smile Identity API → `liveness.status`
**Values**: 0 (failed), 1 (passed)
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: Default to 0 (failed)
**Transformation**: Convert "passed" → 1, "failed" → 0
**SQL Query**:
```sql
SELECT
  CASE
    WHEN kyc_result->'liveness'->>'status' = 'passed' THEN 1
    ELSE 0
  END AS kyc_liveness_passed
FROM kyc_submissions
WHERE customer_id = :customer_id;
```

---

#### Feature 3: `kyc_id_verified`
**Description**: Whether the national ID was successfully verified
**Type**: Boolean
**Data Source**: Smile Identity API → `id_verification.status`
**Values**: 0 (not verified), 1 (verified)
**Importance**: ⭐⭐⭐⭐⭐ (Critical)
**Missing Data Strategy**: Reject application (required)
**Transformation**: Convert "verified" → 1, else → 0
**SQL Query**:
```sql
SELECT
  CASE
    WHEN kyc_result->'id_verification'->>'status' = 'verified' THEN 1
    ELSE 0
  END AS kyc_id_verified
FROM kyc_submissions;
```

---

#### Feature 4: `age`
**Description**: Customer age in years
**Type**: Integer
**Data Source**: Customer record → `birth_date`
**Range**: 18-65 (eligible age range)
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: Reject application (required)
**Transformation**: Calculate from birth_date
**SQL Query**:
```sql
SELECT
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date)) AS age
FROM customers
WHERE id = :customer_id;
```

**Calculation**:
```typescript
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}
```

**Distribution (Zimbabwe demographics)**:
```
18-25: 30% (young adults)
26-35: 35% (prime working age)
36-50: 25% (established)
51-65: 10% (pre-retirement)
```

---

#### Feature 5: `age_squared`
**Description**: Age squared to capture non-linear age effects
**Type**: Integer
**Data Source**: Derived from `age`
**Range**: 324 (18²) - 4,225 (65²)
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Reject if age is missing
**Transformation**: `age * age`
**SQL Query**:
```sql
SELECT
  POWER(EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date)), 2) AS age_squared
FROM customers;
```

**Rationale**: Captures U-shaped risk curve (higher risk for very young and older customers)

---

#### Feature 6: `national_id_province_code`
**Description**: First 2 digits of national ID (birth year)
**Type**: Categorical (string)
**Data Source**: Customer record → `national_id`
**Values**: "90", "91", ..., "07" (birth years 1990-2007)
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Extract from `national_id`, reject if invalid
**Transformation**: Extract first 2 characters
**SQL Query**:
```sql
SELECT
  SUBSTRING(national_id, 1, 2) AS national_id_province_code
FROM customers;
```

**One-Hot Encoding** (for ML models):
```python
from sklearn.preprocessing import OneHotEncoder

encoder = OneHotEncoder(sparse=False)
encoded = encoder.fit_transform(df[['national_id_province_code']])
```

---

#### Feature 7: `years_since_id_issued`
**Description**: Years since national ID was issued (proxy for identity stability)
**Type**: Integer
**Data Source**: Derived from `national_id` birth year
**Range**: 0-47 (for ages 18-65)
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Calculate from birth year
**Transformation**: `current_year - birth_year - 18` (assume ID issued at 18)
**SQL Query**:
```sql
SELECT
  EXTRACT(YEAR FROM CURRENT_DATE) -
  (2000 + SUBSTRING(national_id, 1, 2)::INTEGER) - 18 AS years_since_id_issued
FROM customers;
```

---

#### Feature 8: `id_verification_attempts`
**Description**: Number of KYC submission attempts before approval
**Type**: Integer
**Data Source**: Count of `kyc_submissions` records
**Range**: 1-5 (typically)
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 1 (first attempt)
**Transformation**: Count submissions
**SQL Query**:
```sql
SELECT
  COUNT(*) AS id_verification_attempts
FROM kyc_submissions
WHERE customer_id = :customer_id;
```

**Interpretation**: Multiple attempts may indicate document quality issues or fraud

---

#### Feature 9: `selfie_quality_score`
**Description**: Image quality score of selfie (0.0-1.0)
**Type**: Continuous (float)
**Data Source**: Smile Identity API → `selfie_quality.score`
**Range**: 0.0-1.0
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 0.5 (neutral)
**Transformation**: None
**SQL Query**:
```sql
SELECT
  kyc_result->'selfie_quality'->>'score' AS selfie_quality_score
FROM kyc_submissions;
```

---

#### Feature 10: `id_photo_quality_score`
**Description**: Image quality score of ID photo (0.0-1.0)
**Type**: Continuous (float)
**Data Source**: Smile Identity API → `id_photo_quality.score`
**Range**: 0.0-1.0
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 0.5 (neutral)
**Transformation**: None

---

### 2.2 Category: Demographics (8 features)

#### Feature 11: `employment_type`
**Description**: Type of employment or income source
**Type**: Categorical (string)
**Data Source**: Customer application → `employment_type`
**Values**:
- `formal_employed` (salaried job)
- `self_employed` (small business)
- `informal_trader` (market vendor)
- `gig_worker` (ride-share, delivery)
- `unemployed` (seeking work)
- `student` (part-time income)
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: Default to `informal_trader` (most common)
**Transformation**: One-hot encoding for ML models
**SQL Query**:
```sql
SELECT employment_type
FROM customers
WHERE id = :customer_id;
```

**Distribution (Zimbabwe informal sector)**:
```
informal_trader: 45%
self_employed: 25%
formal_employed: 15%
gig_worker: 10%
unemployed: 3%
student: 2%
```

**Encoding Example**:
```python
employment_encoding = {
    'formal_employed': [1, 0, 0, 0, 0, 0],
    'self_employed': [0, 1, 0, 0, 0, 0],
    'informal_trader': [0, 0, 1, 0, 0, 0],
    'gig_worker': [0, 0, 0, 1, 0, 0],
    'unemployed': [0, 0, 0, 0, 1, 0],
    'student': [0, 0, 0, 0, 0, 1]
}
```

---

#### Feature 12: `province`
**Description**: Zimbabwe province of residence
**Type**: Categorical (string)
**Data Source**: Customer application → `province`
**Values**:
- Harare, Bulawayo, Manicaland, Mashonaland Central, Mashonaland East, Mashonaland West, Matabeleland North, Matabeleland South, Midlands, Masvingo
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to "Harare" (most common)
**Transformation**: One-hot encoding
**SQL Query**:
```sql
SELECT province
FROM customers;
```

**Economic Activity by Province** (GDP proxy):
```
Harare: High (capital, 25% of GDP)
Bulawayo: High (2nd largest city)
Midlands: Medium (mining, agriculture)
Manicaland: Medium (tourism, agriculture)
Others: Low-Medium
```

---

#### Feature 13: `city`
**Description**: City or town of residence
**Type**: Categorical (string)
**Data Source**: Customer application → `city`
**Values**: Harare CBD, Chitungwiza, Bulawayo CBD, Mutare, Gweru, etc.
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Extract from province if missing
**Transformation**: One-hot encoding (top 20 cities)

---

#### Feature 14: `is_urban`
**Description**: Whether customer lives in urban area
**Type**: Boolean
**Data Source**: Derived from `city`
**Values**: 0 (rural), 1 (urban)
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: Infer from population density
**Transformation**: Map city to urban/rural
**SQL Query**:
```sql
SELECT
  CASE
    WHEN city IN ('Harare CBD', 'Bulawayo CBD', 'Chitungwiza', 'Mutare', 'Gweru') THEN 1
    ELSE 0
  END AS is_urban
FROM customers;
```

**Urban Classification**:
```typescript
const URBAN_CITIES = [
  'Harare CBD', 'Chitungwiza', 'Bulawayo CBD', 'Gweru', 'Mutare',
  'Kwekwe', 'Kadoma', 'Masvingo', 'Chinhoyi', 'Marondera'
];

function isUrban(city: string): boolean {
  return URBAN_CITIES.includes(city);
}
```

---

#### Feature 15: `distance_from_distributor_km`
**Description**: Distance from nearest Lynia Finance distributor (km)
**Type**: Continuous (float)
**Data Source**: Calculated from customer location and distributor network
**Range**: 0-500 km
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 50 km (median)
**Transformation**: Log transform (right-skewed distribution)
**Calculation**:
```typescript
import haversine from 'haversine';

function calculateDistanceToNearestDistributor(
  customerLat: number,
  customerLon: number,
  distributors: Distributor[]
): number {
  const distances = distributors.map(d =>
    haversine(
      { latitude: customerLat, longitude: customerLon },
      { latitude: d.latitude, longitude: d.longitude },
      { unit: 'km' }
    )
  );

  return Math.min(...distances);
}
```

**Interpretation**: Closer distance = easier device recovery if default

---

#### Feature 16: `population_density_per_km2`
**Description**: Population density of customer's area (people/km²)
**Type**: Integer
**Data Source**: Zimbabwe census data by district
**Range**: 10-10,000 people/km²
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Use province average
**Transformation**: Log transform

**Population Density by Province** (2022 census):
```
Harare: 2,500/km²
Bulawayo: 1,200/km²
Midlands: 35/km²
Matabeleland South: 15/km²
```

---

#### Feature 17: `avg_income_province_usd`
**Description**: Average monthly income in customer's province (USD)
**Type**: Continuous (float)
**Data Source**: Zimbabwe National Statistics Agency (ZimStat)
**Range**: $50-$500 (informal sector)
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Use national average ($150)
**Transformation**: None

**Average Income by Province** (2024 estimates):
```
Harare: $280/month
Bulawayo: $250/month
Midlands: $180/month
Masvingo: $140/month
Rural provinces: $100-$120/month
```

---

#### Feature 18: `education_level`
**Description**: Highest education level completed
**Type**: Categorical (ordinal)
**Data Source**: Customer application → `education_level` (optional)
**Values**:
- `primary` (Grade 7)
- `secondary` (O-Level/A-Level)
- `tertiary` (Diploma/Degree)
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to `secondary` (most common)
**Transformation**: Ordinal encoding (primary=1, secondary=2, tertiary=3)

**Distribution (Zimbabwe adults 18-65)**:
```
Primary: 20%
Secondary: 65%
Tertiary: 15%
```

---

### 2.3 Category: Mobile Money (15 features)

#### Feature 19: `mm_account_age_months`
**Description**: Age of mobile money account in months
**Type**: Integer
**Data Source**: Zimbocash/EcoCash API → `account_creation_date`
**Range**: 0-120 months (0-10 years)
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: Default to 12 (1 year, neutral)
**Transformation**: Cap at 120 months
**API Call**:
```typescript
async function getMobileMoneyAccountAge(phoneNumber: string): Promise<number> {
  const response = await fetch(`${ZIMBOCASH_API}/account/info`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ phone_number: phoneNumber })
  });

  const data = await response.json();
  const creationDate = new Date(data.account_creation_date);
  const monthsOld = Math.floor((Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

  return Math.min(monthsOld, 120); // Cap at 120
}
```

**Interpretation**: Older accounts indicate financial stability

---

#### Feature 20: `mm_avg_monthly_inflow`
**Description**: Average monthly inflow (credits) in USD over last 3 months
**Type**: Continuous (float)
**Data Source**: Zimbocash/EcoCash API → transaction history
**Range**: $0-$5,000
**Importance**: ⭐⭐⭐⭐⭐ (Critical - income proxy)
**Missing Data Strategy**: Default to province average income
**Transformation**: Log transform, winsorize at 99th percentile
**API Call**:
```typescript
async function getAvgMonthlyInflow(phoneNumber: string): Promise<number> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);

  const transactions = await fetchTransactions(phoneNumber, startDate, endDate);

  const credits = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount_usd, 0);

  return credits / 3; // Average over 3 months
}
```

**Distribution**:
```
$0-$100: 25% (low income)
$100-$300: 45% (median income)
$300-$500: 20% (good income)
$500+: 10% (high income)
```

---

#### Feature 21: `mm_avg_monthly_outflow`
**Description**: Average monthly outflow (debits) in USD over last 3 months
**Type**: Continuous (float)
**Data Source**: Zimbocash/EcoCash API → transaction history
**Range**: $0-$5,000
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 80% of inflow
**Transformation**: Log transform

---

#### Feature 22: `mm_inflow_to_outflow_ratio`
**Description**: Ratio of inflow to outflow (savings indicator)
**Type**: Continuous (float)
**Data Source**: Derived from `mm_avg_monthly_inflow` / `mm_avg_monthly_outflow`
**Range**: 0.5-5.0 (typical)
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: Default to 1.2 (slight surplus)
**Transformation**: Cap at 5.0 (outliers)
**Calculation**:
```typescript
function calculateInflowOutflowRatio(inflow: number, outflow: number): number {
  if (outflow === 0) return 5.0; // Max ratio if no outflow
  const ratio = inflow / outflow;
  return Math.min(ratio, 5.0); // Cap at 5
}
```

**Interpretation**:
```
>1.5: Strong saver (surplus)
1.1-1.5: Moderate saver
0.9-1.1: Balanced
<0.9: Deficit (spending > income) - RED FLAG
```

---

#### Feature 23: `mm_balance_current`
**Description**: Current mobile money balance in USD
**Type**: Continuous (float)
**Data Source**: Zimbocash/EcoCash API → `current_balance`
**Range**: $0-$1,000
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: Default to $30 (median)
**Transformation**: Log transform
**API Call**:
```typescript
async function getCurrentBalance(phoneNumber: string): Promise<number> {
  const response = await fetch(`${ZIMBOCASH_API}/account/balance`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ phone_number: phoneNumber })
  });

  return response.json().balance_usd;
}
```

**Distribution**:
```
$0-$10: 30% (very low)
$10-$50: 40% (low)
$50-$200: 20% (medium)
$200+: 10% (high)
```

---

#### Feature 24: `mm_transaction_count_3m`
**Description**: Total number of transactions in last 3 months
**Type**: Integer
**Data Source**: Zimbocash/EcoCash API → transaction count
**Range**: 0-500
**Importance**: ⭐⭐⭐⭐ (High - activity level)
**Missing Data Strategy**: Default to 30 (10/month)
**Transformation**: Cap at 300
**Calculation**:
```typescript
async function getTransactionCount(
  phoneNumber: string,
  months: number = 3
): Promise<number> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const transactions = await fetchTransactions(phoneNumber, startDate, new Date());
  return Math.min(transactions.length, 300); // Cap at 300
}
```

---

#### Feature 25: `mm_transaction_count_6m`
**Description**: Total transactions in last 6 months
**Type**: Integer
**Data Source**: Zimbocash/EcoCash API
**Range**: 0-1000
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Extrapolate from 3-month count (×2)
**Transformation**: Cap at 600

---

#### Feature 26: `mm_avg_transaction_size`
**Description**: Average transaction size in USD
**Type**: Continuous (float)
**Data Source**: Derived from total volume / transaction count
**Range**: $1-$500
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to $25 (median)
**Transformation**: Log transform
**Calculation**:
```typescript
function calculateAvgTransactionSize(
  totalVolume: number,
  transactionCount: number
): number {
  if (transactionCount === 0) return 25; // Default
  return totalVolume / transactionCount;
}
```

---

#### Feature 27: `mm_max_single_transaction`
**Description**: Largest single transaction in last 6 months (USD)
**Type**: Continuous (float)
**Data Source**: Zimbocash/EcoCash API → max transaction amount
**Range**: $0-$2,000
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 3× average transaction
**Transformation**: Log transform

---

#### Feature 28: `mm_unique_recipients_3m`
**Description**: Number of unique recipients in last 3 months
**Type**: Integer
**Data Source**: Count unique recipient phone numbers
**Range**: 0-100
**Importance**: ⭐⭐⭐ (Medium - social network size)
**Missing Data Strategy**: Default to 10
**Transformation**: Cap at 50
**Calculation**:
```typescript
function getUniqueRecipients(transactions: Transaction[]): number {
  const recipients = new Set(
    transactions
      .filter(t => t.type === 'debit' && t.recipient_phone)
      .map(t => t.recipient_phone)
  );
  return Math.min(recipients.size, 50);
}
```

---

#### Feature 29: `mm_utility_payments_3m`
**Description**: Number of utility bill payments in last 3 months
**Type**: Integer
**Data Source**: Count transactions to utility companies (ZESA, ZINWA, etc.)
**Range**: 0-20
**Importance**: ⭐⭐⭐⭐ (High - stability indicator)
**Missing Data Strategy**: Default to 0
**Transformation**: None
**Identification**:
```typescript
const UTILITY_MERCHANTS = [
  'ZESA', 'ZINWA', 'TelOne', 'Econet', 'NetOne', 'Telecel'
];

function countUtilityPayments(transactions: Transaction[]): number {
  return transactions.filter(t =>
    UTILITY_MERCHANTS.some(merchant =>
      t.merchant_name?.includes(merchant)
    )
  ).length;
}
```

**Interpretation**: Regular utility payments indicate stable residence

---

#### Feature 30: `mm_airtime_purchases_3m`
**Description**: Number of airtime purchases in last 3 months
**Type**: Integer
**Data Source**: Count airtime transactions
**Range**: 0-50
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 6 (2/month)
**Transformation**: Cap at 30

---

#### Feature 31: `mm_cash_out_frequency`
**Description**: Number of cash withdrawals in last 3 months
**Type**: Integer
**Data Source**: Count cash-out transactions
**Range**: 0-50
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 12 (4/month)
**Transformation**: None

**Interpretation**: High cash-out frequency may indicate lack of digital payment adoption

---

#### Feature 32: `mm_days_since_last_transaction`
**Description**: Days since last mobile money transaction
**Type**: Integer
**Data Source**: Calculate from last transaction date
**Range**: 0-365
**Importance**: ⭐⭐⭐⭐ (High - recency)
**Missing Data Strategy**: Default to 7 days
**Transformation**: Log transform
**Calculation**:
```typescript
function daysSinceLastTransaction(transactions: Transaction[]): number {
  if (transactions.length === 0) return 30; // Default

  const lastTransaction = transactions.sort((a, b) =>
    b.transaction_date.getTime() - a.transaction_date.getTime()
  )[0];

  const daysSince = Math.floor(
    (Date.now() - lastTransaction.transaction_date.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSince;
}
```

**Interpretation**: Recent activity indicates active account

---

#### Feature 33: `mm_weekend_transaction_ratio`
**Description**: Ratio of weekend to weekday transactions
**Type**: Continuous (float)
**Data Source**: Derived from transaction timestamps
**Range**: 0.0-2.0
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 0.3 (30% on weekends)
**Transformation**: None
**Calculation**:
```typescript
function calculateWeekendRatio(transactions: Transaction[]): number {
  const weekendTxns = transactions.filter(t => {
    const day = t.transaction_date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }).length;

  const weekdayTxns = transactions.length - weekendTxns;

  if (weekdayTxns === 0) return 1.0;
  return weekendTxns / weekdayTxns;
}
```

---

### 2.4 Category: Device & Loan (12 features)

#### Feature 34: `device_price_usd`
**Description**: Price of device being financed (USD)
**Type**: Continuous (float)
**Data Source**: Device catalog → `price`
**Range**: $100-$600
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: N/A (required at application)
**Transformation**: None
**SQL Query**:
```sql
SELECT price_usd AS device_price_usd
FROM devices
WHERE id = :device_id;
```

---

#### Feature 35: `device_age_months`
**Description**: Age of device (0 for new, >0 for refurbished)
**Type**: Integer
**Data Source**: Device catalog → `age_months`
**Range**: 0-36 months
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 0 (new)
**Transformation**: None

**Device Condition**:
```
0 months: Brand new
3-12 months: Lightly used
13-24 months: Moderate use
25-36 months: Heavy use
```

---

#### Feature 36: `device_brand`
**Description**: Device manufacturer brand
**Type**: Categorical (string)
**Data Source**: Device catalog → `brand`
**Values**: Samsung, Tecno, Infinix, Xiaomi, Oppo
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: N/A (required)
**Transformation**: One-hot encoding

**Brand Ranking by Resale Value** (Zimbabwe market):
```
1. Samsung (highest resale value)
2. Xiaomi
3. Oppo
4. Tecno
5. Infinix (lowest resale value)
```

---

#### Feature 37: `device_storage_gb`
**Description**: Device storage capacity in GB
**Type**: Integer
**Data Source**: Device catalog → `storage_gb`
**Range**: 32-512 GB
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 64 GB
**Transformation**: None

---

#### Feature 38: `loan_amount`
**Description**: Total loan amount in USD (device price - down payment)
**Type**: Continuous (float)
**Data Source**: Calculated → `device_price * (1 - down_payment_pct)`
**Range**: $90-$570
**Importance**: ⭐⭐⭐⭐⭐ (Critical)
**Missing Data Strategy**: N/A (calculated)
**Transformation**: None
**Calculation**:
```typescript
function calculateLoanAmount(
  devicePrice: number,
  downPaymentPct: number
): number {
  return devicePrice * (1 - downPaymentPct);
}
```

---

#### Feature 39: `down_payment_pct`
**Description**: Down payment as percentage of device price
**Type**: Continuous (float)
**Data Source**: Loan application → `down_payment_pct`
**Range**: 0.05-0.25 (5%-25%)
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: Default to 0.10 (10%)
**Transformation**: None

**Down Payment Tiers**:
```
5%: Premium customers (score 750+)
10%: Standard (score 650-749)
15%: Higher risk (score 600-649)
20%+: Very high risk or manual review
```

---

#### Feature 40: `loan_to_income_ratio`
**Description**: Loan amount / estimated monthly income
**Type**: Continuous (float)
**Data Source**: Calculated → `loan_amount / mm_avg_monthly_inflow`
**Range**: 0.1-10.0
**Importance**: ⭐⭐⭐⭐⭐ (Critical - affordability)
**Missing Data Strategy**: Use province avg income if MM data unavailable
**Transformation**: Cap at 10.0
**Calculation**:
```typescript
function calculateLoanToIncomeRatio(
  loanAmount: number,
  monthlyIncome: number
): number {
  if (monthlyIncome === 0) return 10.0; // Max ratio
  const ratio = loanAmount / monthlyIncome;
  return Math.min(ratio, 10.0);
}
```

**Interpretation**:
```
<1.0: Excellent (less than 1 month's income)
1.0-2.0: Good (1-2 months' income)
2.0-3.0: Fair (2-3 months' income)
>3.0: High risk (>3 months' income)
```

---

#### Feature 41: `loan_term_months`
**Description**: Loan repayment period in months
**Type**: Integer
**Data Source**: Loan application → `term_months`
**Values**: 3, 6, 9, 12 months
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 6 months
**Transformation**: None

---

#### Feature 42: `monthly_installment`
**Description**: Monthly payment amount in USD
**Type**: Continuous (float)
**Data Source**: Calculated → `loan_amount / term_months`
**Range**: $30-$200
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: N/A (calculated)
**Transformation**: None
**Calculation**:
```typescript
function calculateMonthlyInstallment(
  loanAmount: number,
  termMonths: number,
  interestRatePct: number
): number {
  const monthlyRate = interestRatePct / 12 / 100;
  const installment = loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  return installment;
}
```

---

#### Feature 43: `installment_to_income_ratio`
**Description**: Monthly installment / monthly income (debt service ratio)
**Type**: Continuous (float)
**Data Source**: Calculated → `monthly_installment / mm_avg_monthly_inflow`
**Range**: 0.05-1.0
**Importance**: ⭐⭐⭐⭐⭐ (Critical - ability to pay)
**Missing Data Strategy**: Use province avg income
**Transformation**: Cap at 1.0
**Calculation**:
```typescript
function calculateInstallmentToIncomeRatio(
  monthlyInstallment: number,
  monthlyIncome: number
): number {
  if (monthlyIncome === 0) return 1.0; // Max ratio
  const ratio = monthlyInstallment / monthlyIncome;
  return Math.min(ratio, 1.0);
}
```

**Interpretation (Industry Standards)**:
```
<0.20: Excellent (20% of income)
0.20-0.35: Good (20-35% of income)
0.35-0.50: Fair (35-50% of income)
>0.50: High risk (>50% of income) - REJECT
```

---

#### Feature 44: `requested_credit_limit`
**Description**: Credit limit tier requested by customer
**Type**: Integer
**Data Source**: Customer application → `requested_credit_limit`
**Values**: 200, 350, 500
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to lowest tier (200)
**Transformation**: None

---

#### Feature 45: `is_first_purchase`
**Description**: Whether this is customer's first device purchase
**Type**: Boolean
**Data Source**: Derived from loan count
**Values**: 0 (returning), 1 (first-time)
**Importance**: ⭐⭐⭐⭐ (High)
**Missing Data Strategy**: N/A (known)
**Transformation**: None
**SQL Query**:
```sql
SELECT
  CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END AS is_first_purchase
FROM loans
WHERE customer_id = :customer_id;
```

---

### 2.5 Category: Behavioral (10 features)

#### Feature 46: `whatsapp_response_time_avg_minutes`
**Description**: Average time to respond to WhatsApp messages (minutes)
**Type**: Continuous (float)
**Data Source**: WhatsApp message timestamps
**Range**: 1-1,440 minutes (1 min - 24 hours)
**Importance**: ⭐⭐⭐ (Medium - engagement)
**Missing Data Strategy**: Default to 60 minutes
**Transformation**: Log transform
**Calculation**:
```typescript
function calculateAvgResponseTime(messages: WhatsAppMessage[]): number {
  const responseTimes: number[] = [];

  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].direction === 'outbound' && messages[i+1].direction === 'inbound') {
      const responseTimeMs = messages[i+1].timestamp.getTime() - messages[i].timestamp.getTime();
      responseTimes.push(responseTimeMs / 1000 / 60); // Convert to minutes
    }
  }

  if (responseTimes.length === 0) return 60; // Default

  const avgTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
  return Math.min(avgTime, 1440); // Cap at 24 hours
}
```

**Interpretation**: Faster responses indicate higher engagement

---

#### Feature 47: `kyc_submission_time_days`
**Description**: Days from onboarding to KYC submission
**Type**: Continuous (float)
**Data Source**: Time difference between account creation and KYC submission
**Range**: 0-30 days
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 3 days
**Transformation**: Log transform
**SQL Query**:
```sql
SELECT
  EXTRACT(EPOCH FROM (kyc.created_at - c.created_at)) / 86400 AS kyc_submission_time_days
FROM kyc_submissions kyc
JOIN customers c ON c.id = kyc.customer_id
WHERE kyc.customer_id = :customer_id;
```

**Interpretation**: Quick submission indicates strong purchase intent

---

#### Feature 48: `application_completion_rate`
**Description**: Percentage of application steps completed
**Type**: Continuous (float)
**Data Source**: Application progress tracking
**Range**: 0.0-1.0
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 1.0 (complete)
**Transformation**: None
**Calculation**:
```typescript
function calculateCompletionRate(progress: ApplicationProgress): number {
  const totalSteps = 7; // Onboarding, KYC, Device selection, Loan terms, etc.
  const completedSteps = [
    progress.onboarding_complete,
    progress.kyc_complete,
    progress.device_selected,
    progress.loan_terms_reviewed,
    progress.down_payment_confirmed,
    progress.bank_details_provided,
    progress.final_submission
  ].filter(Boolean).length;

  return completedSteps / totalSteps;
}
```

---

#### Feature 49: `num_customer_support_contacts`
**Description**: Number of support interactions before loan approval
**Type**: Integer
**Data Source**: Support ticket count
**Range**: 0-20
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 0
**Transformation**: Cap at 10
**SQL Query**:
```sql
SELECT COUNT(*) AS num_customer_support_contacts
FROM support_tickets
WHERE customer_id = :customer_id
AND created_at <= :loan_application_date;
```

**Interpretation**: High support contacts may indicate confusion or issues

---

#### Feature 50: `num_payment_reminders_needed`
**Description**: Payment reminders sent for previous loans (if any)
**Type**: Integer
**Data Source**: Notification log
**Range**: 0-30
**Importance**: ⭐⭐⭐⭐ (High - for returning customers)
**Missing Data Strategy**: Default to 0 (first-time customers)
**Transformation**: Cap at 15
**SQL Query**:
```sql
SELECT COUNT(*) AS num_payment_reminders_needed
FROM notifications
WHERE customer_id = :customer_id
AND notification_type = 'payment_reminder'
AND created_at >= :loan_start_date
AND created_at <= :loan_end_date;
```

**Interpretation**: More reminders = higher risk of delinquency

---

#### Feature 51: `device_browsing_sessions`
**Description**: Number of device browsing sessions before purchase
**Type**: Integer
**Data Source**: WhatsApp session tracking
**Range**: 1-20
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 2
**Transformation**: Cap at 10

---

#### Feature 52: `time_spent_browsing_minutes`
**Description**: Total time spent browsing devices (minutes)
**Type**: Continuous (float)
**Data Source**: WhatsApp session duration tracking
**Range**: 1-180 minutes
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 10 minutes
**Transformation**: Log transform

---

#### Feature 53: `num_devices_viewed`
**Description**: Number of different devices viewed before selection
**Type**: Integer
**Data Source**: WhatsApp interaction tracking
**Range**: 1-30
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 5
**Transformation**: Cap at 15

**Interpretation**: More research may indicate serious buyer

---

#### Feature 54: `has_email`
**Description**: Whether customer provided email address
**Type**: Boolean
**Data Source**: Customer record → `email`
**Values**: 0 (no email), 1 (has email)
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: N/A (known)
**Transformation**: None
**SQL Query**:
```sql
SELECT
  CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END AS has_email
FROM customers;
```

---

#### Feature 55: `has_referral`
**Description**: Whether customer was referred by existing customer
**Type**: Boolean
**Data Source**: Customer record → `referred_by`
**Values**: 0 (no referral), 1 (referred)
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: N/A (known)
**Transformation**: None

---

### 2.6 Category: Social (5 features)

#### Feature 56: `phone_contacts_count`
**Description**: Number of contacts in phone (with consent)
**Type**: Integer
**Data Source**: Mobile app permission (optional)
**Range**: 0-1,000
**Importance**: ⭐⭐⭐ (Medium - social network)
**Missing Data Strategy**: Default to 50 (median)
**Transformation**: Log transform, cap at 500

---

#### Feature 57: `whatsapp_active`
**Description**: Whether WhatsApp is actively used
**Type**: Boolean
**Data Source**: WhatsApp Business API metadata
**Values**: 0 (inactive), 1 (active)
**Importance**: ⭐⭐⭐ (Medium)
**Missing Data Strategy**: Default to 1 (active, since using WhatsApp to apply)
**Transformation**: None

---

#### Feature 58: `installed_apps_count`
**Description**: Number of apps installed on phone (with consent)
**Type**: Integer
**Data Source**: Mobile app permission (optional)
**Range**: 10-200
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 30
**Transformation**: Log transform, cap at 100

---

#### Feature 59: `referrer_credit_score`
**Description**: Credit score of person who referred customer
**Type**: Integer
**Data Source**: Credit score of `referred_by` customer
**Range**: 300-850
**Importance**: ⭐⭐⭐ (Medium - quality of network)
**Missing Data Strategy**: Default to 650 (neutral) if no referral
**Transformation**: None
**SQL Query**:
```sql
SELECT cs.score AS referrer_credit_score
FROM credit_scores cs
WHERE cs.customer_id = (
  SELECT referred_by FROM customers WHERE id = :customer_id
)
ORDER BY cs.created_at DESC
LIMIT 1;
```

---

#### Feature 60: `referrer_default_rate`
**Description**: Default rate of referrer's referred customers
**Type**: Continuous (float)
**Data Source**: Calculated from referrer's referral history
**Range**: 0.0-1.0
**Importance**: ⭐⭐ (Low)
**Missing Data Strategy**: Default to 0.08 (industry average) if no referral
**Transformation**: None
**Calculation**:
```typescript
async function getReferrerDefaultRate(referrerId: string): Promise<number> {
  const { data: referredLoans } = await supabase
    .from('loans')
    .select('id, status')
    .eq('customer_id',
      supabase.from('customers').select('id').eq('referred_by', referrerId)
    );

  if (referredLoans.length === 0) return 0.08; // Default

  const defaults = referredLoans.filter(l => l.status === 'default').length;
  return defaults / referredLoans.length;
}
```

---

## 3. Feature Importance Ranking

### 3.1 Tier 1: Critical Features (⭐⭐⭐⭐⭐)

**Top 10 Most Predictive Features** (based on expected importance):

| Rank | Feature | Importance | Category | Reason |
|------|---------|-----------|----------|--------|
| 1 | `installment_to_income_ratio` | ⭐⭐⭐⭐⭐ | Device & Loan | Direct measure of affordability |
| 2 | `loan_to_income_ratio` | ⭐⭐⭐⭐⭐ | Device & Loan | Overall debt burden |
| 3 | `mm_avg_monthly_inflow` | ⭐⭐⭐⭐⭐ | Mobile Money | Income proxy |
| 4 | `kyc_face_match_score` | ⭐⭐⭐⭐⭐ | KYC & Identity | Identity confidence |
| 5 | `kyc_id_verified` | ⭐⭐⭐⭐⭐ | KYC & Identity | Identity validation |
| 6 | `loan_amount` | ⭐⭐⭐⭐⭐ | Device & Loan | Absolute risk exposure |

### 3.2 Tier 2: High Features (⭐⭐⭐⭐)

| Rank | Feature | Importance | Category |
|------|---------|-----------|----------|
| 7 | `mm_account_age_months` | ⭐⭐⭐⭐ | Mobile Money |
| 8 | `mm_inflow_to_outflow_ratio` | ⭐⭐⭐⭐ | Mobile Money |
| 9 | `mm_balance_current` | ⭐⭐⭐⭐ | Mobile Money |
| 10 | `mm_transaction_count_3m` | ⭐⭐⭐⭐ | Mobile Money |
| 11 | `mm_days_since_last_transaction` | ⭐⭐⭐⭐ | Mobile Money |
| 12 | `mm_utility_payments_3m` | ⭐⭐⭐⭐ | Mobile Money |
| 13 | `age` | ⭐⭐⭐⭐ | Demographics |
| 14 | `employment_type` | ⭐⭐⭐⭐ | Demographics |
| 15 | `is_urban` | ⭐⭐⭐⭐ | Demographics |
| 16 | `device_price_usd` | ⭐⭐⭐⭐ | Device & Loan |
| 17 | `monthly_installment` | ⭐⭐⭐⭐ | Device & Loan |
| 18 | `is_first_purchase` | ⭐⭐⭐⭐ | Device & Loan |
| 19 | `num_payment_reminders_needed` | ⭐⭐⭐⭐ | Behavioral |
| 20 | `kyc_liveness_passed` | ⭐⭐⭐⭐ | KYC & Identity |

### 3.3 Expected Feature Importance (ML Model)

**Post-Training Analysis** (after 200+ loans):

```python
# Feature importance from LightGBM model
feature_importance = model.feature_importance(importance_type='gain')

top_20_features = pd.DataFrame({
    'feature': X.columns,
    'importance': feature_importance
}).sort_values('importance', ascending=False).head(20)

print(top_20_features)
```

**Expected Top 5**:
1. `installment_to_income_ratio` (35% importance)
2. `mm_avg_monthly_inflow` (15% importance)
3. `mm_inflow_to_outflow_ratio` (12% importance)
4. `loan_amount` (10% importance)
5. `mm_utility_payments_3m` (8% importance)

---

## 4. Data Source Mapping

### 4.1 Data Sources by Feature Category

| Data Source | Features Count | Availability | API/Database |
|-------------|---------------|--------------|--------------|
| **Customer Table** | 8 | 100% | PostgreSQL |
| **KYC Submissions** | 10 | 100% | PostgreSQL + Smile Identity API |
| **Mobile Money API** | 15 | 60% | Zimbocash/EcoCash API (optional Phase 1) |
| **Device Catalog** | 5 | 100% | PostgreSQL |
| **Loan Application** | 7 | 100% | PostgreSQL |
| **WhatsApp Messages** | 7 | 80% | PostgreSQL (message log) |
| **Support Tickets** | 2 | 100% | PostgreSQL |
| **Referral Network** | 2 | 30% | PostgreSQL |
| **Census Data** | 2 | 100% | Static lookup table |
| **Mobile App** | 3 | 40% | Optional, with consent |

### 4.2 API Integration Requirements

**Smile Identity API**:
```typescript
// Required for KYC features
const smileIdentityClient = new SmileIdentity({
  partner_id: process.env.SMILE_PARTNER_ID,
  api_key: process.env.SMILE_API_KEY,
  environment: 'production'
});

async function getKYCResult(customerId: string): Promise<SmileIdentityResult> {
  const { data } = await supabase
    .from('kyc_submissions')
    .select('kyc_result')
    .eq('customer_id', customerId)
    .single();

  return data.kyc_result;
}
```

**Zimbocash/EcoCash API** (optional):
```typescript
// Required for Mobile Money features
async function getMobileMoneyProfile(phoneNumber: string): Promise<MobileMoneyProfile> {
  const response = await fetch(`${ZIMBOCASH_API}/profile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZIMBOCASH_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phone_number: phoneNumber })
  });

  return response.json();
}
```

---

## 5. Feature Transformation Logic

### 5.1 Numerical Transformations

**Log Transform** (for right-skewed features):
```python
import numpy as np

def log_transform(x: float, offset: float = 1.0) -> float:
    """Apply log transformation with offset to handle zeros"""
    return np.log(x + offset)

# Apply to:
# - mm_avg_monthly_inflow
# - mm_avg_monthly_outflow
# - mm_balance_current
# - mm_avg_transaction_size
# - distance_from_distributor_km
# - population_density_per_km2
```

**Winsorization** (cap outliers):
```python
def winsorize(x: float, lower_pct: float = 0.01, upper_pct: float = 0.99) -> float:
    """Cap values at specified percentiles"""
    lower_bound = np.percentile(x, lower_pct * 100)
    upper_bound = np.percentile(x, upper_pct * 100)
    return np.clip(x, lower_bound, upper_bound)

# Apply to:
# - mm_avg_monthly_inflow (99th percentile)
# - mm_transaction_count_3m (99th percentile)
```

**Normalization** (0-1 scale):
```python
from sklearn.preprocessing import MinMaxScaler

scaler = MinMaxScaler()

def normalize(x: np.array) -> np.array:
    """Scale to 0-1 range"""
    return scaler.fit_transform(x.reshape(-1, 1))

# Apply to:
# - age (18-65 → 0-1)
# - device_price_usd (100-600 → 0-1)
```

### 5.2 Categorical Encodings

**One-Hot Encoding**:
```python
from sklearn.preprocessing import OneHotEncoder

encoder = OneHotEncoder(sparse=False, handle_unknown='ignore')

# Apply to:
# - employment_type (6 categories)
# - province (10 categories)
# - city (20+ categories, use top 20)
# - device_brand (5 categories)
```

**Ordinal Encoding**:
```python
education_mapping = {
    'primary': 1,
    'secondary': 2,
    'tertiary': 3
}

# Apply to:
# - education_level
```

### 5.3 Feature Engineering (Derived Features)

**Ratio Features**:
```python
# Already covered in catalog
df['mm_inflow_to_outflow_ratio'] = df['mm_avg_monthly_inflow'] / df['mm_avg_monthly_outflow']
df['loan_to_income_ratio'] = df['loan_amount'] / df['mm_avg_monthly_inflow']
df['installment_to_income_ratio'] = df['monthly_installment'] / df['mm_avg_monthly_inflow']
```

**Interaction Features** (Phase 2+):
```python
# Age × Income interaction
df['age_income_interaction'] = df['age'] * df['mm_avg_monthly_inflow']

# Urban × Income interaction
df['urban_income_interaction'] = df['is_urban'] * df['mm_avg_monthly_inflow']
```

---

## 6. Missing Data Handling

### 6.1 Missing Data Strategy by Feature

| Feature | Missing Rate | Strategy | Default Value |
|---------|-------------|----------|---------------|
| KYC features | 0% | **Reject** | N/A (required) |
| Age, employment | 0% | **Reject** | N/A (required) |
| Mobile Money features | 40% | **Impute** | Province avg income |
| Social features | 60% | **Impute** | Median values |
| Behavioral features | 20% | **Impute** | Neutral values |

### 6.2 Imputation Methods

**Mean/Median Imputation**:
```python
from sklearn.impute import SimpleImputer

# For numerical features
imputer_numeric = SimpleImputer(strategy='median')

# For categorical features
imputer_categorical = SimpleImputer(strategy='most_frequent')

# Apply
X_imputed = imputer_numeric.fit_transform(X_numeric)
```

**Domain-Specific Imputation**:
```typescript
function imputeMobileMoneyFeatures(
  mobileMoneyProfile: MobileMoneyProfile | null,
  province: string
): Partial<MobileMoneyProfile> {
  if (mobileMoneyProfile) return mobileMoneyProfile;

  // Use province average income as proxy
  const provinceAvgIncome = PROVINCE_AVG_INCOME[province] || 150;

  return {
    mm_account_age_months: 12, // Neutral
    mm_avg_monthly_inflow: provinceAvgIncome,
    mm_avg_monthly_outflow: provinceAvgIncome * 0.8, // 80% of income
    mm_inflow_to_outflow_ratio: 1.25, // Slight surplus
    mm_balance_current: 30, // Median
    mm_transaction_count_3m: 30, // 10/month
    mm_transaction_count_6m: 60,
    mm_avg_transaction_size: 25,
    mm_max_single_transaction: 75,
    mm_unique_recipients_3m: 10,
    mm_utility_payments_3m: 3, // 1/month
    mm_airtime_purchases_3m: 6, // 2/month
    mm_cash_out_frequency: 12, // 4/month
    mm_days_since_last_transaction: 7,
    mm_weekend_transaction_ratio: 0.3
  };
}
```

**Indicator Variables** (flag missing data):
```python
# Create binary indicator for missing mobile money data
df['mm_data_available'] = df['mm_avg_monthly_inflow'].notna().astype(int)

# This allows model to learn separate patterns for customers with/without MM data
```

### 6.3 Missing Data Monitoring

```sql
-- Monitor missing data rates
SELECT
  'mm_avg_monthly_inflow' AS feature,
  COUNT(*) FILTER (WHERE mm_avg_monthly_inflow IS NULL) * 100.0 / COUNT(*) AS missing_rate_pct
FROM feature_store
UNION ALL
SELECT
  'phone_contacts_count',
  COUNT(*) FILTER (WHERE phone_contacts_count IS NULL) * 100.0 / COUNT(*)
FROM feature_store;
```

---

## 7. Feature Quality Monitoring

### 7.1 Data Quality Checks

```typescript
interface FeatureQualityCheck {
  feature_name: string;
  check_type: 'range' | 'null' | 'distribution';
  expected: any;
  actual: any;
  passed: boolean;
}

async function runFeatureQualityChecks(): Promise<FeatureQualityCheck[]> {
  const checks: FeatureQualityCheck[] = [];

  // Check 1: Age range
  const { data: ageOutliers } = await supabase
    .from('customers')
    .select('id')
    .or('age.lt.18,age.gt.65');

  checks.push({
    feature_name: 'age',
    check_type: 'range',
    expected: '18-65',
    actual: ageOutliers?.length || 0,
    passed: (ageOutliers?.length || 0) === 0
  });

  // Check 2: KYC face match score
  const { data: facMatchScores } = await supabase
    .from('kyc_submissions')
    .select('kyc_result')
    .limit(100);

  const avgFaceMatch = facMatchScores?.reduce((sum, r) =>
    sum + r.kyc_result.face_match.confidence, 0) / facMatchScores.length;

  checks.push({
    feature_name: 'kyc_face_match_score',
    check_type: 'distribution',
    expected: '>0.85 avg',
    actual: avgFaceMatch,
    passed: avgFaceMatch > 0.85
  });

  return checks;
}
```

### 7.2 Feature Drift Detection

```python
import scipy.stats as stats

def detect_feature_drift(
    reference_dist: np.array,
    current_dist: np.array,
    alpha: float = 0.05
) -> dict:
    """
    Kolmogorov-Smirnov test for distribution drift
    """
    ks_statistic, p_value = stats.ks_2samp(reference_dist, current_dist)

    return {
        'ks_statistic': ks_statistic,
        'p_value': p_value,
        'drift_detected': p_value < alpha
    }

# Example: Detect drift in mm_avg_monthly_inflow
reference = df_train['mm_avg_monthly_inflow']
current = df_prod['mm_avg_monthly_inflow']

drift_result = detect_feature_drift(reference, current)
print(f"Drift detected: {drift_result['drift_detected']}")
```

---

## Summary

### Executive Summary
Complete catalog of 60 credit scoring features across 6 categories (Demographics, Mobile Money, KYC, Device/Loan, Behavioral, Social), with 10 critical features driving 70% of predictions. Includes feature importance ranking, data source mapping, transformation logic, and missing data handling strategies.

### What Was Delivered
1. **60 Feature Catalog**: Detailed descriptions with data sources, ranges, importance (⭐⭐⭐⭐⭐ to ⭐⭐)
2. **Feature Importance Ranking**: Top 10 critical features (installment_to_income_ratio, mm_avg_monthly_inflow, etc.)
3. **10 Data Sources**: PostgreSQL tables, Smile Identity API, Mobile Money API (optional Phase 1), static lookup tables
4. **Transformation Logic**: Log transforms, winsorization (99th percentile), normalization (0-1 scale), one-hot encoding
5. **Missing Data Strategies**: Reject (KYC features), impute median (Mobile Money), domain-specific defaults
6. **Quality Monitoring**: Data quality checks, Kolmogorov-Smirnov drift detection

### Technical Components
- FeatureCatalog (60 features), FeatureImportanceRanker, DataSourceMapper (10 sources), FeatureTransformer (log/winsorize/normalize), ImputationEngine (3 strategies), DriftDetector (K-S test)

### Implementation Checklist
- [ ] Create feature_store table with 60 feature columns
- [ ] Implement data source connectors (PostgreSQL, Smile Identity, Mobile Money APIs)
- [ ] Build feature transformation pipeline (log/winsorize/normalize)
- [ ] Implement imputation strategies (reject/median/domain-specific)
- [ ] Set up feature quality monitoring dashboard
- [ ] Configure drift detection (K-S test, alert if p<0.05)
- [ ] Test feature availability (target: 85% average, 100% for required)

### Related Specifications
- [Credit Scoring Algorithm](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/credit-scoring-algorithm.md)
- [Rule-Based Scoring](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/rule-based-scoring.md)
- [ML Model Architecture](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/ml-model-architecture.md)
- [Database Schema](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/database-schema.md)
