# Rule-Based Scoring Logic & Credit Limit Calculation

**Task ID**: P1-T017
**Phase**: Phase 1 - Credit Scoring System Design
**Priority**: High
**Estimated**: 6 hours
**Dependencies**: P1-T015 (Algorithm), P1-T016 (Features)

---

## Table of Contents
1. [Overview](#overview)
2. [Hard Rules (Instant Rejection)](#hard-rules-instant-rejection)
3. [Soft Rules (Risk Assessment)](#soft-rules-risk-assessment)
4. [Credit Limit Calculation](#credit-limit-calculation)
5. [Manual Review Triggers](#manual-review-triggers)
6. [Rule Engine Implementation](#rule-engine-implementation)
7. [Edge Cases & Overrides](#edge-cases--overrides)

---

## 1. Overview

The rule-based scoring system provides immediate, explainable credit decisions for Phase 1 (pre-ML). It combines:
- **Hard Rules**: Automatic rejection criteria (security, compliance)
- **Soft Rules**: Risk-based scoring for credit limit assignment
- **Tiered Limits**: $200 / $350 / $500 based on risk profile
- **Manual Review**: Human oversight for edge cases

### Decision Flow

```
Customer Application
        │
        ▼
┌───────────────────┐
│  Hard Rules Check │ ──► REJECT (if any fail)
└────────┬──────────┘
         │ (All Pass)
         ▼
┌───────────────────┐
│ Soft Rules Score  │ ──► Calculate Risk Score (0-100)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Credit Score Map  │ ──► 300-850 FICO-like score
└────────┬──────────┘
         │
         ├────► 300-549: REJECT
         ├────► 550-649: MANUAL REVIEW
         ├────► 650-699: APPROVE $200
         ├────► 700-749: APPROVE $350
         └────► 750-850: APPROVE $500
```

---

## 2. Hard Rules (Instant Rejection)

**Principle**: Zero tolerance for security, legal, or operational risks

### Rule HR-001: KYC Verification Failed

```typescript
function checkKYCVerification(customer: Customer): RuleResult {
  if (customer.kyc_status !== 'approved') {
    return {
      pass: false,
      rule_id: 'HR-001',
      reason: 'KYC verification not approved',
      severity: 'critical',
      user_message: 'We could not verify your identity. Please complete identity verification or contact support.',
      action: 'reject'
    };
  }

  return { pass: true, rule_id: 'HR-001' };
}
```

**Triggers**:
- `kyc_status` = 'rejected', 'pending', 'expired', or null
- DIDIT API returned fraud flags
- ID document not readable/authentic

**User Message**: "We couldn't verify your identity. Please retry verification with clearer photos."

---

### Rule HR-002: Age Eligibility

```typescript
function checkAgeEligibility(birthDate: Date): RuleResult {
  const age = calculateAge(birthDate);

  if (age < 18 || age > 65) {
    return {
      pass: false,
      rule_id: 'HR-002',
      reason: `Age ${age} outside eligible range (18-65)`,
      severity: 'critical',
      user_message: age < 18
        ? 'You must be 18 or older to apply.'
        : 'Our loan program is currently for ages 18-65.',
      action: 'reject'
    };
  }

  return { pass: true, rule_id: 'HR-002' };
}
```

**Rationale**:
- Under 18: Legal requirement (cannot enter contracts)
- Over 65: Retirement age, higher default risk

---

### Rule HR-003: Active Loan Limit (First-Time Borrowers)

```typescript
function checkActiveLoanLimit(customer: Customer): RuleResult {
  const activeLoans = customer.loans.filter(l =>
    l.status === 'active' || l.status === 'overdue'
  );

  // First-time borrowers: max 1 active loan
  if (customer.credit_tier === 1 && activeLoans.length >= 1) {
    return {
      pass: false,
      rule_id: 'HR-003',
      reason: 'First-time borrower with existing active loan',
      severity: 'high',
      user_message: 'Please complete your current loan before applying for a new one.',
      action: 'reject'
    };
  }

  // Tier 2/3 borrowers: max 2 concurrent loans
  if (customer.credit_tier >= 2 && activeLoans.length >= 2) {
    return {
      pass: false,
      rule_id: 'HR-003',
      reason: 'Maximum concurrent loans (2) reached',
      severity: 'high',
      user_message: 'You have reached the maximum number of active loans (2). Please pay down existing loans first.',
      action: 'reject'
    };
  }

  return { pass: true, rule_id: 'HR-003' };
}
```

---

### Rule HR-004: Blacklist Check

```typescript
function checkBlacklist(customer: Customer): RuleResult {
  if (customer.blacklisted === true) {
    return {
      pass: false,
      rule_id: 'HR-004',
      reason: 'Customer on blacklist',
      severity: 'critical',
      user_message: 'Your account has been flagged. Please contact support at +263771234567.',
      action: 'reject',
      requires_human_review: true
    };
  }

  return { pass: true, rule_id: 'HR-004' };
}
```

**Blacklist Reasons**:
- 3+ defaults in past 12 months
- Fraudulent activity detected
- Legal action pending
- Manual admin flag

---

### Rule HR-005: Device Already Financed

```typescript
function checkDeviceFinanced(deviceIMEI: string): RuleResult {
  const existingLoan = await db.loans.findOne({
    device_imei: deviceIMEI,
    status: { $in: ['active', 'overdue', 'pending'] }
  });

  if (existingLoan) {
    return {
      pass: false,
      rule_id: 'HR-005',
      reason: 'Device IMEI already has active loan',
      severity: 'critical',
      user_message: 'This device is already being financed. Choose a different device.',
      action: 'reject'
    };
  }

  return { pass: true, rule_id: 'HR-005' };
}
```

---

### Rule HR-006: Overdue Payment Threshold

```typescript
function checkOverduePayments(customer: Customer): RuleResult {
  const overdueLoans = customer.loans.filter(l =>
    l.status === 'overdue' && l.days_overdue > 30
  );

  if (overdueLoans.length > 0) {
    const totalOverdue = overdueLoans.reduce((sum, l) => sum + l.outstanding_balance, 0);

    return {
      pass: false,
      rule_id: 'HR-006',
      reason: `${overdueLoans.length} loan(s) overdue 30+ days`,
      severity: 'high',
      user_message: `You have $${totalOverdue.toFixed(2)} in overdue payments. Please clear outstanding balance before applying.`,
      action: 'reject'
    };
  }

  return { pass: true, rule_id: 'HR-006' };
}
```

---

### Hard Rules Summary

| Rule ID | Description | Severity | Override Allowed |
|---------|-------------|----------|------------------|
| HR-001 | KYC verification failed | Critical | No |
| HR-002 | Age outside 18-65 range | Critical | No |
| HR-003 | Concurrent loan limit exceeded | High | Yes (admin) |
| HR-004 | Customer blacklisted | Critical | Yes (senior admin) |
| HR-005 | Device already financed | Critical | No |
| HR-006 | Overdue 30+ days | High | Yes (case-by-case) |

---

## 3. Soft Rules (Risk Assessment)

**Principle**: Cumulative risk scoring - multiple minor risks compound

### Rule SR-001: Employment Stability

```typescript
function scoreEmploymentStability(customer: Customer): SoftRuleScore {
  let score = 0;
  let risk_level = 'low';

  switch (customer.employment_type) {
    case 'formal_employed':
      score = 100;
      risk_level = 'low';
      break;
    case 'self_employed':
      score = 85;
      risk_level = 'low';
      break;
    case 'informal_trader':
      score = 70;
      risk_level = 'medium';
      break;
    case 'gig_worker':
      // Phase 3+: Check platform data
      if (customer.platform_income_verified) {
        score = 80;
        risk_level = 'low';
      } else {
        score = 60;
        risk_level = 'medium';
      }
      break;
    case 'unemployed':
      score = 30;
      risk_level = 'high';
      break;
    default:
      score = 50;
      risk_level = 'medium';
  }

  return {
    rule_id: 'SR-001',
    score,
    risk_level,
    weight: 0.25, // 25% of total soft score
    details: `Employment type: ${customer.employment_type}`
  };
}
```

---

### Rule SR-002: Geographic Risk

```typescript
function scoreGeographicRisk(province: string, city: string): SoftRuleScore {
  const riskMap = {
    'Harare': { score: 100, risk: 'low' },
    'Bulawayo': { score: 95, risk: 'low' },
    'Chitungwiza': { score: 90, risk: 'low' },
    'Mutare': { score: 85, risk: 'medium' },
    'Gweru': { score: 85, risk: 'medium' },
    'Kwekwe': { score: 80, risk: 'medium' },
    'Masvingo': { score: 75, risk: 'medium' },
    'Rural': { score: 60, risk: 'high' }
  };

  const cityRisk = riskMap[city] || riskMap['Rural'];

  return {
    rule_id: 'SR-002',
    score: cityRisk.score,
    risk_level: cityRisk.risk,
    weight: 0.15,
    details: `Location: ${city}, ${province}`
  };
}
```

**Rationale**:
- Urban areas: Better device market, easier repo
- Rural areas: Lower device resale value, harder collection

---

### Rule SR-003: Mobile Money Activity

```typescript
function scoreMobileMoneyActivity(mmProfile: MobileMoneyProfile): SoftRuleScore {
  let score = 50; // Base score (no MM data)

  if (!mmProfile) {
    return {
      rule_id: 'SR-003',
      score: 50,
      risk_level: 'medium',
      weight: 0.15,
      details: 'No mobile money data available'
    };
  }

  // Score based on activity
  if (mmProfile.avg_monthly_inflow >= 200) score += 30;
  else if (mmProfile.avg_monthly_inflow >= 100) score += 20;
  else if (mmProfile.avg_monthly_inflow >= 50) score += 10;

  // Consistency bonus
  if (mmProfile.transaction_count_3m >= 20) score += 20;
  else if (mmProfile.transaction_count_3m >= 10) score += 10;

  const risk_level = score >= 80 ? 'low' : score >= 60 ? 'medium' : 'high';

  return {
    rule_id: 'SR-003',
    score: Math.min(score, 100),
    risk_level,
    weight: 0.15,
    details: `Avg inflow: $${mmProfile.avg_monthly_inflow}/mo, Txns: ${mmProfile.transaction_count_3m}`
  };
}
```

---

### Rule SR-004: Loan History (for repeat customers)

```typescript
function scoreLoanHistory(customer: Customer): SoftRuleScore {
  const completedLoans = customer.loans.filter(l => l.status === 'paid_off');
  const defaultedLoans = customer.loans.filter(l => l.status === 'defaulted');

  if (completedLoans.length === 0) {
    return {
      rule_id: 'SR-004',
      score: 70, // Neutral for first-time
      risk_level: 'medium',
      weight: 0.20,
      details: 'First-time borrower'
    };
  }

  // Perfect repayment history
  if (defaultedLoans.length === 0 && completedLoans.every(l => l.late_payments === 0)) {
    return {
      rule_id: 'SR-004',
      score: 100,
      risk_level: 'low',
      weight: 0.20,
      details: `${completedLoans.length} loans, perfect history`
    };
  }

  // Some late payments but no defaults
  if (defaultedLoans.length === 0) {
    const avgLatePayments = completedLoans.reduce((sum, l) => sum + l.late_payments, 0) / completedLoans.length;
    const score = 100 - (avgLatePayments * 10);

    return {
      rule_id: 'SR-004',
      score: Math.max(score, 60),
      risk_level: score >= 80 ? 'low' : 'medium',
      weight: 0.20,
      details: `${completedLoans.length} loans, avg ${avgLatePayments.toFixed(1)} late payments`
    };
  }

  // Has defaults
  return {
    rule_id: 'SR-004',
    score: 40,
    risk_level: 'high',
    weight: 0.20,
    details: `${defaultedLoans.length} defaulted loan(s)`
  };
}
```

---

### Rule SR-005: Affordability Check

```typescript
function scoreAffordability(
  monthlyIncome: number,
  monthlyInstallment: number,
  existingDebt: number
): SoftRuleScore {
  const totalMonthlyDebt = monthlyInstallment + existingDebt;
  const debtToIncomeRatio = totalMonthlyDebt / monthlyIncome;

  let score = 0;
  let risk_level = 'high';

  if (debtToIncomeRatio <= 0.30) {
    score = 100;
    risk_level = 'low';
  } else if (debtToIncomeRatio <= 0.40) {
    score = 80;
    risk_level = 'medium';
  } else if (debtToIncomeRatio <= 0.50) {
    score = 60;
    risk_level = 'medium';
  } else {
    score = 30;
    risk_level = 'high';
  }

  return {
    rule_id: 'SR-005',
    score,
    risk_level,
    weight: 0.25,
    details: `DTI: ${(debtToIncomeRatio * 100).toFixed(1)}%, Income: $${monthlyIncome}, Debt: $${totalMonthlyDebt}`
  };
}
```

**Target Debt-to-Income Ratio**: ≤30% (conservative for thin-file borrowers)

---

### Soft Rules Aggregation

```typescript
function calculateSoftRulesScore(customer: Customer, loanRequest: LoanRequest): SoftRulesResult {
  const rules = [
    scoreEmploymentStability(customer),
    scoreGeographicRisk(customer.province, customer.city),
    scoreMobileMoneyActivity(customer.mobile_money_profile),
    scoreLoanHistory(customer),
    scoreAffordability(
      customer.estimated_monthly_income,
      loanRequest.monthly_installment,
      customer.existing_monthly_debt
    )
  ];

  // Weighted average
  const totalScore = rules.reduce((sum, rule) => sum + (rule.score * rule.weight), 0);

  // Overall risk assessment
  const highRiskCount = rules.filter(r => r.risk_level === 'high').length;
  const overall_risk = highRiskCount >= 2 ? 'high' : totalScore >= 80 ? 'low' : 'medium';

  return {
    total_score: Math.round(totalScore),
    overall_risk,
    individual_rules: rules,
    recommendation: totalScore >= 80 ? 'approve' : totalScore >= 60 ? 'review' : 'reject'
  };
}
```

---

## 4. Credit Limit Calculation

### Tier Assignment Logic

```typescript
function calculateCreditLimit(creditScore: number, customer: Customer): CreditLimitResult {
  // Map 0-100 soft score to 300-850 FICO-like scale
  const ficoScore = 300 + (creditScore / 100) * 550;

  let creditLimit = 0;
  let tier = 0;
  let requiresDeposit = true;
  let depositPercentage = 0.10; // 10% default

  // Tier 1: First-time borrowers, lowest risk category
  if (ficoScore >= 650 && ficoScore < 700) {
    creditLimit = 200;
    tier = 1;
    depositPercentage = 0.10;
  }

  // Tier 2: 1+ successful loan repayment
  else if (ficoScore >= 700 && ficoScore < 750) {
    creditLimit = 350;
    tier = 2;
    depositPercentage = 0.10;
  }

  // Tier 3: 3+ successful repayments
  else if (ficoScore >= 750) {
    creditLimit = 500;
    tier = 3;
    depositPercentage = 0.05; // Lower deposit for top tier
  }

  // Below 650: Manual review or reject
  else if (ficoScore >= 550 && ficoScore < 650) {
    creditLimit = 0;
    tier = 0;
    depositPercentage = 0.15; // Higher deposit if approved manually
  }

  // Below 550: Reject
  else {
    creditLimit = 0;
    tier = 0;
    requiresDeposit = false;
  }

  // Apply tier progression rules
  if (customer.credit_tier > tier) {
    // Don't downgrade existing customers without review
    tier = customer.credit_tier;
    creditLimit = getCreditLimitForTier(tier);
  }

  return {
    credit_limit: creditLimit,
    tier,
    fico_score: Math.round(ficoScore),
    requires_deposit: requiresDeposit,
    deposit_percentage: depositPercentage,
    decision: creditLimit > 0 ? 'approve' : ficoScore >= 550 ? 'review' : 'reject'
  };
}

function getCreditLimitForTier(tier: number): number {
  const tierLimits = { 1: 200, 2: 350, 3: 500 };
  return tierLimits[tier] || 0;
}
```

---

### Tier Progression Rules

```typescript
interface TierProgressionRule {
  from_tier: number;
  to_tier: number;
  requirements: TierRequirement[];
}

interface TierRequirement {
  type: 'loan_count' | 'payment_history' | 'credit_score' | 'time_as_customer';
  threshold: number;
  unit: string;
}

const TIER_PROGRESSION_RULES: TierProgressionRule[] = [
  {
    from_tier: 1,
    to_tier: 2,
    requirements: [
      { type: 'loan_count', threshold: 1, unit: 'completed_loans' },
      { type: 'payment_history', threshold: 0.90, unit: 'on_time_rate' },
      { type: 'credit_score', threshold: 700, unit: 'fico_score' }
    ]
  },
  {
    from_tier: 2,
    to_tier: 3,
    requirements: [
      { type: 'loan_count', threshold: 3, unit: 'completed_loans' },
      { type: 'payment_history', threshold: 0.95, unit: 'on_time_rate' },
      { type: 'credit_score', threshold: 750, unit: 'fico_score' },
      { type: 'time_as_customer', threshold: 6, unit: 'months' }
    ]
  }
];

function checkTierEligibility(customer: Customer): TierEligibilityResult {
  const currentTier = customer.credit_tier;
  const nextTierRule = TIER_PROGRESSION_RULES.find(r => r.from_tier === currentTier);

  if (!nextTierRule) {
    return {
      eligible_for_upgrade: false,
      current_tier: currentTier,
      next_tier: null,
      requirements_met: [],
      requirements_unmet: []
    };
  }

  const metRequirements = [];
  const unmetRequirements = [];

  for (const req of nextTierRule.requirements) {
    const isMet = checkRequirement(customer, req);
    if (isMet) {
      metRequirements.push(req);
    } else {
      unmetRequirements.push(req);
    }
  }

  const eligible = unmetRequirements.length === 0;

  return {
    eligible_for_upgrade: eligible,
    current_tier: currentTier,
    next_tier: nextTierRule.to_tier,
    requirements_met: metRequirements,
    requirements_unmet: unmetRequirements
  };
}

function checkRequirement(customer: Customer, req: TierRequirement): boolean {
  switch (req.type) {
    case 'loan_count':
      const completedLoans = customer.loans.filter(l => l.status === 'paid_off').length;
      return completedLoans >= req.threshold;

    case 'payment_history':
      const totalPayments = customer.payment_history.total_payments;
      const onTimePayments = customer.payment_history.on_time_payments;
      const onTimeRate = onTimePayments / totalPayments;
      return onTimeRate >= req.threshold;

    case 'credit_score':
      return customer.credit_score >= req.threshold;

    case 'time_as_customer':
      const monthsAsCust = monthsSince(customer.created_at);
      return monthsAsCust >= req.threshold;

    default:
      return false;
  }
}
```

---

## 5. Manual Review Triggers

**When to escalate to human review**:

### Trigger MR-001: Borderline Credit Score

```typescript
function checkManualReviewTriggers(creditScore: number, customer: Customer): ManualReviewTrigger[] {
  const triggers = [];

  // Borderline score (550-649)
  if (creditScore >= 550 && creditScore < 650) {
    triggers.push({
      trigger_id: 'MR-001',
      reason: 'Borderline credit score',
      score: creditScore,
      recommendation: 'Review employment verification and mobile money activity',
      priority: 'medium'
    });
  }

  return triggers;
}
```

---

### Trigger MR-002: High-Value First Loan

```typescript
function checkHighValueFirstLoan(loanAmount: number, customer: Customer): ManualReviewTrigger | null {
  if (customer.loan_count === 0 && loanAmount > 250) {
    return {
      trigger_id: 'MR-002',
      reason: 'First-time borrower requesting high-value device',
      loan_amount: loanAmount,
      recommendation: 'Verify income source and affordability',
      priority: 'high'
    };
  }

  return null;
}
```

---

### Trigger MR-003: Conflicting Signals

```typescript
function checkConflictingSignals(softRules: SoftRulesResult): ManualReviewTrigger | null {
  const highRiskCount = softRules.individual_rules.filter(r => r.risk_level === 'high').length;
  const lowRiskCount = softRules.individual_rules.filter(r => r.risk_level === 'low').length;

  // Mixed signals: some very high risk, some very low risk
  if (highRiskCount >= 2 && lowRiskCount >= 2) {
    return {
      trigger_id: 'MR-003',
      reason: 'Conflicting risk signals',
      high_risk_factors: highRiskCount,
      low_risk_factors: lowRiskCount,
      recommendation: 'Human judgment required to weigh factors',
      priority: 'medium'
    };
  }

  return null;
}
```

---

### Trigger MR-004: Recent Negative Event

```typescript
function checkRecentNegativeEvent(customer: Customer): ManualReviewTrigger | null {
  const recentDefault = customer.loans.find(l =>
    l.status === 'defaulted' &&
    daysSince(l.defaulted_at) < 180
  );

  if (recentDefault) {
    return {
      trigger_id: 'MR-004',
      reason: 'Default in last 6 months',
      default_date: recentDefault.defaulted_at,
      default_amount: recentDefault.principal,
      recommendation: 'Review circumstances of default and current situation',
      priority: 'high'
    };
  }

  return null;
}
```

---

## 6. Rule Engine Implementation

### Complete Decision Flow

```typescript
interface CreditDecisionResult {
  decision: 'approve' | 'reject' | 'manual_review';
  credit_limit: number;
  tier: number;
  fico_score: number;
  deposit_required: boolean;
  deposit_percentage: number;

  hard_rules: RuleResult[];
  soft_rules: SoftRulesResult;
  manual_review_triggers: ManualReviewTrigger[];

  explanation: string;
  timestamp: Date;
}

async function evaluateCreditApplication(
  customer: Customer,
  loanRequest: LoanRequest
): Promise<CreditDecisionResult> {

  // Step 1: Run hard rules (instant rejection criteria)
  const hardRules = [
    checkKYCVerification(customer),
    checkAgeEligibility(customer.birth_date),
    checkActiveLoanLimit(customer),
    checkBlacklist(customer),
    checkDeviceFinanced(loanRequest.device_imei),
    checkOverduePayments(customer)
  ];

  const failedHardRules = hardRules.filter(r => !r.pass);

  if (failedHardRules.length > 0) {
    return {
      decision: 'reject',
      credit_limit: 0,
      tier: 0,
      fico_score: 0,
      deposit_required: false,
      deposit_percentage: 0,
      hard_rules: hardRules,
      soft_rules: null,
      manual_review_triggers: [],
      explanation: failedHardRules.map(r => r.reason).join('; '),
      timestamp: new Date()
    };
  }

  // Step 2: Calculate soft rules score
  const softRules = calculateSoftRulesScore(customer, loanRequest);

  // Step 3: Map to credit limit
  const creditLimit = calculateCreditLimit(softRules.total_score, customer);

  // Step 4: Check manual review triggers
  const manualReviewTriggers = [
    ...checkManualReviewTriggers(creditLimit.fico_score, customer),
    checkHighValueFirstLoan(loanRequest.loan_amount, customer),
    checkConflictingSignals(softRules),
    checkRecentNegativeEvent(customer)
  ].filter(t => t !== null);

  // Step 5: Final decision
  let decision: 'approve' | 'reject' | 'manual_review';

  if (manualReviewTriggers.length > 0) {
    decision = 'manual_review';
  } else if (creditLimit.decision === 'approve') {
    decision = 'approve';
  } else {
    decision = 'reject';
  }

  return {
    decision,
    credit_limit: creditLimit.credit_limit,
    tier: creditLimit.tier,
    fico_score: creditLimit.fico_score,
    deposit_required: creditLimit.requires_deposit,
    deposit_percentage: creditLimit.deposit_percentage,
    hard_rules: hardRules,
    soft_rules: softRules,
    manual_review_triggers: manualReviewTriggers,
    explanation: generateExplanation(decision, creditLimit, softRules, manualReviewTriggers),
    timestamp: new Date()
  };
}

function generateExplanation(
  decision: string,
  creditLimit: CreditLimitResult,
  softRules: SoftRulesResult,
  triggers: ManualReviewTrigger[]
): string {
  if (decision === 'approve') {
    return `Approved for $${creditLimit.credit_limit} (Tier ${creditLimit.tier}). Credit score: ${creditLimit.fico_score}. Risk level: ${softRules.overall_risk}.`;
  }

  if (decision === 'manual_review') {
    return `Requires manual review: ${triggers.map(t => t.reason).join('; ')}.`;
  }

  return `Application declined. Credit score ${creditLimit.fico_score} below minimum threshold.`;
}
```

---

## 7. Edge Cases & Overrides

### Admin Override Mechanism

```typescript
interface AdminOverride {
  override_id: string;
  admin_user_id: string;
  customer_id: string;
  original_decision: string;
  new_decision: string;
  new_credit_limit?: number;
  reason: string;
  approved_by_senior_admin?: string;
  timestamp: Date;
}

async function applyAdminOverride(
  override: AdminOverride,
  originalResult: CreditDecisionResult
): Promise<CreditDecisionResult> {

  // Log override for audit
  await db.audit_logs.insert({
    action: 'credit_decision_override',
    user_id: override.admin_user_id,
    customer_id: override.customer_id,
    old_data: originalResult,
    new_data: override,
    reason: override.reason,
    severity: 'warning'
  });

  // Apply override
  return {
    ...originalResult,
    decision: override.new_decision as any,
    credit_limit: override.new_credit_limit || originalResult.credit_limit,
    explanation: `${originalResult.explanation} [OVERRIDDEN by admin: ${override.reason}]`,
    timestamp: new Date()
  };
}
```

---

### Temporary Limit Increase

```typescript
async function requestTemporaryLimitIncrease(
  customer: Customer,
  requestedLimit: number,
  reason: string
): Promise<{
  approved: boolean;
  new_limit: number;
  expires_at: Date;
  reason: string;
}> {

  // Check eligibility
  if (customer.credit_tier < 2) {
    return {
      approved: false,
      new_limit: customer.credit_limit,
      expires_at: null,
      reason: 'Temporary increases only available for Tier 2+ customers'
    };
  }

  // Check repayment history
  const onTimeRate = customer.payment_history.on_time_payments / customer.payment_history.total_payments;

  if (onTimeRate < 0.95) {
    return {
      approved: false,
      new_limit: customer.credit_limit,
      expires_at: null,
      reason: 'Payment history does not qualify for temporary increase'
    };
  }

  // Approve temporary increase (max 50% above base limit)
  const maxTempLimit = customer.credit_limit * 1.5;
  const approvedLimit = Math.min(requestedLimit, maxTempLimit);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return {
    approved: true,
    new_limit: approvedLimit,
    expires_at: expiresAt,
    reason: `Temporary increase approved for 30 days based on excellent payment history`
  };
}
```

---

## Summary

**Rule-Based Scoring Components**:
1. ✅ **6 Hard Rules** - Instant rejection (KYC, age, blacklist, etc.)
2. ✅ **5 Soft Rules** - Risk assessment (employment, location, affordability)
3. ✅ **3 Credit Tiers** - $200 / $350 / $500 based on FICO-like score
4. ✅ **4 Manual Review Triggers** - Edge cases requiring human judgment
5. ✅ **Admin Override** - Manual exceptions with audit trail
6. ✅ **Tier Progression** - Automatic upgrades based on performance

**Decision Latency**: <5 seconds (all calculations in-memory)

**Explainability**: Every decision includes:
- Which rules passed/failed
- Individual soft rule scores
- Credit score calculation breakdown
- Human-readable explanation

**Configuration**: All thresholds stored in `system_config` table for easy tuning without code changes.
