/**
 * Product Configuration Versioning
 *
 * Records every change to loan product configurations for audit trail
 * and regulatory compliance. Each version captures before/after state.
 */

import { query } from '../clients/database';
import logger from './logger';

export interface CreateProductVersionParams {
  productId: string;
  changedBy: string;
  changeType: 'create' | 'update' | 'deactivate' | 'reactivate';
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown>;
  changeReason?: string;
}

export interface ProductVersion {
  id: string;
  product_id: string;
  version_number: number;
  changed_by: string;
  changed_at: string;
  change_type: string;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown>;
  change_reason: string | null;
  created_at: string;
}

/**
 * Create a new version record for a product change.
 * Auto-increments version_number per product.
 */
export async function createProductVersion(
  params: CreateProductVersionParams
): Promise<void> {
  const { productId, changedBy, changeType, previousValues, newValues, changeReason } = params;

  // Get next version number for this product
  const { data: versionRows } = await query<{ max_version: number | null }>(
    'SELECT MAX(version_number) as max_version FROM product_versions WHERE product_id = $1',
    [productId]
  );
  const nextVersion = (versionRows[0]?.max_version ?? 0) + 1;

  await query(
    `INSERT INTO product_versions
       (product_id, version_number, changed_by, change_type, previous_values, new_values, change_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      productId,
      nextVersion,
      changedBy,
      changeType,
      previousValues ? JSON.stringify(previousValues) : null,
      JSON.stringify(newValues),
      changeReason || null,
    ]
  );

  logger.info('Product version recorded', {
    action: 'product.version.create',
    status: 'completed',
    metadata: {
      productId,
      versionNumber: nextVersion,
      changeType,
      changedBy,
    },
  });
}

/**
 * Retrieve the full version history for a product, newest first.
 */
export async function getProductVersions(
  productId: string
): Promise<ProductVersion[]> {
  const { data, error } = await query<ProductVersion>(
    `SELECT id, product_id, version_number, changed_by, changed_at, change_type,
            previous_values, new_values, change_reason, created_at
     FROM product_versions
     WHERE product_id = $1
     ORDER BY version_number DESC`,
    [productId]
  );

  if (error) {
    logger.error('Failed to fetch product versions', {
      action: 'product.version.getAll',
      status: 'failed',
      errorMessage: error.message,
      metadata: { productId },
    });
    return [];
  }

  return data;
}
