/**
 * Creates an immutable snapshot of loan product terms at loan approval time.
 * Required for regulatory compliance - proves what terms were offered to the customer.
 */
import { Pool } from 'pg';

export async function createProductSnapshot(
  pool: Pool,
  loanId: string,
  productId: string
): Promise<void> {
  const result = await pool.query('SELECT * FROM loan_products WHERE id = $1', [productId]);
  const product = result.rows[0];

  if (!product) {
    throw new Error(`Cannot create snapshot: product ${productId} not found`);
  }

  await pool.query(
    `INSERT INTO loan_product_snapshots
       (loan_id, product_id, snapshot_data, fineract_product_id,
        interest_rate_at_approval, term_months_at_approval, fees_at_approval)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      loanId,
      productId,
      JSON.stringify(product),
      product.fineract_product_id,
      product.interest_rate_annual,
      product.loan_term_months,
      JSON.stringify({
        insurance: {
          type: product.insurance_fee_type || 'none',
          percentage: product.insurance_fee_percentage || 0,
          flat_usd: product.insurance_fee_flat_usd || 0,
          frequency: product.insurance_fee_frequency || 'upfront',
        },
        penalty: {
          type: product.late_penalty_type || 'none',
          percentage: product.late_penalty_percentage || 0,
          flat_usd: product.late_penalty_flat_usd || 0,
          grace_days: product.late_penalty_grace_days || 3,
        },
      }),
    ]
  );
}

export async function getProductSnapshot(
  pool: Pool,
  loanId: string
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    'SELECT snapshot_data FROM loan_product_snapshots WHERE loan_id = $1',
    [loanId]
  );
  return result.rows[0]?.snapshot_data || null;
}
