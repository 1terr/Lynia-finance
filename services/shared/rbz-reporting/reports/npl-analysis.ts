/**
 * NPL Analysis — RBZ Report (Fineract-sourced)
 */

import { query } from '../../clients/database';
import { getFineractClient } from '../../clients/fineract';
import { round2, classifyNPL } from '../helpers';
import type {
  RBZReportConfig,
  NPLAnalysisReport,
  NPLAgingBuckets,
  NPLProvisionRequirement,
  NPLCategorySummary,
  ProductCategory,
} from '../../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EnrichedLoan {
  loanAccountNo: string;
  fineractLoanId: number;
  principalOutstanding: number;
  daysPastDue: number;
  loanNumber: string;
  customerId: string;
  productCategory: ProductCategory;
}

interface ProvisionRate {
  product_category: string;
  days_past_due_min: number;
  days_past_due_max: number | null;
  provision_rate: number;
  category_label: string;
}

/** Default provision rates per RBZ guidelines (used when loan_provision_rates table is unavailable). */
const DEFAULT_PROVISION_RATES: ProvisionRate[] = [
  { product_category: 'default', days_past_due_min: 0, days_past_due_max: 0, provision_rate: 1, category_label: 'Current (0 days)' },
  { product_category: 'default', days_past_due_min: 1, days_past_due_max: 30, provision_rate: 5, category_label: 'Watch (1-30 days)' },
  { product_category: 'default', days_past_due_min: 31, days_past_due_max: 60, provision_rate: 20, category_label: 'Substandard (31-60 days)' },
  { product_category: 'default', days_past_due_min: 61, days_past_due_max: 90, provision_rate: 50, category_label: 'Doubtful (61-90 days)' },
  { product_category: 'default', days_past_due_min: 91, days_past_due_max: 180, provision_rate: 80, category_label: 'Loss (91-180 days)' },
  { product_category: 'default', days_past_due_min: 181, days_past_due_max: null, provision_rate: 100, category_label: 'Write-off (181+ days)' },
];

/**
 * Fetch provision rates from the loan_provision_rates table for a given product category.
 * Falls back to default RBZ rates if the table or rows are unavailable.
 */
async function getProvisionRates(productCategory: string): Promise<ProvisionRate[]> {
  try {
    const { data: rates } = await query<ProvisionRate>(
      `SELECT product_category, days_past_due_min, days_past_due_max, provision_rate, category_label
       FROM loan_provision_rates
       WHERE product_category = $1
       ORDER BY days_past_due_min`,
      [productCategory]
    );
    if (rates && rates.length > 0) return rates;
  } catch {
    // Table may not exist yet — fall back to defaults
  }
  return DEFAULT_PROVISION_RATES;
}

/**
 * Look up the provision rate for a given DPD value from a rates array.
 */
function findProvisionRate(rates: ProvisionRate[], daysPastDue: number): number {
  for (const r of rates) {
    const max = r.days_past_due_max ?? Infinity;
    if (daysPastDue >= r.days_past_due_min && daysPastDue <= max) {
      return r.provision_rate;
    }
  }
  // Fallback: 100% for anything not matched
  return 100;
}

/**
 * Build aging buckets from a set of enriched loans.
 */
function buildAgingBuckets(loans: EnrichedLoan[], totalPortfolio: number): NPLAgingBuckets {
  const current = loans.filter(l => l.daysPastDue === 0);
  const d1_30 = loans.filter(l => l.daysPastDue >= 1 && l.daysPastDue <= 30);
  const d31_60 = loans.filter(l => l.daysPastDue >= 31 && l.daysPastDue <= 60);
  const d61_90 = loans.filter(l => l.daysPastDue >= 61 && l.daysPastDue <= 90);
  const d91_180 = loans.filter(l => l.daysPastDue >= 91 && l.daysPastDue <= 180);
  const d181plus = loans.filter(l => l.daysPastDue > 180);

  const bucketSum = (arr: EnrichedLoan[]) => arr.reduce((s, l) => s + l.principalOutstanding, 0);
  const pct = (amount: number) => totalPortfolio > 0 ? round2((amount / totalPortfolio) * 100) : 0;

  return {
    current: { count: current.length, outstanding: bucketSum(current), percentage: pct(bucketSum(current)) },
    days1to30: { count: d1_30.length, outstanding: bucketSum(d1_30), percentage: pct(bucketSum(d1_30)) },
    days31to60: { count: d31_60.length, outstanding: bucketSum(d31_60), percentage: pct(bucketSum(d31_60)) },
    days61to90: { count: d61_90.length, outstanding: bucketSum(d61_90), percentage: pct(bucketSum(d61_90)) },
    days91to180: { count: d91_180.length, outstanding: bucketSum(d91_180), percentage: pct(bucketSum(d91_180)) },
    days181plus: { count: d181plus.length, outstanding: bucketSum(d181plus), percentage: pct(bucketSum(d181plus)) },
  };
}

/**
 * Build provision requirements from loans using provision rates from the database.
 */
function buildProvisionRequirements(
  loans: EnrichedLoan[],
  rates: ProvisionRate[]
): NPLProvisionRequirement[] {
  // Group into buckets matching the rates
  return rates.map(r => {
    const max = r.days_past_due_max ?? Infinity;
    const bucket = loans.filter(l =>
      l.daysPastDue >= r.days_past_due_min && l.daysPastDue <= max
    );
    const outstandingAmount = bucket.reduce((s, l) => s + l.principalOutstanding, 0);
    return {
      category: r.category_label,
      loanCount: bucket.length,
      outstandingAmount,
      provisionRate: r.provision_rate,
      provisionAmount: round2(outstandingAmount * r.provision_rate / 100),
    };
  });
}

/**
 * Build a per-category NPL summary.
 */
async function buildCategorySummary(
  loans: EnrichedLoan[],
  category: ProductCategory
): Promise<NPLCategorySummary> {
  const catLoans = loans.filter(l => l.productCategory === category);
  const totalOutstanding = catLoans.reduce((s, l) => s + l.principalOutstanding, 0);
  const nplLoans = catLoans.filter(l => l.daysPastDue >= 90);
  const nplValue = nplLoans.reduce((s, l) => s + l.principalOutstanding, 0);

  const rates = await getProvisionRates(category);
  const provisionRequirements = buildProvisionRequirements(catLoans, rates);

  return {
    totalLoans: catLoans.length,
    totalOutstanding,
    nplRatio: totalOutstanding > 0 ? round2((nplValue / totalOutstanding) * 100) : 0,
    agingBuckets: buildAgingBuckets(catLoans, totalOutstanding),
    provisionRequirements,
  };
}

export async function generateNPLAnalysis(
  config: RBZReportConfig
): Promise<NPLAnalysisReport> {
  const fineract = await getFineractClient() as any;

  // Get all loans with Fineract IDs — now includes product_category
  const { data: loanMappings } = await query<{
    id: string;
    fineract_loan_id: number;
    outstanding_balance: number;
    days_past_due: number;
    loan_status: string;
    loan_number: string;
    customer_id: string;
    product_category: string;
  }>(
    `SELECT l.id, l.fineract_loan_id, l.outstanding_balance, l.days_past_due,
            l.loan_status, l.loan_number, l.customer_id,
            COALESCE(l.product_category, 'smartphone') AS product_category
     FROM loans l
     WHERE l.fineract_loan_id IS NOT NULL
       AND l.loan_status IN ('active', 'delinquent')`,
    []
  );

  const loans = loanMappings || [];
  const totalPortfolio = loans.reduce((s, l) => s + (l.outstanding_balance || 0), 0);

  // Enrich with Fineract data where possible
  const enrichedLoans: EnrichedLoan[] = [];

  for (const loan of loans.slice(0, 100)) {
    const category = (loan.product_category === 'digital' ? 'digital' : 'smartphone') as ProductCategory;
    try {
      const fLoan = await fineract.getLoan(loan.fineract_loan_id);
      enrichedLoans.push({
        loanAccountNo: fLoan.accountNo,
        fineractLoanId: loan.fineract_loan_id,
        principalOutstanding: fLoan.summary?.principalOutstanding ?? loan.outstanding_balance,
        daysPastDue: loan.days_past_due || 0,
        loanNumber: loan.loan_number,
        customerId: loan.customer_id,
        productCategory: category,
      });
    } catch {
      enrichedLoans.push({
        loanAccountNo: loan.loan_number,
        fineractLoanId: loan.fineract_loan_id,
        principalOutstanding: loan.outstanding_balance,
        daysPastDue: loan.days_past_due || 0,
        loanNumber: loan.loan_number,
        customerId: loan.customer_id,
        productCategory: category,
      });
    }
  }

  // Aging buckets (aggregate)
  const agingBuckets = buildAgingBuckets(enrichedLoans, totalPortfolio);

  // NPL = 90+ days past due
  const nplLoans = enrichedLoans.filter(l => l.daysPastDue >= 90);
  const nplValue = nplLoans.reduce((s, l) => s + l.principalOutstanding, 0);

  // Provision requirements — read from loan_provision_rates table, fall back to defaults
  const defaultRates = await getProvisionRates('default');
  const provisionCategories = buildProvisionRequirements(enrichedLoans, defaultRates);
  const totalProvision = provisionCategories.reduce((s, c) => s + c.provisionAmount, 0);

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

  // Per-product-category breakdown
  const smartphoneSummary = await buildCategorySummary(enrichedLoans, 'smartphone');
  const digitalSummary = await buildCategorySummary(enrichedLoans, 'digital');

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
    agingBuckets,
    provisionRequirements: provisionCategories,
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
    byProductCategory: {
      smartphone: smartphoneSummary,
      digital: digitalSummary,
    },
  };
}
