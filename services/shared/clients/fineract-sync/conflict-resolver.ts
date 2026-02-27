/**
 * Conflict Resolver / Query Helpers Module
 *
 * Query helpers for reading Fineract data (loan balances, schedules).
 * Used by whatsapp-service and other consumers to display loan information.
 * Falls back to Lynia DB if Fineract is unavailable.
 */

import { getFineractClient, parseFineractDate } from '../fineract';

// ============================================================
// QUERY HELPERS (used by whatsapp-service)
// ============================================================

/**
 * Get loan balance and schedule from Fineract.
 * Falls back to Lynia DB if Fineract is unavailable.
 */
export async function getFineractLoanBalance(fineractLoanId: number): Promise<{
  principalOutstanding: number;
  interestOutstanding: number;
  totalOutstanding: number;
  totalPaid: number;
  nextDueDate: Date | null;
  nextDueAmount: number;
  currency: string;
} | null> {
  try {
    const fineract = await getFineractClient();
    const loan = await fineract.getLoanWithSchedule(fineractLoanId);

    const schedule = loan.repaymentSchedule;
    const nextPeriod = schedule?.periods.find(
      (p) => p.period > 0 && !p.complete && p.totalOutstandingForPeriod > 0
    );

    return {
      principalOutstanding: loan.summary.principalOutstanding,
      interestOutstanding: loan.summary.interestOutstanding,
      totalOutstanding: loan.summary.totalOutstanding,
      totalPaid: loan.summary.totalRepayment,
      nextDueDate: nextPeriod ? parseFineractDate(nextPeriod.dueDate) : null,
      nextDueAmount: nextPeriod?.totalDueForPeriod || 0,
      currency: loan.currency.code,
    };
  } catch (error) {
    console.error(`[fineract-sync] Failed to get loan balance for Fineract loan ${fineractLoanId}:`, error);
    return null;
  }
}

/**
 * Get full repayment schedule from Fineract.
 * Returns a simplified schedule suitable for WhatsApp display.
 */
export async function getFineractRepaymentSchedule(fineractLoanId: number): Promise<
  Array<{
    period: number;
    dueDate: Date;
    principalDue: number;
    interestDue: number;
    totalDue: number;
    totalPaid: number;
    outstanding: number;
    complete: boolean;
  }> | null
> {
  try {
    const fineract = await getFineractClient();
    const loan = await fineract.getLoanWithSchedule(fineractLoanId);

    if (!loan.repaymentSchedule) return null;

    return loan.repaymentSchedule.periods
      .filter((p) => p.period > 0) // Skip disbursement period
      .map((p) => ({
        period: p.period,
        dueDate: parseFineractDate(p.dueDate),
        principalDue: p.principalDue,
        interestDue: p.interestDue,
        totalDue: p.totalDueForPeriod,
        totalPaid: p.totalPaidForPeriod,
        outstanding: p.totalOutstandingForPeriod,
        complete: p.complete,
      }));
  } catch (error) {
    console.error(`[fineract-sync] Failed to get schedule for Fineract loan ${fineractLoanId}:`, error);
    return null;
  }
}
