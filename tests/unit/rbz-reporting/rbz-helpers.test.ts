/**
 * Unit tests for RBZ Reporting helper functions.
 *
 * These are pure functions — no mocks are needed.
 */

import {
  filterSum,
  computeChecksum,
  round2,
  formatDateForFineract,
  mapGLAccountType,
  classifyNPL,
  calculateProvisions,
  parPercentage,
  INSTITUTION_NAME,
  LICENSE_NUMBER,
  LARGE_TRANSACTION_THRESHOLD_USD,
} from '../../../services/shared/rbz-reporting/helpers';

// ===================================================================
// round2
// ===================================================================

describe('round2', () => {
  it('should round 0.005 up to 0.01', () => {
    expect(round2(0.005)).toBe(0.01);
  });

  it('should round 1.999 to 2', () => {
    expect(round2(1.999)).toBe(2);
  });

  it('should handle negative numbers', () => {
    expect(round2(-3.456)).toBe(-3.46);
  });

  it('should return 0 for 0', () => {
    expect(round2(0)).toBe(0);
  });
});

// ===================================================================
// computeChecksum
// ===================================================================

describe('computeChecksum', () => {
  it('should return a deterministic hex string for the same input', () => {
    const data = { foo: 'bar', count: 42 };
    const hash1 = computeChecksum(data);
    const hash2 = computeChecksum(data);
    expect(hash1).toBe(hash2);
  });

  it('should return different checksums for different inputs', () => {
    const hash1 = computeChecksum({ a: 1 });
    const hash2 = computeChecksum({ a: 2 });
    expect(hash1).not.toBe(hash2);
  });

  it('should return a 64-character hex string (SHA-256)', () => {
    const hash = computeChecksum({ test: true });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ===================================================================
// formatDateForFineract
// ===================================================================

describe('formatDateForFineract', () => {
  it('should format Jan 1 2024 as "01 January 2024"', () => {
    const date = new Date(2024, 0, 1); // Month is 0-indexed
    expect(formatDateForFineract(date)).toBe('01 January 2024');
  });

  it('should format Dec 31 2024 as "31 December 2024"', () => {
    const date = new Date(2024, 11, 31);
    expect(formatDateForFineract(date)).toBe('31 December 2024');
  });

  it('should pad single-digit days with a leading zero', () => {
    const date = new Date(2026, 5, 5); // June 5
    expect(formatDateForFineract(date)).toBe('05 June 2026');
  });
});

// ===================================================================
// mapGLAccountType
// ===================================================================

describe('mapGLAccountType', () => {
  it('should map "accountType.asset" to "ASSET"', () => {
    expect(mapGLAccountType('accountType.asset')).toBe('ASSET');
  });

  it('should map "accountType.liability" to "LIABILITY"', () => {
    expect(mapGLAccountType('accountType.liability')).toBe('LIABILITY');
  });

  it('should map "accountType.equity" to "EQUITY"', () => {
    expect(mapGLAccountType('accountType.equity')).toBe('EQUITY');
  });

  it('should map "accountType.income" to "INCOME"', () => {
    expect(mapGLAccountType('accountType.income')).toBe('INCOME');
  });

  it('should map "accountType.expense" to "EXPENSE"', () => {
    expect(mapGLAccountType('accountType.expense')).toBe('EXPENSE');
  });

  it('should map bare "ASSET" to "ASSET"', () => {
    expect(mapGLAccountType('ASSET')).toBe('ASSET');
  });

  it('should map bare "LIABILITY" to "LIABILITY"', () => {
    expect(mapGLAccountType('LIABILITY')).toBe('LIABILITY');
  });

  it('should map bare "EQUITY" to "EQUITY"', () => {
    expect(mapGLAccountType('EQUITY')).toBe('EQUITY');
  });

  it('should map bare "INCOME" to "INCOME"', () => {
    expect(mapGLAccountType('INCOME')).toBe('INCOME');
  });

  it('should map bare "EXPENSE" to "EXPENSE"', () => {
    expect(mapGLAccountType('EXPENSE')).toBe('EXPENSE');
  });

  it('should default unknown types to "ASSET"', () => {
    expect(mapGLAccountType('something_unknown')).toBe('ASSET');
  });
});

// ===================================================================
// classifyNPL
// ===================================================================

describe('classifyNPL', () => {
  it('should classify 0 days as "Watch"', () => {
    expect(classifyNPL(0)).toBe('Watch');
  });

  it('should classify 30 days (boundary) as "Watch"', () => {
    expect(classifyNPL(30)).toBe('Watch');
  });

  it('should classify 31 days as "Substandard"', () => {
    expect(classifyNPL(31)).toBe('Substandard');
  });

  it('should classify 60 days (boundary) as "Substandard"', () => {
    expect(classifyNPL(60)).toBe('Substandard');
  });

  it('should classify 61 days as "Doubtful"', () => {
    expect(classifyNPL(61)).toBe('Doubtful');
  });

  it('should classify 90 days (boundary) as "Doubtful"', () => {
    expect(classifyNPL(90)).toBe('Doubtful');
  });

  it('should classify 91 days as "Loss"', () => {
    expect(classifyNPL(91)).toBe('Loss');
  });

  it('should classify 180 days (boundary) as "Loss"', () => {
    expect(classifyNPL(180)).toBe('Loss');
  });

  it('should classify 181 days as "Write-off"', () => {
    expect(classifyNPL(181)).toBe('Write-off');
  });

  it('should classify 365 days as "Write-off"', () => {
    expect(classifyNPL(365)).toBe('Write-off');
  });
});

// ===================================================================
// calculateProvisions
// ===================================================================

describe('calculateProvisions', () => {
  it('should provision 1% for dpd 0', () => {
    const result = calculateProvisions([{ outstanding_balance: 1000, days_past_due: 0 }]);
    expect(result).toBe(10); // 1000 * 0.01
  });

  it('should provision 5% for dpd 30', () => {
    const result = calculateProvisions([{ outstanding_balance: 1000, days_past_due: 30 }]);
    expect(result).toBe(50); // 1000 * 0.05
  });

  it('should provision 20% for dpd 60', () => {
    const result = calculateProvisions([{ outstanding_balance: 1000, days_past_due: 60 }]);
    expect(result).toBe(200); // 1000 * 0.20
  });

  it('should provision 50% for dpd 90', () => {
    const result = calculateProvisions([{ outstanding_balance: 1000, days_past_due: 90 }]);
    expect(result).toBe(500); // 1000 * 0.50
  });

  it('should provision 80% for dpd 180', () => {
    const result = calculateProvisions([{ outstanding_balance: 1000, days_past_due: 180 }]);
    expect(result).toBe(800); // 1000 * 0.80
  });

  it('should provision 100% for dpd 181+', () => {
    const result = calculateProvisions([{ outstanding_balance: 1000, days_past_due: 200 }]);
    expect(result).toBe(1000); // 1000 * 1.00
  });

  it('should return 0 for an empty array', () => {
    expect(calculateProvisions([])).toBe(0);
  });

  it('should sum provisions across multiple loans', () => {
    const loans = [
      { outstanding_balance: 1000, days_past_due: 0 },   // 10
      { outstanding_balance: 2000, days_past_due: 45 },  // 400
      { outstanding_balance: 500, days_past_due: 100 },   // 400
    ];
    const result = calculateProvisions(loans);
    expect(result).toBe(810); // 10 + 400 + 400
  });

  it('should fall back to principal_amount when outstanding_balance is missing', () => {
    const result = calculateProvisions([{ principal_amount: 500, days_past_due: 0 }]);
    expect(result).toBe(5); // 500 * 0.01
  });
});

// ===================================================================
// parPercentage
// ===================================================================

describe('parPercentage', () => {
  it('should return 0 for an empty portfolio', () => {
    expect(parPercentage([], 30)).toBe(0);
  });

  it('should return 0 when all loans are current (dpd=0)', () => {
    const loans = [
      { outstanding_balance: 1000, days_past_due: 0 },
      { outstanding_balance: 2000, days_past_due: 0 },
    ];
    expect(parPercentage(loans, 30)).toBe(0);
  });

  it('should calculate correct PAR percentage when some loans are overdue', () => {
    const loans = [
      { outstanding_balance: 500, days_past_due: 0 },
      { outstanding_balance: 500, days_past_due: 45 },
    ];
    // PAR30 = 500 / 1000 = 50%
    expect(parPercentage(loans, 30)).toBe(50);
  });

  it('should return 0 when total portfolio balance is 0', () => {
    const loans = [
      { outstanding_balance: 0, days_past_due: 90 },
    ];
    expect(parPercentage(loans, 30)).toBe(0);
  });
});

// ===================================================================
// filterSum
// ===================================================================

describe('filterSum', () => {
  it('should filter by field value and sum amounts', () => {
    const items = [
      { amount: 100, type: 'repayment' },
      { amount: 200, type: 'disbursement' },
      { amount: 50, type: 'repayment' },
    ];
    const result = filterSum(items, 'type', 'repayment');
    expect(result.count).toBe(2);
    expect(result.amount).toBe(150);
  });

  it('should return {count: 0, amount: 0} for empty array', () => {
    const result = filterSum([], 'type', 'repayment');
    expect(result.count).toBe(0);
    expect(result.amount).toBe(0);
  });

  it('should return {count: 0, amount: 0} when no items match', () => {
    const items = [
      { amount: 100, type: 'fee' },
    ];
    const result = filterSum(items, 'type', 'repayment');
    expect(result.count).toBe(0);
    expect(result.amount).toBe(0);
  });
});

// ===================================================================
// Constants
// ===================================================================

describe('Constants', () => {
  it('should have correct INSTITUTION_NAME', () => {
    expect(INSTITUTION_NAME).toBe('Lynia Finance (Pvt) Ltd');
  });

  it('should have LICENSE_NUMBER default', () => {
    // In test environment, process.env.RBZ_LICENSE_NUMBER is not set
    expect(LICENSE_NUMBER).toBe('MFI-PENDING');
  });

  it('should have LARGE_TRANSACTION_THRESHOLD_USD = 2000', () => {
    expect(LARGE_TRANSACTION_THRESHOLD_USD).toBe(2000);
  });
});
