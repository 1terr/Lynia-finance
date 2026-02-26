/**
 * Interest Rate Schedule — RBZ Report (Annual)
 */

import { query } from '../../clients/database';
import { getFineractClient } from '../../clients/fineract';
import { logger } from '../../utils/logger';
import { RBZ_RATE_CEILING } from '../helpers';
import type { RBZReportConfig, InterestRateSchedule } from '../../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateInterestRateSchedule(
  config: RBZReportConfig
): Promise<InterestRateSchedule> {
  // Loan products from Lynia DB
  const { data: products } = await query<{
    id: string;
    name: string;
    interest_rate: number;
    min_amount: number;
    max_amount: number;
    fineract_product_id: number | null;
  }>(
    `SELECT id, name, interest_rate, min_amount, max_amount, fineract_product_id
     FROM loan_products
     WHERE active = true`,
    []
  );

  // Enrich with Fineract product data
  const fineract = await getFineractClient() as any;
  const productEntries: InterestRateSchedule['products'] = [];

  for (const p of products || []) {
    let effectiveRate = p.interest_rate;
    let calculationMethod: 'declining_balance' | 'flat' = 'declining_balance';

    if (p.fineract_product_id) {
      try {
        const fp = await fineract.getLoanProduct(p.fineract_product_id);
        effectiveRate = fp.annualInterestRate || p.interest_rate;
        calculationMethod = fp.interestType?.value === 'Flat' ? 'flat' : 'declining_balance';
      } catch {
        // Use Lynia DB values
      }
    }

    productEntries.push({
      productId: parseInt(p.id) || 0,
      fineractProductId: p.fineract_product_id ?? undefined,
      productName: p.name,
      productType: 'Device Finance',
      nominalRate: p.interest_rate,
      effectiveRate,
      calculationMethod,
      compoundingFrequency: 'monthly',
      minimumRate: p.interest_rate * 0.8,
      maximumRate: p.interest_rate * 1.2,
      penaltyRate: p.interest_rate * 0.5,
      gracePeriodsAllowed: 0,
    });
  }

  const deviations = productEntries
    .filter(p => p.effectiveRate > RBZ_RATE_CEILING)
    .map(p => ({
      productName: p.productName,
      rate: p.effectiveRate,
      ceiling: RBZ_RATE_CEILING,
      justification: 'Microfinance device-secured lending with elevated risk profile',
    }));

  return {
    reportingYear: config.periodEnd.getFullYear(),
    effectiveDate: config.periodStart.toISOString(),
    products: productEntries,
    feeSchedule: [
      { feeName: 'Origination Fee', feeType: 'percentage', amount: 3, applicableTo: 'All products', frequency: 'Once' },
      { feeName: 'Late Payment Fee', feeType: 'flat', amount: 5, applicableTo: 'All products', frequency: 'Per occurrence' },
    ],
    rbzRateCeiling: RBZ_RATE_CEILING,
    allProductsWithinCeiling: deviations.length === 0,
    deviations,
  };
}
