/**
 * Payment Plans & Loan Restructuring Service (P3-T019)
 *
 * Features:
 *  - Payment plan modification (extend term, reduce amount)
 *  - Loan restructuring for delinquent accounts
 *  - Early payoff calculation with interest savings
 *  - Payment holiday requests
 *  - Hardship program enrollment
 *  - Restructuring approval workflow
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type RestructureType =
  | 'term_extension'
  | 'payment_reduction'
  | 'payment_holiday'
  | 'hardship'
  | 'early_payoff';

export type RestructureStatus =
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'completed';

export interface RestructureRequest {
  loan_id: string;
  customer_id: string;
  type: RestructureType;
  reason: string;
  current_terms: LoanTerms;
  proposed_terms: LoanTerms;
  status: RestructureStatus;
  reviewed_by?: string;
  reviewed_at?: Date;
}

export interface LoanTerms {
  monthly_amount: number;
  term_months: number;
  interest_rate_apr: number;
  remaining_balance: number;
  total_payable: number;
}

export interface EarlyPayoffQuote {
  loan_id: string;
  outstanding_principal: number;
  accrued_interest: number;
  payoff_amount: number;
  interest_saved: number;
  valid_until: Date;
}

// ===================================================================
// EARLY PAYOFF
// ===================================================================

/**
 * Calculate early payoff amount (no penalties per CLAUDE.md)
 */
export async function calculateEarlyPayoff(loanId: string): Promise<EarlyPayoffQuote> {
  const { data: loan } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (!loan) throw new Error('Loan not found');

  const outstandingPrincipal = (loan.total_amount_due || 0) - (loan.total_amount_paid || 0);
  const remainingMonths = (loan.term_months || 6) - (loan.payments_made || 0);

  // Calculate remaining interest (simple method)
  const monthlyRate = (loan.interest_rate_apr || 12) / 100 / 12;
  const futureInterest = outstandingPrincipal * monthlyRate * remainingMonths;

  // No early repayment penalties
  const payoffAmount = outstandingPrincipal;
  const interestSaved = futureInterest;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7);

  const quote: EarlyPayoffQuote = {
    loan_id: loanId,
    outstanding_principal: outstandingPrincipal,
    accrued_interest: 0,
    payoff_amount: Math.round(payoffAmount * 100) / 100,
    interest_saved: Math.round(interestSaved * 100) / 100,
    valid_until: validUntil,
  };

  // Store quote
  await supabase.from('early_payoff_quotes').insert({
    ...quote,
    created_at: new Date(),
  });

  return quote;
}

// ===================================================================
// TERM EXTENSION
// ===================================================================

/**
 * Request a term extension (add 1-3 months)
 */
export async function requestTermExtension(
  loanId: string,
  additionalMonths: number,
  reason: string
): Promise<RestructureRequest> {
  if (additionalMonths < 1 || additionalMonths > 3) {
    throw new Error('Extension must be 1-3 months');
  }

  const { data: loan } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (!loan) throw new Error('Loan not found');

  const remaining = (loan.total_amount_due || 0) - (loan.total_amount_paid || 0);
  const currentMonthly = loan.monthly_installment_amount || 0;
  const newTermMonths = (loan.term_months || 6) + additionalMonths;
  const newMonthly = remaining / ((loan.term_months || 6) - (loan.payments_made || 0) + additionalMonths);

  const request: RestructureRequest = {
    loan_id: loanId,
    customer_id: loan.customer_id,
    type: 'term_extension',
    reason,
    status: 'requested',
    current_terms: {
      monthly_amount: currentMonthly,
      term_months: loan.term_months || 6,
      interest_rate_apr: loan.interest_rate_apr || 12,
      remaining_balance: remaining,
      total_payable: remaining,
    },
    proposed_terms: {
      monthly_amount: Math.round(newMonthly * 100) / 100,
      term_months: newTermMonths,
      interest_rate_apr: loan.interest_rate_apr || 12,
      remaining_balance: remaining,
      total_payable: remaining,
    },
  };

  await supabase.from('restructure_requests').insert({
    ...request,
    created_at: new Date(),
  });

  return request;
}

// ===================================================================
// PAYMENT HOLIDAY
// ===================================================================

/**
 * Request a payment holiday (1-2 months, max 1 per loan)
 */
export async function requestPaymentHoliday(
  loanId: string,
  months: number,
  reason: string
): Promise<RestructureRequest> {
  if (months < 1 || months > 2) {
    throw new Error('Payment holiday must be 1-2 months');
  }

  // Check if holiday already used
  const { data: existing } = await supabase
    .from('restructure_requests')
    .select('id')
    .eq('loan_id', loanId)
    .eq('type', 'payment_holiday')
    .in('status', ['approved', 'active', 'completed']);

  if (existing && existing.length > 0) {
    throw new Error('Payment holiday already used for this loan');
  }

  const { data: loan } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (!loan) throw new Error('Loan not found');

  const remaining = (loan.total_amount_due || 0) - (loan.total_amount_paid || 0);
  const remainingPayments = (loan.term_months || 6) - (loan.payments_made || 0);
  const newMonthly = remaining / (remainingPayments + months);

  const request: RestructureRequest = {
    loan_id: loanId,
    customer_id: loan.customer_id,
    type: 'payment_holiday',
    reason,
    status: 'requested',
    current_terms: {
      monthly_amount: loan.monthly_installment_amount || 0,
      term_months: loan.term_months || 6,
      interest_rate_apr: loan.interest_rate_apr || 12,
      remaining_balance: remaining,
      total_payable: remaining,
    },
    proposed_terms: {
      monthly_amount: Math.round(newMonthly * 100) / 100,
      term_months: (loan.term_months || 6) + months,
      interest_rate_apr: loan.interest_rate_apr || 12,
      remaining_balance: remaining,
      total_payable: remaining,
    },
  };

  await supabase.from('restructure_requests').insert({
    ...request,
    created_at: new Date(),
  });

  return request;
}

// ===================================================================
// HARDSHIP PROGRAM
// ===================================================================

/**
 * Enroll in hardship program (reduced payments at 50%)
 */
export async function enrollHardshipProgram(
  loanId: string,
  reason: string
): Promise<RestructureRequest> {
  const { data: loan } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();

  if (!loan) throw new Error('Loan not found');

  const remaining = (loan.total_amount_due || 0) - (loan.total_amount_paid || 0);
  const currentMonthly = loan.monthly_installment_amount || 0;
  const reducedMonthly = currentMonthly * 0.5;
  const extendedTerm = Math.ceil(remaining / reducedMonthly);

  const request: RestructureRequest = {
    loan_id: loanId,
    customer_id: loan.customer_id,
    type: 'hardship',
    reason,
    status: 'requested',
    current_terms: {
      monthly_amount: currentMonthly,
      term_months: loan.term_months || 6,
      interest_rate_apr: loan.interest_rate_apr || 12,
      remaining_balance: remaining,
      total_payable: remaining,
    },
    proposed_terms: {
      monthly_amount: Math.round(reducedMonthly * 100) / 100,
      term_months: extendedTerm,
      interest_rate_apr: 0, // 0% during hardship
      remaining_balance: remaining,
      total_payable: remaining,
    },
  };

  await supabase.from('restructure_requests').insert({
    ...request,
    created_at: new Date(),
  });

  return request;
}

// ===================================================================
// APPROVAL WORKFLOW
// ===================================================================

/**
 * Approve a restructure request and apply new terms
 */
export async function approveRestructure(
  requestId: string,
  reviewerId: string
): Promise<void> {
  const { data: request } = await supabase
    .from('restructure_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!request) throw new Error('Request not found');

  // Update loan with new terms
  await supabase
    .from('loans')
    .update({
      monthly_installment_amount: request.proposed_terms.monthly_amount,
      term_months: request.proposed_terms.term_months,
      interest_rate_apr: request.proposed_terms.interest_rate_apr,
      restructured: true,
      restructured_at: new Date(),
    })
    .eq('id', request.loan_id);

  // Update request status
  await supabase
    .from('restructure_requests')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date(),
    })
    .eq('id', requestId);

  // Log audit
  await supabase.from('audit_log').insert({
    action: 'loan.restructure.approved',
    entity_type: 'loan',
    entity_id: request.loan_id,
    performed_by: reviewerId,
    metadata: {
      request_id: requestId,
      type: request.type,
      old_monthly: request.current_terms.monthly_amount,
      new_monthly: request.proposed_terms.monthly_amount,
    },
  });
}
