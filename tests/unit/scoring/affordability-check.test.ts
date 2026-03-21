/**
 * Characterization tests for scoreAffordability in scoring-engine.ts
 *
 * Validates the affordability assessment component (0-250 points).
 * Uses org-verified salary for DTI when available (150pts max),
 * otherwise neutral 75. Household capacity scored separately (100pts max).
 *
 * Wrong affordability scoring = approving loans customers cannot repay,
 * or rejecting customers who can comfortably afford installments.
 */

import { scoreAffordability } from '../../../services/scoring-service/src/scoring/scoring-engine';
import type { AffordabilityData } from '../../../services/scoring-service/src/scoring/types';

function buildAffordability(overrides: Partial<AffordabilityData> = {}): AffordabilityData {
  return {
    household_size: 1,
    dependents: 0,
    requested_loan_amount: 200,
    ...overrides,
  };
}

describe('scoreAffordability', () => {
  // ─── Org-verified salary DTI tiers (150pts max) ─────────────────

  it('DTI <= 0.20 with org salary yields 150', () => {
    // salary=800, loan=200, estimatedMonthly=200/12=16.67
    // dti = 16.67/800 = 0.021 (<=0.20)
    // salaryDti=150, household: loanPerPerson=200/1=200 -> 50
    // total = 150 + 50 = 200
    const score = scoreAffordability(
      buildAffordability({
        org_verified_salary_usd: 800,
        requested_loan_amount: 200,
        household_size: 1,
      })
    );
    expect(score).toBe(200);
  });

  it('DTI 0.21-0.30 with org salary yields 120', () => {
    // salary=100, loan=300, estimatedMonthly=300/12=25
    // dti = 25/100 = 0.25 (0.21-0.30)
    // salaryDti=120, household: loanPerPerson=300/1=300 -> 25
    // total = 120 + 25 = 145
    const score = scoreAffordability(
      buildAffordability({
        org_verified_salary_usd: 100,
        requested_loan_amount: 300,
        household_size: 1,
      })
    );
    expect(score).toBe(145);
  });

  it('DTI 0.31-0.40 with org salary yields 90', () => {
    // salary=100, loan=400, estimatedMonthly=400/12=33.33
    // dti = 33.33/100 = 0.333 (0.31-0.40)
    // salaryDti=90, household: loanPerPerson=400/1=400 -> 25
    // total = 90 + 25 = 115
    const score = scoreAffordability(
      buildAffordability({
        org_verified_salary_usd: 100,
        requested_loan_amount: 400,
        household_size: 1,
      })
    );
    expect(score).toBe(115);
  });

  it('DTI 0.41-0.50 with org salary yields 60', () => {
    // salary=100, loan=550, estimatedMonthly=550/12=45.83
    // dti = 45.83/100 = 0.458 (0.41-0.50)
    // salaryDti=60, household: loanPerPerson=550/1=550 -> 25
    // total = 60 + 25 = 85
    const score = scoreAffordability(
      buildAffordability({
        org_verified_salary_usd: 100,
        requested_loan_amount: 550,
        household_size: 1,
      })
    );
    expect(score).toBe(85);
  });

  it('DTI > 0.50 with org salary yields 30', () => {
    // salary=100, loan=700, estimatedMonthly=700/12=58.33
    // dti = 58.33/100 = 0.583 (>0.50)
    // salaryDti=30, household: loanPerPerson=700/1=700 -> 25
    // total = 30 + 25 = 55
    const score = scoreAffordability(
      buildAffordability({
        org_verified_salary_usd: 100,
        requested_loan_amount: 700,
        household_size: 1,
      })
    );
    expect(score).toBe(55);
  });

  // ─── No salary data: neutral 75 ──────────────────────────────────

  it('no salary data gives neutral 75 for salary component', () => {
    // No org_verified_salary_usd -> 75 neutral
    // household: loanPerPerson=200/1=200 -> 50
    // total = 75 + 50 = 125
    const score = scoreAffordability(
      buildAffordability({
        requested_loan_amount: 200,
        household_size: 1,
      })
    );
    expect(score).toBe(125);
  });

  it('org_verified_salary_usd = 0 gives neutral 75', () => {
    // Salary=0 is falsy -> neutral 75
    // household: loanPerPerson=200/1=200 -> 50
    // total = 75 + 50 = 125
    const score = scoreAffordability(
      buildAffordability({
        org_verified_salary_usd: 0,
        requested_loan_amount: 200,
        household_size: 1,
      })
    );
    expect(score).toBe(125);
  });

  // ─── Household Financial Capacity tiers (100pts max) ─────────────

  it('loanPerPerson <= 50 yields 100 household score', () => {
    // loan=200, household=5 -> loanPerPerson=40 (<=50) -> 100
    // No salary -> 75
    // total = 75 + 100 = 175
    const score = scoreAffordability(
      buildAffordability({
        requested_loan_amount: 200,
        household_size: 5,
      })
    );
    expect(score).toBe(175);
  });

  it('loanPerPerson 51-100 yields 75 household score', () => {
    // loan=200, household=3 -> loanPerPerson=66.7 (51-100) -> 75
    // No salary -> 75
    // total = 75 + 75 = 150
    const score = scoreAffordability(
      buildAffordability({
        requested_loan_amount: 200,
        household_size: 3,
      })
    );
    expect(score).toBe(150);
  });

  it('loanPerPerson 101-200 yields 50 household score', () => {
    // loan=200, household=1 -> loanPerPerson=200 (101-200) -> 50
    // No salary -> 75
    // total = 75 + 50 = 125
    const score = scoreAffordability(
      buildAffordability({
        requested_loan_amount: 200,
        household_size: 1,
      })
    );
    expect(score).toBe(125);
  });

  it('loanPerPerson > 200 yields 25 household score', () => {
    // loan=500, household=1 -> loanPerPerson=500 (>200) -> 25
    // No salary -> 75
    // total = 75 + 25 = 100
    const score = scoreAffordability(
      buildAffordability({
        requested_loan_amount: 500,
        household_size: 1,
      })
    );
    expect(score).toBe(100);
  });

  // ─── Max combined score ────────────────────────────────────────

  it('maximum combined score is 250 (150 + 100)', () => {
    // Best: DTI<=0.20 -> 150, loanPerPerson<=50 -> 100
    // salary=1000, loan=100, household=5 -> loanPerPerson=20
    // estimatedMonthly=100/12=8.33, dti=8.33/1000=0.0083 (<=0.20)
    const score = scoreAffordability(
      buildAffordability({
        org_verified_salary_usd: 1000,
        requested_loan_amount: 100,
        household_size: 5,
      })
    );
    expect(score).toBe(250);
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it('result is capped at 250 even with ideal inputs', () => {
    const score = scoreAffordability(
      buildAffordability({
        org_verified_salary_usd: 10000,
        requested_loan_amount: 50,
        household_size: 10,
      })
    );
    expect(score).toBeLessThanOrEqual(250);
    expect(score).toBe(250);
  });

  it('household_size defaults to 1 when not provided', () => {
    // household_size || 1 -> if 0 passed, treated as 1
    const scoreWithZero = scoreAffordability(
      buildAffordability({ household_size: 0, requested_loan_amount: 100 })
    );
    const scoreWithOne = scoreAffordability(
      buildAffordability({ household_size: 1, requested_loan_amount: 100 })
    );
    expect(scoreWithZero).toBe(scoreWithOne);
  });
});
