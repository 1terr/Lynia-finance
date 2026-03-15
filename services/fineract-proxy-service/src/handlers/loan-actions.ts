/**
 * Loan Action Handlers
 *
 * POST endpoints for loan approval, disbursement, and repayment.
 * Each handler looks up the Fineract loan ID from the Lynia DB,
 * then forwards the action to the Fineract API.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient, FineractApiError } from '../../../shared/clients/fineract';
import { db } from '../../../shared/clients/database';
import { parseBody } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
import { ok, err } from './helpers';

// ============================================================
// SHARED: look up Fineract loan ID from Lynia DB
// ============================================================

async function lookupFineractLoan(
  event: APIGatewayProxyEvent,
  lyniaLoanId: string
): Promise<
  | { fineractLoanId: number; body: Record<string, unknown> }
  | { error: APIGatewayProxyResult }
> {
  const { data: bodyData, error: parseError } = parseBody(event);
  if (parseError) return { error: parseError };

  const { data: loanData, error: dbError } = await db
    .from('loans')
    .select('id, fineract_loan_id')
    .eq('id', lyniaLoanId)
    .single()
    .execute();

  if (dbError || !loanData) {
    return { error: err(404, 'Loan not found', event) };
  }

  const loan = loanData as unknown as { id: string; fineract_loan_id: number | null };
  if (!loan.fineract_loan_id) {
    return { error: err(400, 'Loan has not been synced to Fineract', event) };
  }

  return { fineractLoanId: loan.fineract_loan_id, body: bodyData as Record<string, unknown> };
}

// ============================================================
// POST /api/v1/fineract/loans/:loanId/approve
// ============================================================

export async function handleLoanApprove(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await lookupFineractLoan(event, params.loanId);
  if ('error' in result) return result.error;

  const fineract = await getFineractClient();

  try {
    const approvedOnDate = result.body?.approvedOnDate as string | undefined;
    const response = await fineract.approveLoan(
      result.fineractLoanId,
      approvedOnDate ? new Date(approvedOnDate) : undefined
    );
    return ok(
      { success: true, resourceId: response.resourceId, loanId: response.loanId },
      event
    );
  } catch (e) {
    return handleFineractError(e, 'loanApprove', params.loanId, event);
  }
}

// ============================================================
// POST /api/v1/fineract/loans/:loanId/disburse
// ============================================================

export async function handleLoanDisburse(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await lookupFineractLoan(event, params.loanId);
  if ('error' in result) return result.error;

  const fineract = await getFineractClient();

  try {
    const actualDate = result.body?.actualDisbursementDate as string | undefined;
    const paymentTypeId = result.body?.paymentTypeId as number | undefined;
    const response = await fineract.disburseLoan(
      result.fineractLoanId,
      actualDate ? new Date(actualDate) : undefined,
      paymentTypeId
    );
    return ok(
      { success: true, resourceId: response.resourceId, loanId: response.loanId },
      event
    );
  } catch (e) {
    return handleFineractError(e, 'loanDisburse', params.loanId, event);
  }
}

// ============================================================
// POST /api/v1/fineract/loans/:loanId/repayment
// ============================================================

export async function handleLoanRepayment(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await lookupFineractLoan(event, params.loanId);
  if ('error' in result) return result.error;

  const fineract = await getFineractClient();

  try {
    const response = await fineract.postRepayment({
      loanId: result.fineractLoanId,
      amount: result.body.transactionAmount as number,
      transactionDate: new Date(result.body.transactionDate as string),
      paymentTypeId: result.body.paymentTypeId as number | undefined,
      note: result.body.note as string | undefined,
    });
    return ok(
      { success: true, resourceId: response.resourceId, loanId: response.loanId },
      event
    );
  } catch (e) {
    return handleFineractError(e, 'loanRepayment', params.loanId, event);
  }
}

// ============================================================
// Fineract error → 502 helper
// ============================================================

function handleFineractError(
  e: unknown,
  action: string,
  loanId: string,
  event: APIGatewayProxyEvent
): APIGatewayProxyResult {
  if (e instanceof FineractApiError) {
    logger.error(`Fineract API error during ${action}`, {
      action: `fineract.${action}`,
      meta: {
        loanId,
        fineractStatus: e.statusCode,
        errorMessage: e.errorBody?.defaultUserMessage || e.message,
      },
    });
    return err(
      502,
      e.errorBody?.defaultUserMessage || 'Core banking system error',
      event
    );
  }

  logger.error(`${action} failed`, {
    action: `fineract.${action}`,
    meta: { loanId, error: e instanceof Error ? e.message : 'Unknown' },
  });
  return err(500, 'An unexpected error occurred', event);
}

// ============================================================
// POST /api/v1/fineract/loans/:loanId/reschedule
// ============================================================

export async function handleLoanReschedule(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await lookupFineractLoan(event, params.loanId);
  if ('error' in result) return result.error;

  const { rescheduleFromDate, rescheduleReasonCodeValueId } = result.body;
  if (!rescheduleFromDate) {
    return err(400, 'rescheduleFromDate is required', event);
  }
  if (rescheduleReasonCodeValueId === undefined || rescheduleReasonCodeValueId === null) {
    return err(400, 'rescheduleReasonCodeValueId is required', event);
  }

  const fineract = await getFineractClient();

  try {
    const response = await fineract.restructureLoan(result.fineractLoanId, {
      rescheduleFromDate: rescheduleFromDate as string,
      rescheduleReasonCodeValueId: rescheduleReasonCodeValueId as number,
      adjustedDueDate: result.body.adjustedDueDate as string | undefined,
      graceOnPrincipal: result.body.graceOnPrincipal as number | undefined,
      graceOnInterest: result.body.graceOnInterest as number | undefined,
      extraTerms: result.body.extraTerms as number | undefined,
      newInterestRate: result.body.newInterestRate as number | undefined,
      rescheduleReasonComment: result.body.rescheduleReasonComment as string | undefined,
      submittedOnDate: result.body.submittedOnDate as string | undefined,
    });

    // Update loan status in Lynia DB
    await db
      .from('loans')
      .update({ status: 'restructured' })
      .eq('id', params.loanId)
      .execute();

    return ok(
      { success: true, resourceId: response.resourceId, loanId: response.loanId },
      event
    );
  } catch (e) {
    return handleFineractError(e, 'loanReschedule', params.loanId, event);
  }
}

// ============================================================
// POST /api/v1/fineract/loans/:loanId/early-payoff
// ============================================================

export async function handleEarlyPayoff(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await lookupFineractLoan(event, params.loanId);
  if ('error' in result) return result.error;

  const fineract = await getFineractClient();

  try {
    // Get the full loan with schedule to determine outstanding balance
    const loanData = await fineract.calculateEarlyPayoff(result.fineractLoanId);
    const outstanding = loanData?.summary?.totalOutstanding ?? 0;

    if (outstanding <= 0) {
      return err(400, 'Loan has no outstanding balance', event);
    }

    // Process full balance repayment
    const today = new Date().toISOString().split('T')[0];
    const response = await fineract.processEarlyPayoff({
      loanId: result.fineractLoanId,
      amount: outstanding,
      transactionDate: today,
      paymentTypeId: result.body.paymentTypeId as number | undefined,
      note: result.body.note as string | undefined,
    });

    // Update Lynia DB
    await db
      .from('loans')
      .update({ status: 'closed', outstanding_balance: 0 })
      .eq('id', params.loanId)
      .execute();

    return ok(
      { success: true, resourceId: response.resourceId, amountPaid: outstanding },
      event
    );
  } catch (e) {
    return handleFineractError(e, 'earlyPayoff', params.loanId, event);
  }
}

// ============================================================
// POST /api/v1/fineract/loans/:loanId/reject
// ============================================================

export async function handleLoanReject(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await lookupFineractLoan(event, params.loanId);
  if ('error' in result) return result.error;

  const { rejectedOnDate, note } = result.body;
  if (!rejectedOnDate) {
    return err(400, 'rejectedOnDate is required', event);
  }
  if (!note) {
    return err(400, 'note is required when rejecting a loan', event);
  }

  const fineract = await getFineractClient();

  try {
    const response = await fineract.rejectLoan(
      result.fineractLoanId,
      new Date(rejectedOnDate as string),
      note as string
    );
    return ok(
      { success: true, resourceId: response.resourceId, loanId: response.loanId },
      event
    );
  } catch (e) {
    return handleFineractError(e, 'loanReject', params.loanId, event);
  }
}

// ============================================================
// POST /api/v1/fineract/loans/:loanId/writeoff
// ============================================================

export async function handleLoanWriteOff(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await lookupFineractLoan(event, params.loanId);
  if ('error' in result) return result.error;

  const { transactionDate, note } = result.body;
  if (!transactionDate) {
    return err(400, 'transactionDate is required', event);
  }

  const fineract = await getFineractClient();

  try {
    const response = await fineract.writeOffLoan(
      result.fineractLoanId,
      new Date(transactionDate as string),
      note as string | undefined
    );
    return ok(
      { success: true, resourceId: response.resourceId, loanId: response.loanId },
      event
    );
  } catch (e) {
    return handleFineractError(e, 'loanWriteOff', params.loanId, event);
  }
}

// ============================================================
// POST /api/v1/fineract/loans/:loanId/close
// ============================================================

export async function handleLoanClose(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const result = await lookupFineractLoan(event, params.loanId);
  if ('error' in result) return result.error;

  const { closedOnDate } = result.body;
  if (!closedOnDate) {
    return err(400, 'closedOnDate is required', event);
  }

  const fineract = await getFineractClient();

  try {
    const response = await fineract.closeLoan(
      result.fineractLoanId,
      new Date(closedOnDate as string)
    );
    return ok(
      { success: true, resourceId: response.resourceId, loanId: response.loanId },
      event
    );
  } catch (e) {
    return handleFineractError(e, 'loanClose', params.loanId, event);
  }
}
