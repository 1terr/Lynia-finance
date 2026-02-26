/**
 * Characterization tests for scoreAffordability in scoring-engine.ts
 *
 * Validates the affordability assessment component (0-300 points).
 * Wrong affordability scoring = approving loans customers cannot repay,
 * or rejecting customers who can comfortably afford installments.
 */

import { scoreAffordability } from '../../../services/scoring-service/src/scoring/scoring-engine';
import type { AffordabilityData } from '../../../services/scoring-service/src/scoring/types';

function buildAffordability(overrides: Partial<AffordabilityData> = {}): AffordabilityData {
  return {
    monthly_income_usd: 500,
    existing_debt_obligations_usd: 0,
    household_size: 1,
    dependents: 0,
    requested_loan_amount: 200,
    ...overrides,
  };
}

describe('scoreAffordability', () => {
  // ─── DTI Ratio tiers ───────────────────────────────────────────
  // monthlyInstallment = (loan * 1.12) / 6
  // totalObligations = debt + monthlyInstallment
  // dtiRatio = totalObligations / max(income, 1)

  it('DTI <= 0.30 yields dtiScore = 150', () => {
    // income=500, debt=0, loan=200
    // monthlyInst = (200*1.12)/6 = 37.333
    // dti = 37.333 / 500 = 0.0747 (<=0.30)
    // dtiScore=150, incomeScore=100, householdScore=50 => 300
    const score = scoreAffordability(buildAffordability());
    expect(score).toBe(300);
  });

  it('DTI 0.31-0.40 yields dtiScore = 120', () => {
    // Need dti in (0.30, 0.40]
    // income=300, debt=0, loan=500
    // monthlyInst = (500*1.12)/6 = 93.333
    // dti = 93.333 / 300 = 0.3111 (in 0.31-0.40)
    // dtiScore=120, incomeScore=75 (300>=300), householdScore=50 (300/1=300>=100)
    // total = 120 + 75 + 50 = 245
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 300,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 500,
      })
    );
    expect(score).toBe(245);
  });

  it('DTI 0.41-0.50 yields dtiScore = 80', () => {
    // income=200, debt=0, loan=500
    // monthlyInst = (500*1.12)/6 = 93.333
    // dti = 93.333 / 200 = 0.4667 (in 0.41-0.50)
    // dtiScore=80, incomeScore=50 (200>=150), householdScore=50 (200/1=200>=100)
    // total = 80 + 50 + 50 = 180
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 200,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 500,
      })
    );
    expect(score).toBe(180);
  });

  it('DTI 0.51-0.60 yields dtiScore = 40', () => {
    // income=200, debt=10, loan=500
    // monthlyInst = (500*1.12)/6 = 93.333
    // totalObligations = 10 + 93.333 = 103.333
    // dti = 103.333 / 200 = 0.5167 (in 0.51-0.60)
    // dtiScore=40, incomeScore=50 (200>=150), householdScore=50 (200/1=200>=100)
    // total = 40 + 50 + 50 = 140
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 200,
        existing_debt_obligations_usd: 10,
        requested_loan_amount: 500,
      })
    );
    expect(score).toBe(140);
  });

  it('DTI > 0.60 yields dtiScore = 0', () => {
    // income=100, debt=0, loan=500
    // monthlyInst = (500*1.12)/6 = 93.333
    // dti = 93.333 / 100 = 0.9333 (> 0.60)
    // dtiScore=0, incomeScore=25 (100>=100), householdScore=50 (100/1=100>=100)
    // total = 0 + 25 + 50 = 75
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 100,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 500,
      })
    );
    expect(score).toBe(75);
  });

  // ─── Income Level tiers ────────────────────────────────────────

  it('income >= 500 yields incomeScore = 100', () => {
    // income=500, dti will be low -> 150, household=50
    // total = 150 + 100 + 50 = 300
    const score = scoreAffordability(
      buildAffordability({ monthly_income_usd: 500, requested_loan_amount: 100 })
    );
    // monthlyInst = (100*1.12)/6 = 18.67, dti = 18.67/500 = 0.037 -> 150
    // incomeScore = 100, householdScore: 500/1=500 -> 50
    expect(score).toBe(300);
  });

  it('income 300-499 yields incomeScore = 75', () => {
    // income=400, debt=0, loan=100
    // monthlyInst = (100*1.12)/6 = 18.67, dti = 18.67/400 = 0.047 -> 150
    // incomeScore = 75 (400 >= 300 but < 500)
    // householdScore: 400/1=400 -> 50
    // total = 150 + 75 + 50 = 275
    const score = scoreAffordability(
      buildAffordability({ monthly_income_usd: 400, requested_loan_amount: 100 })
    );
    expect(score).toBe(275);
  });

  it('income 150-299 yields incomeScore = 50', () => {
    // income=200, debt=0, loan=100
    // monthlyInst = (100*1.12)/6 = 18.67, dti = 18.67/200 = 0.0933 -> 150
    // incomeScore = 50 (200 >= 150 but < 300)
    // householdScore: 200/1=200 -> 50
    // total = 150 + 50 + 50 = 250
    const score = scoreAffordability(
      buildAffordability({ monthly_income_usd: 200, requested_loan_amount: 100 })
    );
    expect(score).toBe(250);
  });

  it('income 100-149 yields incomeScore = 25', () => {
    // income=120, debt=0, loan=50
    // monthlyInst = (50*1.12)/6 = 9.33, dti = 9.33/120 = 0.0778 -> 150
    // incomeScore = 25 (120 >= 100 but < 150)
    // householdScore: 120/1=120 -> 50
    // total = 150 + 25 + 50 = 225
    const score = scoreAffordability(
      buildAffordability({ monthly_income_usd: 120, requested_loan_amount: 50 })
    );
    expect(score).toBe(225);
  });

  it('income < 100 yields incomeScore = 0', () => {
    // income=50, debt=0, loan=10
    // monthlyInst = (10*1.12)/6 = 1.867, dti = 1.867/50 = 0.0373 -> 150
    // incomeScore = 0 (50 < 100)
    // householdScore: 50/1=50 -> 20
    // total = 150 + 0 + 20 = 170
    const score = scoreAffordability(
      buildAffordability({ monthly_income_usd: 50, requested_loan_amount: 10 })
    );
    expect(score).toBe(170);
  });

  // ─── Household Financial Stress tiers ──────────────────────────

  it('income-per-person >= 100 yields householdScore = 50', () => {
    // income=500, household=1 -> perPerson=500 >= 100 -> 50
    const score = scoreAffordability(
      buildAffordability({ monthly_income_usd: 500, household_size: 1, requested_loan_amount: 50 })
    );
    // dti: (50*1.12)/6 / 500 = 9.33/500 = 0.0187 -> 150
    // income: 500 -> 100
    // household: 500/1=500 -> 50
    // total = 300
    expect(score).toBe(300);
  });

  it('income-per-person 75-99 yields householdScore = 35', () => {
    // income=400, household=5 -> perPerson=80 (>=75, <100) -> 35
    // dti: (50*1.12)/6 / 400 = 9.33/400 = 0.0233 -> 150
    // income: 400 -> 75
    // total = 150 + 75 + 35 = 260
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 400,
        household_size: 5,
        requested_loan_amount: 50,
      })
    );
    expect(score).toBe(260);
  });

  it('income-per-person 50-74 yields householdScore = 20', () => {
    // income=300, household=5 -> perPerson=60 (>=50, <75) -> 20
    // dti: (50*1.12)/6 / 300 = 9.33/300 = 0.0311 -> 120... wait that's > 0.30
    // Actually 0.0311 <= 0.30? No, 0.0311 > 0.030 but the threshold is 0.30
    // 0.0311 is way less than 0.30. Let me re-check: 0.0311 <= 0.30 -> yes, -> 150
    // income: 300 -> 75
    // total = 150 + 75 + 20 = 245
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 300,
        household_size: 5,
        requested_loan_amount: 50,
      })
    );
    expect(score).toBe(245);
  });

  it('income-per-person < 50 yields householdScore = 10', () => {
    // income=150, household=5 -> perPerson=30 (<50) -> 10
    // dti: (50*1.12)/6 / 150 = 9.33/150 = 0.0622 -> 150
    // income: 150 -> 50
    // total = 150 + 50 + 10 = 210
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 150,
        household_size: 5,
        requested_loan_amount: 50,
      })
    );
    expect(score).toBe(210);
  });

  // ─── Max combined score ────────────────────────────────────────

  it('maximum combined score is 300 (150 + 100 + 50)', () => {
    // Perfect: dti<=0.30 -> 150, income>=500 -> 100, perPerson>=100 -> 50
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 1000,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 100,
        household_size: 1,
      })
    );
    expect(score).toBe(300);
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it('household_size = 0 is treated as 1 via Math.max', () => {
    // household_size=0 -> Math.max(0,1) = 1
    // Same as household_size=1
    const scoreWithZero = scoreAffordability(
      buildAffordability({ household_size: 0, requested_loan_amount: 100 })
    );
    const scoreWithOne = scoreAffordability(
      buildAffordability({ household_size: 1, requested_loan_amount: 100 })
    );
    expect(scoreWithZero).toBe(scoreWithOne);
  });

  it('monthly_income = 0 with high debt gives dtiScore = 0 and incomeScore = 0', () => {
    // income=0, debt=100, loan=200
    // monthlyInst = (200*1.12)/6 = 37.33
    // totalObligations = 100 + 37.33 = 137.33
    // dti = 137.33 / max(0,1) = 137.33 -> 0 (> 0.60)
    // incomeScore = 0 (0 < 100)
    // householdScore: 0/1=0 -> 10 (<50)
    // total = 0 + 0 + 10 = 10
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 0,
        existing_debt_obligations_usd: 100,
        requested_loan_amount: 200,
      })
    );
    expect(score).toBe(10);
  });

  it('result is capped at 300 even if sub-scores could theoretically exceed', () => {
    // With the current tiers, maximum possible is exactly 150+100+50=300
    // Test that even with ideal inputs, it does not exceed 300
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 10000,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 50,
        household_size: 1,
      })
    );
    expect(score).toBeLessThanOrEqual(300);
    expect(score).toBe(300);
  });

  // ─── DTI boundary precision ────────────────────────────────────

  it('DTI exactly at 0.30 boundary yields dtiScore = 150', () => {
    // Need dti exactly 0.30: totalObligations / income = 0.30
    // income=100, totalObligations = 30 -> monthlyInst + debt = 30
    // monthlyInst = (loan*1.12)/6 => loan = 30*6/1.12 = 160.714...
    // Use: income=1000, debt=0, loan -> monthlyInst = 300 -> loan = 300*6/1.12 = 1607.14
    // That's a big loan. Let's simplify:
    // income=1000, debt=200, loan -> monthlyInst = (loan*1.12)/6
    // totalObligations = 200 + monthlyInst = 300 -> monthlyInst = 100
    // loan = 100*6/1.12 = 535.714
    // dti = 300/1000 = 0.30 exactly -> 150
    // incomeScore: 1000 >= 500 -> 100
    // householdScore: 1000/1 = 1000 -> 50
    // total = 300
    const loanAmount = (100 * 6) / 1.12; // 535.714...
    const score = scoreAffordability(
      buildAffordability({
        monthly_income_usd: 1000,
        existing_debt_obligations_usd: 200,
        requested_loan_amount: loanAmount,
        household_size: 1,
      })
    );
    expect(score).toBe(300);
  });
});
