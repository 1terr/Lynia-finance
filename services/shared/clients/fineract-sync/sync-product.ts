/**
 * Product Sync Module
 *
 * Creates a Fineract loan product from a Lynia loan product and links them
 * via fineract_product_id. Used by both the admin service (auto-sync on
 * create/update) and the fineract-proxy service (manual sync endpoint).
 */

import { getFineractClient, FineractApiError } from '../fineract';
import { db } from '../database';
import { logSync, queueSyncRetry } from './sync-scheduler';
import type { FineractLoanProductCreateRequest } from '../../types/fineract';

export interface SyncProductResult {
  success: boolean;
  fineract_product_id?: number;
  error?: string;
}

/**
 * Sync a Lynia loan product to Fineract.
 *
 * - If the product already has a fineract_product_id, returns early (already synced).
 * - Maps Lynia fields to Fineract loan product format.
 * - Creates the product in Fineract and links it back in the DB.
 * - Logs the sync operation.
 *
 * @param lyniaProductId - UUID of the Lynia loan product
 * @returns Result with fineract_product_id on success, or error message on failure
 */
export async function syncProductToFineract(lyniaProductId: string): Promise<SyncProductResult> {
  const startTime = Date.now();

  // Fetch the Lynia loan product
  const { data: product } = await db
    .from('loan_products')
    .select('*')
    .eq('id', lyniaProductId)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!product) {
    return { success: false, error: 'Lynia loan product not found' };
  }

  // Already synced — return early
  if (product.fineract_product_id) {
    return {
      success: true,
      fineract_product_id: product.fineract_product_id as number,
    };
  }

  // Map Lynia product fields to Fineract product create request
  const shortName = (product.product_code as string).substring(0, 4).toUpperCase();
  const maxRepayments = product.max_term_months as number;
  const minRepayments = product.min_term_months as number;

  const fineractPayload: FineractLoanProductCreateRequest = {
    name: `Lynia - ${product.product_name}`,
    shortName,
    description:
      (product.description as string) ||
      `Auto-created from Lynia product ${product.product_code}`,
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    inMultiplesOf: 1,
    principal: Math.round(
      ((product.min_amount_usd as number) + (product.max_amount_usd as number)) / 2
    ),
    minPrincipal: product.min_amount_usd as number,
    maxPrincipal: product.max_amount_usd as number,
    numberOfRepayments: maxRepayments,
    minNumberOfRepayments: minRepayments,
    maxNumberOfRepayments: maxRepayments,
    repaymentEvery: 1,
    repaymentFrequencyType: 2, // months
    interestRatePerPeriod: product.interest_rate_monthly as number,
    interestRateFrequencyType: 2, // per month
    amortizationType: 0, // equal installments
    interestType: 0, // declining balance
    interestCalculationPeriodType: 1, // same as repayment period
    transactionProcessingStrategyCode: 'mifos-standard-strategy',
    locale: 'en',
    dateFormat: 'dd MMMM yyyy',
    accountingRule: 1, // none (simplest setup)
  };

  try {
    const fineract = await getFineractClient();
    const result = await fineract.createLoanProduct(fineractPayload);

    // Link the Fineract product back to Lynia
    await db
      .from('loan_products')
      .update({
        fineract_product_id: result.resourceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lyniaProductId)
      .execute();

    await logSync({
      entity_type: 'loan_product',
      entity_id: lyniaProductId,
      fineract_id: result.resourceId,
      operation: 'create',
      direction: 'outbound',
      status: 'success',
      request_payload: fineractPayload,
      response_payload: result,
      duration_ms: Date.now() - startTime,
    });

    console.log(
      `[fineract-sync] Product ${lyniaProductId} -> Fineract product ${result.resourceId}`
    );

    return { success: true, fineract_product_id: result.resourceId };
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await logSync({
      entity_type: 'loan_product',
      entity_id: lyniaProductId,
      operation: 'create',
      direction: 'outbound',
      status: 'failed',
      request_payload: fineractPayload,
      error_message: errorMessage,
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to sync product ${lyniaProductId}:`, error);

    await queueSyncRetry({
      entityType: 'loan_product',
      entityId: lyniaProductId,
      operation: 'create',
      requestPayload: fineractPayload as unknown as Record<string, unknown>,
      errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}
