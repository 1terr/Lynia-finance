/**
 * Loan Product Handlers
 *
 * CRUD endpoints for Fineract loan product management.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient } from '../../../shared/clients/fineract';
import { db } from '../../../shared/clients/database';
import { syncProductToFineract } from '../../../shared/clients/fineract-sync';
import type { SyncProductResult } from '../../../shared/clients/fineract-sync/sync-product';
import { CircuitOpenError } from '../../../shared/utils/circuit-breaker';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
import { ok, err } from './helpers';

/**
 * Map a failed SyncProductResult to the appropriate HTTP status code.
 * Prevents collapsing all failures into a generic 500.
 */
function mapSyncErrorStatus(result: SyncProductResult): number {
  const fs = result.fineract_status;

  // Fineract returned a 4xx — client/validation error, pass through
  if (fs !== undefined && fs >= 400 && fs < 500) return fs;

  // Fineract returned 5xx or connection failed (status 0) — upstream failure
  if (fs !== undefined && (fs >= 500 || fs === 0)) return 502;

  // No fineract_status — error happened before reaching Fineract
  const errorLower = (result.error || '').toLowerCase();
  if (errorLower.includes('not found')) return 404;
  if (errorLower.includes('circuit') || errorLower.includes('unavailable')) return 503;

  return 500;
}

/**
 * Build a user-friendly error message from sync result.
 */
function buildSyncErrorMessage(result: SyncProductResult): string {
  if (result.fineract_status === 0) {
    return 'Cannot reach Fineract core banking service. Check if Fineract ECS is running.';
  }
  if (result.fineract_status !== undefined && result.fineract_status >= 500) {
    return `Fineract server error (${result.fineract_status}). The core banking service may be experiencing issues.`;
  }
  return result.error || 'Failed to create Fineract product';
}

// ============================================================
// GET /api/v1/fineract/loan-products
// ============================================================

export async function handleGetLoanProducts(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  // Try Fineract first, fall back to Lynia products if unreachable
  let fineractProducts: Array<Record<string, unknown>> | null = null;

  try {
    const fineract = await getFineractClient();
    const products = await fineract.listLoanProducts();

    // Fetch Lynia loan products linked to Fineract for enrichment
    const fineractIds = products.map((p) => p.id);
    let lyniaEnrichment: Array<{
      fineract_product_id: number;
      deposit_percentage: number | null;
      min_term_months: number | null;
      max_term_months: number | null;
    }> = [];

    if (fineractIds.length > 0) {
      const { data } = await db
        .from('loan_products')
        .select('fineract_product_id, deposit_percentage, min_term_months, max_term_months')
        .in('fineract_product_id', fineractIds)
        .is('deleted_at', null)
        .execute();
      lyniaEnrichment = data || [];
    }

    const lyniaByFineractId = new Map(
      lyniaEnrichment.map((lp) => [lp.fineract_product_id, lp])
    );

    fineractProducts = products.map((p) => {
      const lynia = lyniaByFineractId.get(p.id);

      return {
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        description: p.description || '',
        currency: {
          code: p.currency.code,
          name: p.currency.name,
          decimalPlaces: p.currency.decimalPlaces,
          displaySymbol: p.currency.displaySymbol,
          displayLabel: p.currency.displayLabel,
        },
        principal: p.principal,
        minPrincipal: p.minPrincipal,
        maxPrincipal: p.maxPrincipal,
        numberOfRepayments: p.numberOfRepayments,
        minNumberOfRepayments: lynia?.min_term_months ?? undefined,
        maxNumberOfRepayments: lynia?.max_term_months ?? undefined,
        repaymentEvery: p.repaymentEvery,
        repaymentFrequency: p.repaymentFrequencyType?.value || 'Months',
        interestRatePerPeriod: p.interestRatePerPeriod,
        annualInterestRate: p.annualInterestRate,
        interestType: p.interestType?.value || 'Declining Balance',
        amortizationType: p.amortizationType?.value || 'Equal Installments',
        accountingRule: p.accountingRule?.value || 'None',
        accountingMappings: p.accountingMappings,
        minCreditScore: lynia?.min_credit_score ?? undefined,
        maxCreditScore: lynia?.max_credit_score ?? undefined,
        productCategory: lynia?.product_category ?? 'smartphone',
        downPaymentPercentage: lynia?.deposit_percentage ?? undefined,
        source: 'fineract',
      };
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.warn('Fineract unreachable, falling back to Lynia products:', message);
  }

  // If Fineract returned products, use them
  if (fineractProducts && fineractProducts.length > 0) {
    return ok(fineractProducts, event);
  }

  // Fallback: return Lynia loan products formatted for the tier view
  try {
    const { data: lyniaProducts } = await db
      .from('loan_products')
      .select('*')
      .is('deleted_at', null)
      .execute();

    const mapped = (lyniaProducts || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.product_name as string,
      shortName: ((p.product_code as string) || '').substring(0, 4),
      description: (p.description as string) || '',
      currency: { code: 'USD', name: 'US Dollar', decimalPlaces: 2, displaySymbol: '$', displayLabel: 'US Dollar ($)' },
      principal: Math.round((((p.min_amount_usd as number) || 0) + ((p.max_amount_usd as number) || 0)) / 2),
      minPrincipal: (p.min_amount_usd as number) || 0,
      maxPrincipal: (p.max_amount_usd as number) || 0,
      numberOfRepayments: (p.loan_term_months as number) || 6,
      minNumberOfRepayments: (p.min_term_months as number) || undefined,
      maxNumberOfRepayments: (p.max_term_months as number) || undefined,
      repaymentEvery: 1,
      repaymentFrequency: 'Months',
      interestRatePerPeriod: (p.interest_rate_monthly as number) || ((p.interest_rate_annual as number) || 12) / 12,
      annualInterestRate: (p.interest_rate_annual as number) || 12,
      interestType: 'Declining Balance',
      amortizationType: 'Equal Installments',
      accountingRule: 'None',
      minCreditScore: (p.min_credit_score as number) ?? undefined,
      maxCreditScore: (p.max_credit_score as number) ?? undefined,
      productCategory: (p.product_category as string) ?? 'smartphone',
      downPaymentPercentage: (p.deposit_percentage as number) || undefined,
      source: 'lynia',
    }));

    return ok(mapped, event);
  } catch (dbErr: unknown) {
    const message = dbErr instanceof Error ? dbErr.message : 'Unknown error';
    console.error('Failed to fetch Lynia loan products fallback:', message);
    return err(502, `Unable to load loan products: ${message}`, event);
  }
}

// ============================================================
// GET /api/v1/fineract/loan-products/:id
// ============================================================

export async function handleGetLoanProduct(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const productId = parseInt(params.id, 10);
  const fineract = await getFineractClient();

  try {
    const p = await fineract.getLoanProduct(productId);
    return ok(
      {
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        description: p.description || '',
        currency: {
          code: p.currency.code,
          name: p.currency.name,
          decimalPlaces: p.currency.decimalPlaces,
          displaySymbol: p.currency.displaySymbol,
          displayLabel: p.currency.displayLabel,
        },
        principal: p.principal,
        minPrincipal: p.minPrincipal,
        maxPrincipal: p.maxPrincipal,
        numberOfRepayments: p.numberOfRepayments,
        repaymentEvery: p.repaymentEvery,
        repaymentFrequency: p.repaymentFrequencyType?.value || 'Months',
        interestRatePerPeriod: p.interestRatePerPeriod,
        annualInterestRate: p.annualInterestRate,
        interestType: p.interestType?.value || 'Declining Balance',
        amortizationType: p.amortizationType?.value || 'Equal Installments',
        accountingRule: p.accountingRule?.value || 'None',
        accountingMappings: p.accountingMappings,
      },
      event
    );
  } catch {
    return err(404, 'Loan product not found', event);
  }
}

// ============================================================
// POST /api/v1/fineract/loan-products/create-from-lynia
// Creates a Fineract loan product from a Lynia loan product
// and links them via fineract_product_id.
// ============================================================

export async function handleCreateFineractProduct(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { lynia_product_id } = body;

  if (!lynia_product_id) {
    return err(400, 'lynia_product_id is required', event);
  }

  // Pre-flight: fast-fail if Fineract circuit breaker is open
  try {
    const fineract = await getFineractClient();
    const circuitState = fineract.getCircuitState();
    if (circuitState === 'OPEN') {
      return err(503, 'Fineract service temporarily unavailable (circuit breaker open). Retry in ~60 seconds.', event);
    }
  } catch {
    // Config/init failure — let syncProductToFineract handle it with full error logging
  }

  let result: SyncProductResult;
  try {
    result = await syncProductToFineract(lynia_product_id);
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      return err(503, 'Fineract service temporarily unavailable (circuit breaker open). Retry in ~60 seconds.', event);
    }
    const msg = error instanceof Error ? error.message : 'Unexpected sync error';
    return err(502, msg, event);
  }

  if (!result.success) {
    const statusCode = mapSyncErrorStatus(result);
    const message = buildSyncErrorMessage(result);
    return err(statusCode, message, event, result.error_details);
  }

  return ok({
    message: 'Fineract product created and linked',
    fineract_product_id: result.fineract_product_id,
    lynia_product_id,
  }, event);
}
