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
  fineract_status?: number;
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

  const fineract = await getFineractClient();
  const expectedName = `Lynia - ${product.product_name}`;

  // Recovery: check if a product was created in Fineract but linkage failed
  // (e.g. Lambda was killed by timeout after Fineract accepted the request)
  try {
    const existingProducts = await fineract.listLoanProducts();
    const existing = existingProducts.find((p) => p.name === expectedName);

    if (existing) {
      await db
        .from('loan_products')
        .update({
          fineract_product_id: existing.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lyniaProductId)
        .execute();

      await logSync({
        entity_type: 'loan_product',
        entity_id: lyniaProductId,
        fineract_id: existing.id,
        operation: 'link_existing',
        direction: 'outbound',
        status: 'success',
        request_payload: null,
        response_payload: { recovered: true, fineract_id: existing.id },
        duration_ms: Date.now() - startTime,
      });

      console.log(
        `[fineract-sync] Recovered orphaned link: ${lyniaProductId} -> Fineract product ${existing.id}`
      );

      return { success: true, fineract_product_id: existing.id };
    }
  } catch (listError) {
    // Non-fatal — proceed to create if listing fails
    console.warn('[fineract-sync] Could not check for existing products:', listError);
  }

  // Map Lynia product fields to Fineract product create request
  // Generate unique 4-char shortName: first 2 chars + last 2 chars of alphanumeric code
  const rawCode = (product.product_code as string).replace(/[^A-Za-z0-9]/g, '');
  const shortName = rawCode.length <= 4
    ? rawCode.toUpperCase()
    : (rawCode.substring(0, 2) + rawCode.slice(-2)).toUpperCase();
  const maxRepayments = (product.max_term_months as number) || (product.loan_term_months as number) || 12;
  const minRepayments = (product.min_term_months as number) || 1;
  const interestRate = (product.interest_rate_monthly as number) ?? ((product.interest_rate_annual as number) / 12);

  const fineractPayload: FineractLoanProductCreateRequest = {
    name: expectedName,
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
    interestRatePerPeriod: interestRate,
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

    return { success: false, error: errorMessage, fineract_status: apiError?.statusCode };
  }
}
