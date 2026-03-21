import { fetchAPI } from '@lynia/api-client';

/** Safe number coercion */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductSnapshot {
  id: string;
  loan_id: string;
  product_id: string;
  snapshot_data: Record<string, unknown>;
  fineract_product_id: number | null;
  interest_rate_at_approval: number | null;
  term_months_at_approval: number | null;
  fees_at_approval: Record<string, unknown> | null;
  created_at: string;
  loan_number: string | null;
  customer_name: string | null;
  customer_id: string | null;
}

export interface SnapshotDiffField {
  field: string;
  label: string;
  at_approval: unknown;
  current: unknown;
  changed: boolean;
}

export interface SnapshotDiffResult {
  loan_id: string;
  product_id: string;
  snapshot_id: string;
  snapshot_created_at: string;
  interest_rate_at_approval: number | null;
  term_months_at_approval: number | null;
  fees_at_approval: Record<string, unknown> | null;
  changed_count: number;
  total_fields: number;
  diff: SnapshotDiffField[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getProductSnapshots(
  productId: string,
  page = 1,
  limit = 25
): Promise<{
  data: ProductSnapshot[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  return fetchAPI(`/admin/products/${productId}/snapshots?${params.toString()}`);
}

export async function getSnapshotDiff(loanId: string): Promise<SnapshotDiffResult> {
  return fetchAPI<SnapshotDiffResult>(`/admin/loans/${loanId}/snapshot-diff`);
}
