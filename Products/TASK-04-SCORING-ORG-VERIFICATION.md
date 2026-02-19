# Task 4: Scoring - Organization Verification (Phase 4)

## Overview

Enhance the credit scoring service to support a 6-component model for digital loans by adding an organization verification component. When a customer is a verified member of a registered organization, their credit score benefits from employment/salary verification data.

## Dependencies

- **Task 1** (Database Migration) must be completed first

## Key Files

| File | Action |
|------|--------|
| `services/scoring-service/src/index.ts` | **Modify** - Add org verification component and endpoint |

## What to Implement

### 4.1 New Endpoint: `POST /scoring/verify-organization`

Called before `POST /scoring/calculate` to look up a customer's organization membership.

**Input:**
```json
{
  "phone_number": "+263771234567"
}
```

**Output (found):**
```json
{
  "found": true,
  "organization_id": "uuid",
  "org_name": "Civil Service Commission",
  "org_type": "government",
  "scoring_trust_level": 90,
  "employment_status": "active",
  "employment_start_date": "2018-03-01",
  "tenure_months": 95,
  "salary_verified": true,
  "monthly_salary_usd": 450.00
}
```

**Output (not found):**
```json
{
  "found": false
}
```

### 4.2 Organization Verification Scoring Component (200 Points Max)

When `product_category === 'digital'` and org verification data is available, add a 6th scoring component:

```
Organization Trust Level:      up to 80 pts
  - Government (trust 80+):    80 pts
  - Corporate (trust 60-79):   60 pts
  - Cooperative (trust 40-59): 40 pts
  - Other (trust <40):         20 pts

Employment Status:             up to 50 pts
  - Active employment:         50 pts
  - Retired:                   25 pts
  - Suspended/Other:            0 pts

Employment Tenure:             up to 40 pts
  - 5+ years:                  40 pts
  - 2-5 years:                 30 pts
  - 1-2 years:                 20 pts
  - <1 year:                   10 pts

Salary Verification:           up to 30 pts
  - Salary verified:           30 pts
  - Not verified:               0 pts
```

### 4.3 Weight Redistribution for Digital Loans

For digital loans, redistribute scoring weights (total remains 1000):

| Component | Smartphone Loans | Digital Loans |
|-----------|-----------------|---------------|
| Affordability | 300 pts (30%) | 300 pts (30%) |
| Repayment | 250 pts (25%) | 250 pts (25%) |
| Mobile Money | 200 pts (20%) | **100 pts (10%)** |
| External Credit | 150 pts (15%) | **50 pts (5%)** |
| KYC Verification | 100 pts (10%) | 100 pts (10%) |
| Org Verification | 0 pts (0%) | **200 pts (20%)** |
| **TOTAL** | **1000 pts** | **1000 pts** |

### 4.4 Implementation Logic

The scoring service must:
1. Accept `product_category` in the scoring request
2. If `product_category === 'digital'`, use 6-component weights
3. If `product_category === 'smartphone'` or not specified, use existing 5-component weights
4. Query `organization_members` by phone number to get verification data
5. Calculate org verification sub-scores based on the 4 factors above
6. Add org verification score to the total before scaling to 300-850

---

## Tests

### Test 1: Organization Verification - Government Employee Found

```bash
# Setup: Insert a member in organization_members for Civil Service Commission
# Then verify:
curl -s -X POST localhost:3000/scoring/verify-organization \
  -d '{"phone_number":"+263771234567"}' | jq
```

**Expected:** Returns `found: true` with `org_type: "government"`, `scoring_trust_level: 90`, `employment_status: "active"`.

### Test 2: Organization Verification - Member Not Found

```bash
curl -s -X POST localhost:3000/scoring/verify-organization \
  -d '{"phone_number":"+263770000000"}' | jq
```

**Expected:** Returns `{ "found": false }`.

### Test 3: Scoring - Government Employee (Trust 90)

```typescript
describe('calculateCreditScore - digital loan with org verification', () => {
  it('should score ~180/200 for government employee with active status and 5+ years tenure', () => {
    const orgData = {
      scoring_trust_level: 90,       // government -> 80 pts
      employment_status: 'active',   // -> 50 pts
      tenure_months: 95,             // 5+ years -> 40 pts
      salary_verified: true          // -> 30 pts
    };
    // Total org score: 80 + 50 + 40 + 30 = 200/200
    const orgScore = calculateOrgVerificationScore(orgData);
    expect(orgScore).toBe(200);
  });
});
```

**Expected:** Government employee with active status, 5+ years, and verified salary gets maximum 200 points.

### Test 4: Scoring - Corporate Employee (Trust 70)

```typescript
it('should score ~140/200 for corporate employee with active status and 2-5 years tenure', () => {
  const orgData = {
    scoring_trust_level: 70,       // corporate -> 60 pts
    employment_status: 'active',   // -> 50 pts
    tenure_months: 36,             // 2-5 years -> 30 pts
    salary_verified: false         // -> 0 pts
  };
  // Total org score: 60 + 50 + 30 + 0 = 140/200
  const orgScore = calculateOrgVerificationScore(orgData);
  expect(orgScore).toBe(140);
});
```

**Expected:** Corporate employee with active status, 3 years, unverified salary gets 140 points.

### Test 5: Scoring - Non-Member (Smartphone Loan Flow)

```typescript
it('should use 5-component model when no org data available', () => {
  const score = calculateCreditScore({
    product_category: 'smartphone',
    transactionHistory: [...],
    orgVerification: null  // No org data
  });
  // Org verification component should be 0, weights should be standard
  expect(score.components.orgVerification).toBe(0);
  expect(score.weights.mobileMoney).toBe(200);  // Standard weight
});
```

**Expected:** Score uses standard 5-component weights when product is smartphone.

### Test 6: Weight Redistribution Verification

```typescript
it('should redistribute weights correctly for digital loans', () => {
  const weights = getScoringWeights('digital');
  expect(weights.affordability).toBe(300);
  expect(weights.repayment).toBe(250);
  expect(weights.mobileMoney).toBe(100);      // Halved from 200
  expect(weights.externalCredit).toBe(50);     // Reduced from 150
  expect(weights.kycVerification).toBe(100);
  expect(weights.orgVerification).toBe(200);   // New component
  expect(Object.values(weights).reduce((a, b) => a + b)).toBe(1000);  // Total unchanged
});
```

**Expected:** Digital loan weights sum to 1000 with correct redistribution.

### Test 7: Retired Employee Scoring

```typescript
it('should score 25/50 for retired employee employment status', () => {
  const orgData = {
    scoring_trust_level: 90,
    employment_status: 'retired',
    tenure_months: 240,
    salary_verified: true
  };
  const orgScore = calculateOrgVerificationScore(orgData);
  // 80 (gov) + 25 (retired) + 40 (5+ yrs) + 30 (verified) = 175
  expect(orgScore).toBe(175);
});
```

**Expected:** Retired employees get partial employment status points (25/50).

### Test 8: New Employee (<1 Year Tenure)

```typescript
it('should score 10/40 for employee with less than 1 year tenure', () => {
  const orgData = {
    scoring_trust_level: 90,
    employment_status: 'active',
    tenure_months: 6,
    salary_verified: true
  };
  const orgScore = calculateOrgVerificationScore(orgData);
  // 80 (gov) + 50 (active) + 10 (<1yr) + 30 (verified) = 170
  expect(orgScore).toBe(170);
});
```

**Expected:** New employees get minimum tenure points (10/40).

### Test 9: Overall Score Scaling

```typescript
it('should scale final score to 300-850 range for digital loans', () => {
  const score = calculateCreditScore({
    product_category: 'digital',
    // ... full scoring data with org verification
  });
  expect(score.finalScore).toBeGreaterThanOrEqual(300);
  expect(score.finalScore).toBeLessThanOrEqual(850);
});
```

**Expected:** Final score remains within the 300-850 range.

### Test 10: Unit Test Suite

```bash
pnpm test services/scoring-service
```

**Expected:** All existing and new tests pass. No regressions in smartphone loan scoring.

---

*Phase: 4 of 9*
*Depends on: Task 1 (Database Migration)*
*Blocks: Task 9 (Integration Testing)*
