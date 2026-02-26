/**
 * NPL Analysis — RBZ Report (Fineract-sourced)
 */

import { query } from '../../clients/database';
import { getFineractClient } from '../../clients/fineract';
import { logger } from '../../utils/logger';
import { round2, classifyNPL } from '../helpers';
import type { RBZReportConfig, NPLAnalysisReport } from '../../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateNPLAnalysis(
  config: RBZReportConfig
): Promise<NPLAnalysisReport> {
  const fineract = await getFineractClient() as any;

  // Get all loans with Fineract IDs
  const { data: loanMappings } = await query<{
    id: string;
    fineract_loan_id: number;
    outstanding_balance: number;
    days_past_due: number;
    loan_status: string;
    loan_number: string;
    customer_id: string;
  }>(
    `SELECT l.id, l.fineract_loan_id, l.outstanding_balance, l.days_past_due,
            l.loan_status, l.loan_number, l.customer_id
     FROM loans l
     WHERE l.fineract_loan_id IS NOT NULL
       AND l.loan_status IN ('active', 'delinquent')`,
    []
  );

  const loans = loanMappings || [];
  const totalPortfolio = loans.reduce((s, l) => s + (l.outstanding_balance || 0), 0);

  // Enrich with Fineract data where possible
  const enrichedLoans: Array<{
    loanAccountNo: string;
    fineractLoanId: number;
    principalOutstanding: number;
    daysPastDue: number;
    loanNumber: string;
    customerId: string;
  }> = [];

  for (const loan of loans.slice(0, 100)) {
    try {
      const fLoan = await fineract.getLoan(loan.fineract_loan_id);
      enrichedLoans.push({
        loanAccountNo: fLoan.accountNo,
        fineractLoanId: loan.fineract_loan_id,
        principalOutstanding: fLoan.summary?.principalOutstanding ?? loan.outstanding_balance,
        daysPastDue: loan.days_past_due || 0,
        loanNumber: loan.loan_number,
        customerId: loan.customer_id,
      });
    } catch {
      enrichedLoans.push({
        loanAccountNo: loan.loan_number,
        fineractLoanId: loan.fineract_loan_id,
        principalOutstanding: loan.outstanding_balance,
        daysPastDue: loan.days_past_due || 0,
        loanNumber: loan.loan_number,
        customerId: loan.customer_id,
      });
    }
  }

  // Aging buckets
  const current = enrichedLoans.filter(l => l.daysPastDue === 0);
  const d1_30 = enrichedLoans.filter(l => l.daysPastDue >= 1 && l.daysPastDue <= 30);
  const d31_60 = enrichedLoans.filter(l => l.daysPastDue >= 31 && l.daysPastDue <= 60);
  const d61_90 = enrichedLoans.filter(l => l.daysPastDue >= 61 && l.daysPastDue <= 90);
  const d91_180 = enrichedLoans.filter(l => l.daysPastDue >= 91 && l.daysPastDue <= 180);
  const d181plus = enrichedLoans.filter(l => l.daysPastDue > 180);

  const bucketSum = (arr: typeof enrichedLoans) => arr.reduce((s, l) => s + l.principalOutstanding, 0);
  const pct = (amount: number) => totalPortfolio > 0 ? round2((amount / totalPortfolio) * 100) : 0;

  // NPL = 90+ days past due
  const nplLoans = enrichedLoans.filter(l => l.daysPastDue >= 90);
  const nplValue = bucketSum(nplLoans);

  // Provision requirements per RBZ guidelines
  const provisionCategories = [
    { category: 'Current (0 days)', loanCount: current.length, outstandingAmount: bucketSum(current), provisionRate: 1 },
    { category: 'Watch (1-30 days)', loanCount: d1_30.length, outstandingAmount: bucketSum(d1_30), provisionRate: 5 },
    { category: 'Substandard (31-60 days)', loanCount: d31_60.length, outstandingAmount: bucketSum(d31_60), provisionRate: 20 },
    { category: 'Doubtful (61-90 days)', loanCount: d61_90.length, outstandingAmount: bucketSum(d61_90), provisionRate: 50 },
    { category: 'Loss (91-180 days)', loanCount: d91_180.length, outstandingAmount: bucketSum(d91_180), provisionRate: 80 },
    { category: 'Write-off (181+ days)', loanCount: d181plus.length, outstandingAmount: bucketSum(d181plus), provisionRate: 100 },
  ];

  const totalProvision = provisionCategories.reduce(
    (s, c) => s + (c.outstandingAmount * c.provisionRate / 100), 0
  );

  // Top NPL loans (sorted by outstanding)
  const topNPLLoans = nplLoans
    .sort((a, b) => b.principalOutstanding - a.principalOutstanding)
    .slice(0, 20)
    .map(l => ({
      loanAccountNo: l.loanAccountNo,
      fineractLoanId: l.fineractLoanId,
      borrowerName: `Customer ${l.customerId.substring(0, 8)}`,
      principalOutstanding: l.principalOutstanding,
      daysPastDue: l.daysPastDue,
      classification: classifyNPL(l.daysPastDue),
    }));

  // Recoveries in period
  const { data: recoveryData } = await query<{ count: string; total: string }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
     FROM payments
     WHERE payment_type = 'recovery' AND status = 'completed'
       AND created_at >= $1 AND created_at <= $2`,
    [config.periodStart.toISOString(), config.periodEnd.toISOString()]
  );

  const recoveredCount = parseInt(recoveryData?.[0]?.count || '0');
  const recoveredAmount = parseFloat(recoveryData?.[0]?.total || '0');

  return {
    reportingPeriod: {
      start: config.periodStart.toISOString(),
      end: config.periodEnd.toISOString(),
    },
    generatedFrom: 'fineract',
    currency: config.currency,
    summary: {
      totalLoans: enrichedLoans.length,
      totalPortfolioValue: totalPortfolio,
      nplCount: nplLoans.length,
      nplValue,
      nplRatio: totalPortfolio > 0 ? round2((nplValue / totalPortfolio) * 100) : 0,
      provisionCoverageRatio: nplValue > 0 ? round2((totalProvision / nplValue) * 100) : 100,
    },
    agingBuckets: {
      current: { count: current.length, outstanding: bucketSum(current), percentage: pct(bucketSum(current)) },
      days1to30: { count: d1_30.length, outstanding: bucketSum(d1_30), percentage: pct(bucketSum(d1_30)) },
      days31to60: { count: d31_60.length, outstanding: bucketSum(d31_60), percentage: pct(bucketSum(d31_60)) },
      days61to90: { count: d61_90.length, outstanding: bucketSum(d61_90), percentage: pct(bucketSum(d61_90)) },
      days91to180: { count: d91_180.length, outstanding: bucketSum(d91_180), percentage: pct(bucketSum(d91_180)) },
      days181plus: { count: d181plus.length, outstanding: bucketSum(d181plus), percentage: pct(bucketSum(d181plus)) },
    },
    provisionRequirements: provisionCategories.map(c => ({
      ...c,
      provisionAmount: round2(c.outstandingAmount * c.provisionRate / 100),
    })),
    topNPLLoans,
    restructuredLoans: {
      count: 0,
      totalAmount: 0,
      performingCount: 0,
      nonPerformingCount: 0,
    },
    recoveries: {
      recoveredCount,
      recoveredAmount,
      recoveryRate: nplValue > 0 ? round2((recoveredAmount / nplValue) * 100) : 0,
    },
  };
}
