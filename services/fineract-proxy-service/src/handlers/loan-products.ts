/**
 * Loan Product Handlers
 *
 * CRUD endpoints for Fineract loan product management.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient } from '../../../shared/clients/fineract';
import { db } from '../../../shared/clients/database';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
import type { FineractLoanProductCreateRequest } from '../../../shared/types/fineract';
import { ok, err } from './helpers';

// ============================================================
// GET /api/v1/fineract/loan-products
// ============================================================

export async function handleGetLoanProducts(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const fineract = await getFineractClient();
  const products = await fineract.listLoanProducts();

  const mapped = products.map((p) => ({
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
  }));

  return ok(mapped, event);
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

  // Fetch the Lynia loan product
  const { data: product } = await db.from('loan_products')
    .select('*')
    .eq('id', lynia_product_id)
    .is('deleted_at', null)
    .maybeSingle()
    .execute();

  if (!product) {
    return err(404, 'Lynia loan product not found', event);
  }

  if (product.fineract_product_id) {
    return err(409, `Product already linked to Fineract product ID ${product.fineract_product_id}`, event);
  }

  // Map Lynia product fields to Fineract product create request
  const shortName = (product.product_code as string).substring(0, 4).toUpperCase();
  const maxRepayments = product.max_term_months as number;
  const minRepayments = product.min_term_months as number;

  const fineractPayload: FineractLoanProductCreateRequest = {
    name: `Lynia - ${product.product_name}`,
    shortName,
    description: (product.description as string) || `Auto-created from Lynia product ${product.product_code}`,
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    inMultiplesOf: 1,
    principal: Math.round(((product.min_amount_usd as number) + (product.max_amount_usd as number)) / 2),
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
    await db.from('loan_products')
      .update({
        fineract_product_id: result.resourceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lynia_product_id)
      .execute();

    return ok({
      message: 'Fineract product created and linked',
      fineract_product_id: result.resourceId,
      lynia_product_id,
    }, event);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return err(500, `Failed to create Fineract product: ${message}`, event);
  }
}
