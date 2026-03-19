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
import type { FineractLoanProductCreateRequest, FineractLoanProduct } from '../../types/fineract';

export interface SyncProductResult {
  success: boolean;
  fineract_product_id?: number;
  error?: string;
  fineract_status?: number;
  error_details?: { validation_errors?: Array<{ field: string; message: string }> };
}

/**
 * Generate a unique 4-char Fineract shortName that does not collide with
 * any existing product shortNames. Tries several derivation strategies
 * before falling back to numeric suffixes.
 */
export function generateUniqueShortName(productCode: string, takenShortNames: Set<string>): string {
  const code = productCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().padEnd(4, 'X');

  const candidates: string[] = [];
  if (code.length <= 4) {
    candidates.push(code);
  } else {
    candidates.push(
      code.substring(0, 2) + code.slice(-2),  // first2+last2 (original algo)
      code.substring(0, 3) + code.slice(-1),  // first3+last1
      code.substring(0, 1) + code.slice(-3),  // first1+last3
      code.substring(0, 4),                    // first4
      code.slice(-4),                          // last4
    );
  }

  for (const c of candidates) {
    if (!takenShortNames.has(c)) return c;
  }

  // Numeric suffix fallback: 3-char base + digit (0-9)
  const base3 = code.substring(0, 3);
  for (let i = 0; i <= 9; i++) {
    const c = `${base3}${i}`;
    if (!takenShortNames.has(c)) return c;
  }

  // 2-char base + 2 digits (00-99)
  const base2 = code.substring(0, 2);
  for (let i = 0; i <= 99; i++) {
    const c = `${base2}${String(i).padStart(2, '0')}`;
    if (!takenShortNames.has(c)) return c;
  }

  throw new Error(`Cannot generate unique shortName for product code "${productCode}"`);
}

/**
 * Sync a Lynia loan product to Fineract.
 *
 * - If the product already has a fineract_product_id, returns early (already synced).
 * - Lists existing Fineract products for orphan recovery AND shortName dedup.
 * - Maps Lynia fields to Fineract loan product format.
 * - Creates the product in Fineract and links it back in the DB.
 * - Logs the sync operation.
 *
 * @param lyniaProductId - UUID of the Lynia loan product
 * @returns Result with fineract_product_id on success, or error message on failure
 */
export async function syncProductToFineract(lyniaProductId: string): Promise<SyncProductResult> {
  const startTime = Date.now();

  try {
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

  // Fetch existing Fineract products (used for both orphan recovery AND shortName dedup)
  let existingProducts: FineractLoanProduct[] = [];
  try {
    existingProducts = await fineract.listLoanProducts();
  } catch (listError) {
    // Non-fatal — proceed to create (shortName dedup won't work but creation may still succeed)
    console.warn('[fineract-sync] Could not list existing products:', listError);
  }

  // Orphan recovery: check if a product was created in Fineract but linkage failed
  // (e.g. Lambda was killed by timeout after Fineract accepted the request)
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

  // Map Lynia product fields to Fineract product create request
  // Generate collision-safe 4-char shortName by checking existing Fineract products
  const takenShortNames = new Set(existingProducts.map((p) => p.shortName.toUpperCase()));
  const shortName = generateUniqueShortName(product.product_code as string, takenShortNames);

  // Null-safe numeric extraction with sensible defaults
  // (interest_rate_monthly was added in migration 028 with no default — can be null)
  const rawMonthly = product.interest_rate_monthly as number | null;
  const rawAnnual = product.interest_rate_annual as number | null;
  const interestRate =
    rawMonthly != null && Number.isFinite(rawMonthly) ? rawMonthly
    : rawAnnual != null && Number.isFinite(rawAnnual) ? rawAnnual / 12
    : 1.0; // safe default: 1% per month = 12% annual

  const minAmount = Number.isFinite(product.min_amount_usd as number) ? (product.min_amount_usd as number) : 50;
  const maxAmount = Number.isFinite(product.max_amount_usd as number) ? (product.max_amount_usd as number) : 500;
  const maxRepayments =
    Number.isFinite(product.max_term_months as number) ? (product.max_term_months as number)
    : Number.isFinite(product.loan_term_months as number) ? (product.loan_term_months as number)
    : 12;
  const minRepayments = Number.isFinite(product.min_term_months as number) ? (product.min_term_months as number) : 1;

  const fineractPayload: FineractLoanProductCreateRequest = {
    name: expectedName,
    shortName,
    description:
      (product.description as string) ||
      `Auto-created from Lynia product ${product.product_code}`,
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    inMultiplesOf: 1,
    principal: Math.round((minAmount + maxAmount) / 2),
    minPrincipal: minAmount,
    maxPrincipal: maxAmount,
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

  // Guard against NaN/Infinity in the payload before sending to Fineract
  for (const [key, value] of Object.entries(fineractPayload)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return {
        success: false,
        error: `Invalid numeric value for field "${key}" (got ${value}). Check product data in Lynia DB.`,
      };
    }
  }

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
    const validationErrors = apiError?.errorBody?.errors?.map((e) => ({
      field: e.parameterName,
      message: e.defaultUserMessage,
    }));

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

    return {
      success: false,
      error: errorMessage,
      fineract_status: apiError?.statusCode,
      error_details: validationErrors?.length ? { validation_errors: validationErrors } : undefined,
    };
  }

  } catch (outerError) {
    // Master catch-all: DB errors, config failures, generateUniqueShortName, logSync, etc.
    const errorMessage = outerError instanceof Error ? outerError.message : String(outerError);
    console.error(`[fineract-sync] Unexpected error syncing product ${lyniaProductId}:`, outerError);
    return { success: false, error: errorMessage };
  }
}
