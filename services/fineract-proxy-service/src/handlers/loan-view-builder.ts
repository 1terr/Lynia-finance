/**
 * Loan View Builder
 *
 * Constructs the FineractLoanView response objects by merging data
 * from the Lynia PostgreSQL database and the Fineract API.
 */

import { getFineractClient } from '../../../shared/clients/fineract';
import { db } from '../../../shared/clients/database';
import type {
  FineractLoan,
  FineractRepaymentPeriod,
} from '../../../shared/types/fineract';
import { fmtDate, CustomerRow, LyniaLoanRow } from './helpers';

// ============================================================
// CUSTOMER MAP
// ============================================================

/** Batch-fetch customer names by ID list */
export async function getCustomerMap(customerIds: string[]): Promise<Map<string, CustomerRow>> {
  const map = new Map<string, CustomerRow>();
  if (customerIds.length === 0) return map;

  const { data } = await db
    .from('customers')
    .select('id, first_name, last_name, phone_number, fineract_client_id')
    .in('id', customerIds)
    .execute();

  if (data) {
    for (const row of data as unknown as CustomerRow[]) {
      map.set(row.id, row);
    }
  }

  return map;
}

// ============================================================
// LOAN VIEW BUILDERS
// ============================================================

/** Build a FineractLoanView by querying Fineract for the loan data */
export async function buildLoanView(
  loan: LyniaLoanRow,
  customer: CustomerRow | null,
  fineract: Awaited<ReturnType<typeof getFineractClient>>
): Promise<Record<string, unknown>> {
  let fLoan: FineractLoan | null = null;
  if (loan.fineract_loan_id) {
    try {
      fLoan = await fineract.getLoan(loan.fineract_loan_id);
    } catch {
      // Fineract unavailable -- use Lynia DB data only
    }
  }
  return buildLoanViewFromFineract(loan, customer, fLoan);
}

/** Build a FineractLoanView from Lynia loan + optional Fineract data */
export function buildLoanViewFromFineract(
  loan: LyniaLoanRow,
  customer: CustomerRow | null,
  fLoan: FineractLoan | null
): Record<string, unknown> {
  const s = fLoan?.summary;
  const tl = fLoan?.timeline;

  return {
    lyniaLoanId: loan.id,
    lyniaCustomerId: loan.customer_id,
    customerName: customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown',
    customerPhone: customer?.phone_number || '',
    fineractLoanId: fLoan?.id ?? loan.fineract_loan_id ?? 0,
    fineractAccountNo: fLoan?.accountNo ?? loan.loan_number ?? '',
    fineractClientId: fLoan?.clientId ?? customer?.fineract_client_id ?? 0,
    productName: fLoan?.loanProductName ?? '',
    productId: fLoan?.loanProductId ?? loan.fineract_product_id ?? 0,
    principal: fLoan?.principal?.amount ?? loan.outstanding_balance_usd ?? 0,
    approvedPrincipal: fLoan?.approvedPrincipal?.amount ?? 0,
    currency: fLoan?.currency
      ? {
          code: fLoan.currency.code,
          name: fLoan.currency.name,
          decimalPlaces: fLoan.currency.decimalPlaces,
          displaySymbol: fLoan.currency.displaySymbol,
          displayLabel: fLoan.currency.displayLabel,
        }
      : { code: 'USD', name: 'US Dollar', decimalPlaces: 2, displaySymbol: '$', displayLabel: 'US Dollar ($)' },
    numberOfRepayments: fLoan?.numberOfRepayments ?? 0,
    repaymentEvery: fLoan?.repaymentEvery ?? 0,
    repaymentFrequency: fLoan?.repaymentFrequencyType?.value ?? 'Months',
    interestRatePerPeriod: fLoan?.interestRatePerPeriod ?? 0,
    annualInterestRate: fLoan?.annualInterestRate ?? 0,
    interestType: fLoan?.interestType?.value ?? '',
    amortizationType: fLoan?.amortizationType?.value ?? '',
    status: fLoan?.status ?? { id: 0, code: 'loanStatusType.active', value: loan.status },
    submittedOnDate: fmtDate(tl?.submittedOnDate ?? null),
    approvedOnDate: fmtDate(tl?.approvedOnDate ?? null),
    expectedDisbursementDate: fmtDate(tl?.expectedDisbursementDate ?? null),
    actualDisbursementDate: fmtDate(tl?.actualDisbursementDate ?? null),
    expectedMaturityDate: fmtDate(tl?.expectedMaturityDate ?? null),
    closedOnDate: fmtDate(tl?.closedOnDate ?? null),
    principalDisbursed: s?.principalDisbursed ?? 0,
    principalPaid: s?.principalPaid ?? 0,
    principalOutstanding: s?.principalOutstanding ?? loan.outstanding_balance_usd ?? 0,
    principalOverdue: s?.principalOverdue ?? 0,
    interestCharged: s?.interestCharged ?? 0,
    interestPaid: s?.interestPaid ?? 0,
    interestOutstanding: s?.interestOutstanding ?? 0,
    interestOverdue: s?.interestOverdue ?? 0,
    feeChargesCharged: s?.feeChargesCharged ?? 0,
    feeChargesPaid: s?.feeChargesPaid ?? 0,
    feeChargesOutstanding: s?.feeChargesOutstanding ?? 0,
    penaltyChargesCharged: s?.penaltyChargesCharged ?? 0,
    penaltyChargesPaid: s?.penaltyChargesPaid ?? 0,
    penaltyChargesOutstanding: s?.penaltyChargesOutstanding ?? 0,
    totalExpectedRepayment: s?.totalExpectedRepayment ?? 0,
    totalRepayment: s?.totalRepayment ?? loan.total_paid_usd ?? 0,
    totalOutstanding: s?.totalOutstanding ?? loan.outstanding_balance_usd ?? 0,
    totalOverdue: s?.totalOverdue ?? 0,
    overdueSinceDate: fmtDate(s?.overdueSinceDate ?? null),
    deviceBrand: null,
    deviceModel: null,
    deviceImei: null,
  };
}

// ============================================================
// REPAYMENT PERIOD MAPPER
// ============================================================

export function mapRepaymentPeriod(p: FineractRepaymentPeriod) {
  return {
    period: p.period,
    fromDate: fmtDate(p.fromDate) || '',
    dueDate: fmtDate(p.dueDate) || '',
    paidDate: fmtDate(p.obligationsMetOnDate ?? null),
    complete: p.complete,
    daysInPeriod: p.daysInPeriod,
    principalDue: p.principalDue,
    principalPaid: p.principalPaid,
    principalOutstanding: p.principalOutstanding,
    interestDue: p.interestDue,
    interestPaid: p.interestPaid,
    interestOutstanding: p.interestOutstanding,
    feeChargesDue: p.feeChargesDue,
    feeChargesPaid: p.feeChargesPaid,
    penaltyChargesDue: p.penaltyChargesDue,
    penaltyChargesPaid: p.penaltyChargesPaid,
    totalDue: p.totalDueForPeriod,
    totalPaid: p.totalPaidForPeriod,
    totalOutstanding: p.totalOutstandingForPeriod,
    totalOverdue: p.totalOutstandingForPeriod, // Fineract doesn't separate overdue from outstanding per period
    balanceOfLoan: p.principalLoanBalanceOutstanding,
  };
}
