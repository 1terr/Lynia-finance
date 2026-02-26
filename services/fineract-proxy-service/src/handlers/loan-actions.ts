/**
 * Loan Action Handlers
 *
 * POST endpoints for loan approval, disbursement, and repayment.
 * Each handler looks up the Fineract loan ID from the Lynia DB,
 * then forwards the action to the Fineract API.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient } from '../../../shared/clients/fineract';
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
    logger.error('Loan approve failed', {
      action: 'fineract.loanApprove',
      meta: { loanId: params.loanId, error: e instanceof Error ? e.message : 'Unknown' },
    });
    return err(500, `Failed to approve loan: ${e instanceof Error ? e.message : 'unknown error'}`, event);
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
    logger.error('Loan disburse failed', {
      action: 'fineract.loanDisburse',
      meta: { loanId: params.loanId, error: e instanceof Error ? e.message : 'Unknown' },
    });
    return err(500, `Failed to disburse loan: ${e instanceof Error ? e.message : 'unknown error'}`, event);
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
    logger.error('Loan repayment failed', {
      action: 'fineract.loanRepayment',
      meta: { loanId: params.loanId, error: e instanceof Error ? e.message : 'Unknown' },
    });
    return err(500, `Failed to repayment loan: ${e instanceof Error ? e.message : 'unknown error'}`, event);
  }
}
