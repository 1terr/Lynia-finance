import { fetchAPI } from '@lynia/api-client';

/** Safe number coercion — returns 0 for undefined/null/NaN */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeeRevenueData {
  summary: {
    insurance_fee_income: number;
    penalty_fee_income: number;
    total_fee_income: number;
    loan_count: number;
  };
  by_product: Array<{
    product_id: string;
    product_name: string;
    product_category: string;
    insurance_fee_income: number;
    penalty_fee_income: number;
    total_fee_income: number;
    loan_count: number;
  }>;
  by_month: Array<{
    month: string;
    insurance_fee_income: number;
    penalty_fee_income: number;
    total_fee_income: number;
    loan_count: number;
  }>;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

export async function fetchFeeRevenueReport(
  startDate: string,
  endDate: string,
  productId?: string
): Promise<FeeRevenueData> {
  const params = new URLSearchParams();
  params.set('start_date', startDate);
  params.set('end_date', endDate);
  if (productId) params.set('product_id', productId);

  const raw = await fetchAPI<Record<string, unknown>>(
    `/api/v1/investor/fee-revenue?${params.toString()}`
  );

  const rawSummary = (raw.summary || {}) as Record<string, unknown>;
  const rawByProduct = (Array.isArray(raw.by_product) ? raw.by_product : []) as Record<string, unknown>[];
  const rawByMonth = (Array.isArray(raw.by_month) ? raw.by_month : []) as Record<string, unknown>[];

  return {
    summary: {
      insurance_fee_income: num(rawSummary.insurance_fee_income),
      penalty_fee_income: num(rawSummary.penalty_fee_income),
      total_fee_income: num(rawSummary.total_fee_income),
      loan_count: num(rawSummary.loan_count),
    },
    by_product: rawByProduct.map((r) => ({
      product_id: String(r.product_id ?? ''),
      product_name: String(r.product_name ?? ''),
      product_category: String(r.product_category ?? ''),
      insurance_fee_income: num(r.insurance_fee_income),
      penalty_fee_income: num(r.penalty_fee_income),
      total_fee_income: num(r.total_fee_income),
      loan_count: num(r.loan_count),
    })),
    by_month: rawByMonth.map((r) => ({
      month: String(r.month ?? ''),
      insurance_fee_income: num(r.insurance_fee_income),
      penalty_fee_income: num(r.penalty_fee_income),
      total_fee_income: num(r.total_fee_income),
      loan_count: num(r.loan_count),
    })),
  };
}
