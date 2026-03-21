/**
 * Unit tests for services/shared/utils/rbz-compliance.ts
 *
 * Validates RBZ regulatory ceiling checks and internal policy caps
 * for loan product parameters.
 */

import { validateRBZCompliance } from '../rbz-compliance';

describe('validateRBZCompliance', () => {
  // ─── Compliant Products ─────────────────────────────────────────

  it('returns compliant when all fields are within limits', () => {
    const result = validateRBZCompliance({
      interest_rate_annual: 50,
      effective_apr: 60,
      max_amount_usd: 1500,
      insurance_fee_percentage: 10,
      late_penalty_percentage: 5,
    });

    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns compliant when fields are exactly at limits', () => {
    const result = validateRBZCompliance({
      interest_rate_annual: 100,
      effective_apr: 100,
      max_amount_usd: 2000,
      insurance_fee_percentage: 20,
      late_penalty_percentage: 10,
    });

    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns compliant when optional fields are omitted', () => {
    const result = validateRBZCompliance({
      interest_rate_annual: 50,
    });

    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns compliant for empty input', () => {
    const result = validateRBZCompliance({});

    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ─── Interest Rate Violations ───────────────────────────────────

  it('flags interest_rate_annual exceeding RBZ ceiling', () => {
    const result = validateRBZCompliance({
      interest_rate_annual: 150,
    });

    expect(result.compliant).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('interest_rate_annual');
    expect(result.violations[0].value).toBe(150);
    expect(result.violations[0].limit).toBe(100);
  });

  it('flags effective_apr exceeding RBZ ceiling', () => {
    const result = validateRBZCompliance({
      effective_apr: 101,
    });

    expect(result.compliant).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('effective_apr');
    expect(result.violations[0].value).toBe(101);
    expect(result.violations[0].limit).toBe(100);
  });

  // ─── Amount Violations ──────────────────────────────────────────

  it('flags max_amount_usd exceeding RBZ threshold', () => {
    const result = validateRBZCompliance({
      max_amount_usd: 5000,
    });

    expect(result.compliant).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('max_amount_usd');
    expect(result.violations[0].value).toBe(5000);
    expect(result.violations[0].limit).toBe(2000);
  });

  // ─── Fee Violations ─────────────────────────────────────────────

  it('flags insurance_fee_percentage exceeding policy cap', () => {
    const result = validateRBZCompliance({
      insurance_fee_percentage: 25,
    });

    expect(result.compliant).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('insurance_fee_percentage');
    expect(result.violations[0].value).toBe(25);
    expect(result.violations[0].limit).toBe(20);
  });

  it('flags late_penalty_percentage exceeding policy cap', () => {
    const result = validateRBZCompliance({
      late_penalty_percentage: 15,
    });

    expect(result.compliant).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].field).toBe('late_penalty_percentage');
    expect(result.violations[0].value).toBe(15);
    expect(result.violations[0].limit).toBe(10);
  });

  // ─── Multiple Violations ────────────────────────────────────────

  it('returns all violations when multiple fields exceed limits', () => {
    const result = validateRBZCompliance({
      interest_rate_annual: 200,
      effective_apr: 250,
      max_amount_usd: 10000,
      insurance_fee_percentage: 30,
      late_penalty_percentage: 20,
    });

    expect(result.compliant).toBe(false);
    expect(result.violations).toHaveLength(5);

    const violatedFields = result.violations.map((v) => v.field);
    expect(violatedFields).toContain('interest_rate_annual');
    expect(violatedFields).toContain('effective_apr');
    expect(violatedFields).toContain('max_amount_usd');
    expect(violatedFields).toContain('insurance_fee_percentage');
    expect(violatedFields).toContain('late_penalty_percentage');
  });

  // ─── Violation Message Format ───────────────────────────────────

  it('includes descriptive messages in violations', () => {
    const result = validateRBZCompliance({
      interest_rate_annual: 120,
    });

    expect(result.violations[0].message).toContain('120%');
    expect(result.violations[0].message).toContain('100%');
    expect(result.violations[0].message).toContain('RBZ');
  });
});
