/**
 * RBZ Reporting — Pure Helper Functions & Constants
 *
 * Extracted from the monolithic fineract-rbz-reporting.ts so that
 * individual report modules can import only what they need, and
 * so that these pure functions can be tested without any mocks.
 */

import { createHash } from 'crypto';

// ===================================================================
// CONSTANTS
// ===================================================================

export const INSTITUTION_NAME = 'Lynia Finance (Pvt) Ltd';
export const LICENSE_NUMBER = process.env.RBZ_LICENSE_NUMBER || 'MFI-PENDING';
export const LARGE_TRANSACTION_THRESHOLD_USD = 2000;
export const RBZ_RATE_CEILING = 100; // Annual interest rate ceiling

// ===================================================================
// PURE HELPERS
// ===================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Filter an array of items by a field value and sum their `amount` property.
 */
export function filterSum(
  items: Array<{ amount: number; [key: string]: unknown }>,
  field: string,
  value: string
): { count: number; amount: number } {
  const filtered = items.filter(i => i[field] === value);
  return {
    count: filtered.length,
    amount: filtered.reduce((s, i) => s + (i.amount || 0), 0),
  };
}

/**
 * Compute a SHA-256 hex checksum of a JSON-serialisable object.
 */
export function computeChecksum(data: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

/**
 * Round a number to 2 decimal places.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Format a JS Date to the Fineract date string: "dd MMMM yyyy"
 * Example: new Date('2024-01-01') -> "01 January 2024"
 */
export function formatDateForFineract(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Map a Fineract GL account type string to one of the five standard types.
 */
export function mapGLAccountType(fineractType: string): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' {
  const map: Record<string, 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'> = {
    'accountType.asset': 'ASSET',
    'accountType.liability': 'LIABILITY',
    'accountType.equity': 'EQUITY',
    'accountType.income': 'INCOME',
    'accountType.expense': 'EXPENSE',
    'ASSET': 'ASSET',
    'LIABILITY': 'LIABILITY',
    'EQUITY': 'EQUITY',
    'INCOME': 'INCOME',
    'EXPENSE': 'EXPENSE',
  };
  return map[fineractType] || 'ASSET';
}

/**
 * Classify a loan by days-past-due into an NPL category.
 */
export function classifyNPL(daysPastDue: number): string {
  if (daysPastDue <= 30) return 'Watch';
  if (daysPastDue <= 60) return 'Substandard';
  if (daysPastDue <= 90) return 'Doubtful';
  if (daysPastDue <= 180) return 'Loss';
  return 'Write-off';
}

/**
 * Calculate total loan-loss provisions per RBZ guidelines.
 */
export function calculateProvisions(
  loans: Array<{ outstanding_balance?: number; principal_amount?: number; days_past_due?: number }>
): number {
  let total = 0;
  for (const loan of loans) {
    const balance = loan.outstanding_balance || loan.principal_amount || 0;
    const dpd = loan.days_past_due || 0;

    if (dpd === 0) total += balance * 0.01;
    else if (dpd <= 30) total += balance * 0.05;
    else if (dpd <= 60) total += balance * 0.20;
    else if (dpd <= 90) total += balance * 0.50;
    else if (dpd <= 180) total += balance * 0.80;
    else total += balance * 1.00;
  }
  return round2(total);
}

/**
 * Calculate Portfolio-at-Risk percentage at a given threshold.
 */
export function parPercentage(
  loans: Array<{ outstanding_balance?: number; days_past_due?: number }>,
  threshold: number
): number {
  const totalPortfolio = loans.reduce((s, l) => s + (l.outstanding_balance || 0), 0);
  if (totalPortfolio === 0) return 0;

  const parAmount = loans
    .filter(l => (l.days_past_due || 0) >= threshold)
    .reduce((s, l) => s + (l.outstanding_balance || 0), 0);

  return round2((parAmount / totalPortfolio) * 100);
}
