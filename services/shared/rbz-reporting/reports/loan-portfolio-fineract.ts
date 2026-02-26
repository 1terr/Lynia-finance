/**
 * Loan Portfolio from Fineract — RBZ Report (Monthly)
 */

import { query } from '../../clients/database';
import { getFineractClient } from '../../clients/fineract';
import { round2 } from '../helpers';
import type { RBZReportConfig, LoanPortfolioFineractReport } from '../../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateLoanPortfolioFineract(
  config: RBZReportConfig
): Promise<LoanPortfolioFineractReport> {
  const fineract = await getFineractClient() as any;

  // Get all active Fineract loans via Lynia mapping
  const { data: loanMappings } = await query<{
    id: string;
    fineract_loan_id: number;
    loan_status: string;
  }>(
    `SELECT id, fineract_loan_id, loan_status FROM loans
     WHERE fineract_loan_id IS NOT NULL
       AND loan_status IN ('active', 'delinquent')`,
    []
  );

  const loans = loanMappings || [];

  let totalDisbursed = 0;
  let totalPrincipalOutstanding = 0;
  let totalPrincipalPaid = 0;
  let totalInterestCharged = 0;
  let totalInterestPaid = 0;
  let totalInterestOutstanding = 0;
  let totalFeesCharged = 0;
  let totalFeesPaid = 0;
  let totalPenaltiesCharged = 0;
  let totalPenaltiesPaid = 0;
  let totalWrittenOff = 0;
  let totalWaived = 0;

  const productMap = new Map<string, {
    productId: number;
    productName: string;
    loanCount: number;
    principalDisbursed: number;
    principalOutstanding: number;
    interestOutstanding: number;
    overdueAmount: number;
    par30: number;
  }>();

  const statusMap = new Map<string, { count: number; principalAmount: number }>();

  for (const loan of loans.slice(0, 200)) {
    try {
      const fLoan = await fineract.getLoan(loan.fineract_loan_id);
      const summary = fLoan.summary;
      if (!summary) continue;

      totalDisbursed += summary.principalDisbursed;
      totalPrincipalOutstanding += summary.principalOutstanding;
      totalPrincipalPaid += summary.principalPaid;
      totalInterestCharged += summary.interestCharged;
      totalInterestPaid += summary.interestPaid;
      totalInterestOutstanding += summary.interestOutstanding;
      totalFeesCharged += summary.feeChargesCharged;
      totalFeesPaid += summary.feeChargesPaid;
      totalPenaltiesCharged += summary.penaltyChargesCharged;
      totalPenaltiesPaid += summary.penaltyChargesPaid;
      totalWrittenOff += summary.totalWrittenOff;
      totalWaived += summary.totalWaived;

      // By product
      const productKey = `${fLoan.loanProductId}`;
      const existing = productMap.get(productKey) || {
        productId: fLoan.loanProductId,
        productName: fLoan.loanProductName,
        loanCount: 0,
        principalDisbursed: 0,
        principalOutstanding: 0,
        interestOutstanding: 0,
        overdueAmount: 0,
        par30: 0,
      };
      existing.loanCount++;
      existing.principalDisbursed += summary.principalDisbursed;
      existing.principalOutstanding += summary.principalOutstanding;
      existing.interestOutstanding += summary.interestOutstanding;
      existing.overdueAmount += summary.totalOverdue;
      if (summary.totalOverdue > 0) existing.par30++;
      productMap.set(productKey, existing);

      // By status
      const statusCode = fLoan.status.code;
      const statusEntry = statusMap.get(statusCode) || { count: 0, principalAmount: 0 };
      statusEntry.count++;
      statusEntry.principalAmount += summary.principalDisbursed;
      statusMap.set(statusCode, statusEntry);
    } catch {
      // Skip loans that can't be fetched
    }
  }

  return {
    reportingPeriod: {
      start: config.periodStart.toISOString(),
      end: config.periodEnd.toISOString(),
    },
    generatedFrom: 'fineract',
    currency: config.currency,
    portfolioSummary: {
      totalActiveLoans: loans.length,
      totalDisbursedPrincipal: round2(totalDisbursed),
      totalPrincipalOutstanding: round2(totalPrincipalOutstanding),
      totalPrincipalPaid: round2(totalPrincipalPaid),
      totalInterestCharged: round2(totalInterestCharged),
      totalInterestPaid: round2(totalInterestPaid),
      totalInterestOutstanding: round2(totalInterestOutstanding),
      totalFeesCharged: round2(totalFeesCharged),
      totalFeesPaid: round2(totalFeesPaid),
      totalPenaltiesCharged: round2(totalPenaltiesCharged),
      totalPenaltiesPaid: round2(totalPenaltiesPaid),
      totalWrittenOff: round2(totalWrittenOff),
      totalWaived: round2(totalWaived),
    },
    loansByProduct: Array.from(productMap.values()),
    loansByStatus: Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      principalAmount: data.principalAmount,
    })),
    disbursementTrend: [],
    collectionPerformance: {
      expectedCollections: totalInterestCharged + totalDisbursed,
      actualCollections: totalPrincipalPaid + totalInterestPaid,
      collectionRate: (totalInterestCharged + totalDisbursed) > 0
        ? round2(((totalPrincipalPaid + totalInterestPaid) / (totalInterestCharged + totalDisbursed)) * 100)
        : 0,
      onTimePayments: 0,
      latePayments: 0,
      missedPayments: 0,
    },
  };
}
