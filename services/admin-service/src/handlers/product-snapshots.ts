/**
 * Product Snapshots Handler
 *
 * Provides endpoints for viewing and comparing loan product snapshots:
 *
 * GET /admin/products/:id/snapshots
 *   Lists all snapshots for a product, ordered by created_at DESC.
 *
 * GET /admin/loans/:id/snapshot-diff
 *   Compares the snapshot taken at loan approval with the current product
 *   configuration, returning a field-by-field diff.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';

// Fields to compare between snapshot and current product
const COMPARABLE_FIELDS = [
  'product_name',
  'product_code',
  'product_type',
  'product_category',
  'status',
  'min_amount_usd',
  'max_amount_usd',
  'min_term_months',
  'max_term_months',
  'interest_rate_monthly',
  'interest_rate_annual',
  'deposit_percentage',
  'min_deposit_usd',
  'max_active_loans',
  'insurance_fee_type',
  'insurance_fee_percentage',
  'insurance_fee_flat_usd',
  'insurance_fee_frequency',
  'late_penalty_type',
  'late_penalty_percentage',
  'late_penalty_flat_usd',
  'late_penalty_grace_days',
  'fineract_product_id',
  'requires_device',
  'requires_organization_verification',
] as const;

// ---------------------------------------------------------------------------
// GET /admin/products/:id/snapshots
// ---------------------------------------------------------------------------

export const handleGetProductSnapshots: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const productId = params?.id;
  if (!productId) {
    return errorResponse('Product ID is required', 400, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(qs.page || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
  const offset = (page - 1) * limit;

  try {
    const { data: countRows } = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM loan_product_snapshots
       WHERE product_id = $1`,
      [productId]
    );
    const total = parseInt(countRows[0]?.count || '0');

    const { data: snapshots, error } = await query<{
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
    }>(
      `SELECT
         s.id,
         s.loan_id,
         s.product_id,
         s.snapshot_data,
         s.fineract_product_id,
         s.interest_rate_at_approval,
         s.term_months_at_approval,
         s.fees_at_approval,
         s.created_at,
         l.loan_number,
         CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
         c.id AS customer_id
       FROM loan_product_snapshots s
       LEFT JOIN loans l ON l.id = s.loan_id
       LEFT JOIN customers c ON c.id = l.customer_id
       WHERE s.product_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset]
    );

    if (error) {
      logger.error('Error fetching product snapshots', {
        action: 'admin.product-snapshots.list',
        status: 'failed',
        errorMessage: error.message,
      });
      return errorResponse('Failed to fetch snapshots', 500, {}, event);
    }

    return successResponse(
      { data: snapshots, total, page, limit, total_pages: Math.ceil(total / limit) },
      200,
      event
    );
  } catch (err) {
    logger.error('Unexpected error in product snapshots', {
      action: 'admin.product-snapshots.list',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Internal server error', 500, {}, event);
  }
};

// ---------------------------------------------------------------------------
// GET /admin/loans/:id/snapshot-diff
// ---------------------------------------------------------------------------

export const handleGetSnapshotDiff: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const loanId = params?.id;
  if (!loanId) {
    return errorResponse('Loan ID is required', 400, {}, event);
  }

  try {
    // Fetch the snapshot for this loan
    const { data: snapshotRows, error: snapErr } = await query<{
      id: string;
      loan_id: string;
      product_id: string;
      snapshot_data: Record<string, unknown>;
      fees_at_approval: Record<string, unknown> | null;
      interest_rate_at_approval: number | null;
      term_months_at_approval: number | null;
      created_at: string;
    }>(
      `SELECT id, loan_id, product_id, snapshot_data, fees_at_approval,
              interest_rate_at_approval, term_months_at_approval, created_at
       FROM loan_product_snapshots
       WHERE loan_id = $1`,
      [loanId]
    );

    if (snapErr) {
      return errorResponse('Failed to fetch snapshot', 500, {}, event);
    }

    if (snapshotRows.length === 0) {
      return errorResponse('No snapshot found for this loan', 404, {}, event);
    }

    const snapshot = snapshotRows[0];
    const snapshotData = snapshot.snapshot_data || {};

    // Fetch the current product
    const { data: productRows, error: prodErr } = await query<Record<string, unknown>>(
      'SELECT * FROM loan_products WHERE id = $1',
      [snapshot.product_id]
    );

    if (prodErr || productRows.length === 0) {
      return errorResponse('Current product not found', 404, {}, event);
    }

    const currentProduct = productRows[0];

    // Build field-by-field diff
    const diff = COMPARABLE_FIELDS.map((field) => {
      const atApproval = snapshotData[field] ?? null;
      const current = currentProduct[field] ?? null;
      const changed = JSON.stringify(atApproval) !== JSON.stringify(current);
      return {
        field,
        label: fieldLabel(field),
        at_approval: atApproval,
        current,
        changed,
      };
    });

    const changedCount = diff.filter((d) => d.changed).length;

    return successResponse(
      {
        loan_id: loanId,
        product_id: snapshot.product_id,
        snapshot_id: snapshot.id,
        snapshot_created_at: snapshot.created_at,
        interest_rate_at_approval: snapshot.interest_rate_at_approval,
        term_months_at_approval: snapshot.term_months_at_approval,
        fees_at_approval: snapshot.fees_at_approval,
        changed_count: changedCount,
        total_fields: diff.length,
        diff,
      },
      200,
      event
    );
  } catch (err) {
    logger.error('Unexpected error in snapshot diff', {
      action: 'admin.snapshot-diff',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Internal server error', 500, {}, event);
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    product_name: 'Product Name',
    product_code: 'Product Code',
    product_type: 'Product Type',
    product_category: 'Category',
    status: 'Status',
    min_amount_usd: 'Min Amount (USD)',
    max_amount_usd: 'Max Amount (USD)',
    min_term_months: 'Min Term (months)',
    max_term_months: 'Max Term (months)',
    interest_rate_monthly: 'Monthly Interest Rate',
    interest_rate_annual: 'Annual Interest Rate',
    deposit_percentage: 'Deposit %',
    min_deposit_usd: 'Min Deposit (USD)',
    max_active_loans: 'Max Active Loans',
    insurance_fee_type: 'Insurance Fee Type',
    insurance_fee_percentage: 'Insurance Fee %',
    insurance_fee_flat_usd: 'Insurance Fee Flat (USD)',
    insurance_fee_frequency: 'Insurance Fee Frequency',
    late_penalty_type: 'Late Penalty Type',
    late_penalty_percentage: 'Late Penalty %',
    late_penalty_flat_usd: 'Late Penalty Flat (USD)',
    late_penalty_grace_days: 'Late Penalty Grace Days',
    fineract_product_id: 'Core Banking Product ID',
    requires_device: 'Requires Device',
    requires_organization_verification: 'Requires Org Verification',
  };
  return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
