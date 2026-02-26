/**
 * Loan Product Handlers
 *
 * GET endpoints for Fineract loan product listing and detail.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient } from '../../../shared/clients/fineract';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
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
