/**
 * Capital Adequacy Report — RBZ Report (Quarterly)
 */

import { query } from '../../clients/database';
import { calculateProvisions, round2 } from '../helpers';
import type { RBZReportConfig, CapitalAdequacyReport } from '../../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateCapitalAdequacy(
  config: RBZReportConfig
): Promise<CapitalAdequacyReport> {
  const { data: loans } = await query<{
    outstanding_balance: number;
    days_past_due: number;
  }>(
    `SELECT outstanding_balance, days_past_due FROM loans
     WHERE loan_status IN ('active', 'delinquent')`,
    []
  );

  const portfolioValue = (loans || []).reduce((s, l) => s + (l.outstanding_balance || 0), 0);
  const provisions = calculateProvisions(
    (loans || []).map(l => ({ ...l, principal_amount: l.outstanding_balance, loan_status: 'active' }))
  );

  const paidUpCapital = 100000;
  const retainedEarnings = 0;
  const tier1Total = paidUpCapital + retainedEarnings;
  const tier2Total = provisions;
  const totalCapital = tier1Total + tier2Total;

  const riskWeightedAssets = portfolioValue;
  const car = riskWeightedAssets > 0 ? (totalCapital / riskWeightedAssets) * 100 : 100;

  return {
    reportingPeriod: {
      start: config.periodStart.toISOString(),
      end: config.periodEnd.toISOString(),
    },
    currency: config.currency,

    tier1Capital: {
      paidUpCapital,
      retainedEarnings,
      otherReserves: 0,
      lessIntangibleAssets: 0,
      total: tier1Total,
    },

    tier2Capital: {
      generalProvisions: provisions,
      subordinatedDebt: 0,
      total: tier2Total,
    },

    totalRegulatoryCapital: totalCapital,

    riskWeightedAssets: {
      cashAndGovSecurities: { amount: 50000, riskWeight: 0, weighted: 0 },
      interBankDeposits: { amount: 0, riskWeight: 20, weighted: 0 },
      loanPortfolio: { amount: portfolioValue, riskWeight: 100, weighted: portfolioValue },
      fixedAssets: { amount: 0, riskWeight: 100, weighted: 0 },
      otherAssets: { amount: 0, riskWeight: 100, weighted: 0 },
      total: portfolioValue,
    },

    ratios: {
      capitalAdequacyRatio: round2(car),
      tier1Ratio: riskWeightedAssets > 0 ? round2((tier1Total / riskWeightedAssets) * 100) : 100,
      leverageRatio: totalCapital > 0 ? round2((portfolioValue / totalCapital) * 100) : 0,
    },

    rbzMinimumRequirements: {
      minimumCAR: 12,
      minimumTier1: 8,
      isCompliant: car >= 12,
      shortfall: car >= 12 ? 0 : round2((12 - car) * riskWeightedAssets / 100),
    },
  };
}
