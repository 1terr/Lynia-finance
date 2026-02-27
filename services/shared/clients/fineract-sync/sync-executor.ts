/**
 * Sync Executor Module
 *
 * Actual sync execution for customers, loans, disbursements, and repayments
 * to Fineract. Each method handles the full lifecycle: call Fineract,
 * update Lynia DB mapping columns, and log the sync operation.
 */

import { getFineractClient, FineractApiError } from '../fineract';
import { db } from '../database';
import { randomUUID } from 'crypto';
import { logSync, queueSyncRetry } from './sync-scheduler';

// Feature flag: enable Fineract interop module (Mojaloop-compatible two-phase transfers)
const FINERACT_USE_INTEROP = process.env.FINERACT_USE_INTEROP === 'true';

// ============================================================
// CLIENT (CUSTOMER) SYNC
// ============================================================

/**
 * Create a Fineract client for a Lynia customer.
 * Called after KYC approval or onboarding completion.
 *
 * @returns The Fineract client ID, or null if sync failed
 */
export async function syncCustomerToFineract(params: {
  customerId: string;
  firstName: string;
  lastName: string;
  mobileNo?: string;
  dateOfBirth?: string;
}): Promise<number | null> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();

    const response = await fineract.createClient({
      firstName: params.firstName,
      lastName: params.lastName,
      mobileNo: params.mobileNo,
      externalId: params.customerId,
      dateOfBirth: params.dateOfBirth,
    });

    const fineractClientId = response.resourceId;

    // Update Lynia customers table with Fineract mapping
    await db
      .from('customers')
      .update({
        fineract_client_id: fineractClientId,
        fineract_synced_at: new Date().toISOString(),
      })
      .eq('id', params.customerId)
      .execute();

    await logSync({
      entity_type: 'client',
      entity_id: params.customerId,
      fineract_id: fineractClientId,
      operation: 'create',
      direction: 'outbound',
      status: 'success',
      request_payload: params,
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Customer ${params.customerId} -> Fineract client ${fineractClientId}`);

    // Register MSISDN with interop module for Mojaloop party lookup
    if (FINERACT_USE_INTEROP && params.mobileNo) {
      try {
        await fineract.registerInteropParty({
          idType: 'MSISDN',
          idValue: params.mobileNo.replace(/^\+/, ''), // Strip leading +
          accountId: params.customerId,
        });

        await logSync({
          entity_type: 'client',
          entity_id: params.customerId,
          fineract_id: fineractClientId,
          operation: 'register_interop_party',
          direction: 'outbound',
          status: 'success',
          request_payload: { idType: 'MSISDN', idValue: params.mobileNo },
          duration_ms: Date.now() - startTime,
        });

        console.log(`[fineract-sync] Registered MSISDN ${params.mobileNo} for interop party lookup`);
      } catch (interopError) {
        // Non-fatal -- interop registration failure shouldn't block customer sync
        console.warn(`[fineract-sync] Failed to register interop party for ${params.customerId}:`, interopError);

        await logSync({
          entity_type: 'client',
          entity_id: params.customerId,
          fineract_id: fineractClientId,
          operation: 'register_interop_party',
          direction: 'outbound',
          status: 'failed',
          error_message: interopError instanceof Error ? interopError.message : String(interopError),
          duration_ms: Date.now() - startTime,
        });
      }
    }

    return fineractClientId;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'client',
      entity_id: params.customerId,
      operation: 'create',
      direction: 'outbound',
      status: 'failed',
      request_payload: params,
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to sync customer ${params.customerId}:`, error);
    await queueSyncRetry({
      entityType: 'client',
      entityId: params.customerId,
      operation: 'create',
      requestPayload: params as unknown as Record<string, unknown>,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================
// LOAN SYNC
// ============================================================

/**
 * Create a loan application in Fineract.
 * Called when a loan is created in Lynia (after credit decision = approve).
 *
 * @returns The Fineract loan ID, or null if sync failed
 */
export async function syncLoanToFineract(params: {
  loanId: string;
  customerId: string;
  fineractClientId: number;
  fineractProductId: number;
  principal: number;
  numberOfRepayments: number;
  repaymentEveryMonths: number;
  interestRatePerMonth: number;
  expectedDisbursementDate: Date;
}): Promise<number | null> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();

    const response = await fineract.createLoan({
      clientId: params.fineractClientId,
      productId: params.fineractProductId,
      principal: params.principal,
      numberOfRepayments: params.numberOfRepayments,
      repaymentEveryMonths: params.repaymentEveryMonths,
      interestRatePerMonth: params.interestRatePerMonth,
      expectedDisbursementDate: params.expectedDisbursementDate,
      externalId: params.loanId,
    });

    const fineractLoanId = response.resourceId;

    // Update Lynia loans table with Fineract mapping
    await db
      .from('loans')
      .update({
        fineract_loan_id: fineractLoanId,
        fineract_product_id: params.fineractProductId,
        fineract_synced_at: new Date().toISOString(),
      })
      .eq('id', params.loanId)
      .execute();

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: fineractLoanId,
      operation: 'create',
      direction: 'outbound',
      status: 'success',
      request_payload: params,
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Loan ${params.loanId} -> Fineract loan ${fineractLoanId}`);
    return fineractLoanId;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      operation: 'create',
      direction: 'outbound',
      status: 'failed',
      request_payload: params,
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to sync loan ${params.loanId}:`, error);
    await queueSyncRetry({
      entityType: 'loan',
      entityId: params.loanId,
      operation: 'create',
      requestPayload: params as unknown as Record<string, unknown>,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Approve a loan in Fineract.
 * Called after credit scoring approves the loan.
 */
export async function approveLoanInFineract(params: {
  loanId: string;
  fineractLoanId: number;
}): Promise<boolean> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();
    const response = await fineract.approveLoan(params.fineractLoanId);

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'approve',
      direction: 'outbound',
      status: 'success',
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Loan ${params.loanId} approved in Fineract`);
    return true;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'approve',
      direction: 'outbound',
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to approve loan ${params.loanId} in Fineract:`, error);
    await queueSyncRetry({
      entityType: 'loan',
      entityId: params.loanId,
      operation: 'approve',
      requestPayload: params as unknown as Record<string, unknown>,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Disburse a loan in Fineract.
 * Called after deposit payment is confirmed.
 */
export async function disburseLoanInFineract(params: {
  loanId: string;
  fineractLoanId: number;
  disbursementDate?: Date;
  /** Payee MSISDN for interop two-phase disbursement (optional) */
  payeeMsisdn?: string;
  /** Disbursement amount in USD for interop (optional) */
  amount?: number;
  currency?: string;
}): Promise<boolean> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();

    // Feature-flagged: use interop two-phase disbursement if enabled and MSISDN provided
    if (FINERACT_USE_INTEROP && params.payeeMsisdn && params.amount) {
      return await disburseViaInterop(fineract, params, startTime);
    }

    // Standard disbursement path
    const response = await fineract.disburseLoan(
      params.fineractLoanId,
      params.disbursementDate
    );

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'disburse',
      direction: 'outbound',
      status: 'success',
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Loan ${params.loanId} disbursed in Fineract`);
    return true;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'disburse',
      direction: 'outbound',
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to disburse loan ${params.loanId}:`, error);
    await queueSyncRetry({
      entityType: 'loan',
      entityId: params.loanId,
      operation: 'disburse',
      requestPayload: params as unknown as Record<string, unknown>,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Two-phase interop disbursement: PREPARE -> COMMIT (or RELEASE on failure).
 */
async function disburseViaInterop(
  fineract: Awaited<ReturnType<typeof getFineractClient>>,
  params: {
    loanId: string;
    fineractLoanId: number;
    disbursementDate?: Date;
    payeeMsisdn?: string;
    amount?: number;
    currency?: string;
  },
  startTime: number
): Promise<boolean> {
  const transferId = randomUUID();
  const fspId = process.env.FINERACT_FSP_ID || 'lynia-finance';

  try {
    // Phase 1: PREPARE -- reserve the funds
    const prepareResponse = await fineract.prepareInteropTransfer({
      transferId,
      payerFsp: fspId,
      payeeFsp: fspId,
      amount: {
        amount: (params.amount!).toFixed(2),
        currency: params.currency || 'USD',
      },
      note: `Loan disbursement for ${params.loanId}`,
    });

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'interop_prepare',
      direction: 'outbound',
      status: 'success',
      request_payload: { transferId, payeeMsisdn: params.payeeMsisdn },
      response_payload: prepareResponse,
      duration_ms: Date.now() - startTime,
    });

    if (prepareResponse.transferState !== 'RESERVED') {
      throw new Error(`Unexpected transfer state after prepare: ${prepareResponse.transferState}`);
    }

    // Phase 2: COMMIT -- complete the transfer
    const commitResponse = await fineract.commitInteropTransfer(transferId);

    // Also disburse via standard Fineract loan API to update loan status
    await fineract.disburseLoan(params.fineractLoanId, params.disbursementDate);

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'interop_commit',
      direction: 'outbound',
      status: 'success',
      request_payload: { transferId },
      response_payload: commitResponse,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Loan ${params.loanId} disbursed via interop (transfer ${transferId})`);
    return true;
  } catch (error) {
    // Release the reserved funds if prepare succeeded but commit failed
    try {
      await fineract.releaseInteropTransfer(transferId);
      console.log(`[fineract-sync] Released interop transfer ${transferId} after failure`);
    } catch (releaseError) {
      console.error(`[fineract-sync] Failed to release interop transfer ${transferId}:`, releaseError);
    }

    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'loan',
      entity_id: params.loanId,
      fineract_id: params.fineractLoanId,
      operation: 'interop_disburse',
      direction: 'outbound',
      status: 'failed',
      request_payload: { transferId, payeeMsisdn: params.payeeMsisdn },
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Interop disbursement failed for loan ${params.loanId}:`, error);
    await queueSyncRetry({
      entityType: 'loan',
      entityId: params.loanId,
      operation: 'interop_disburse',
      requestPayload: { ...params, transferId } as unknown as Record<string, unknown>,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ============================================================
// REPAYMENT SYNC
// ============================================================

/**
 * Post a repayment to Fineract.
 * Called after a payment webhook confirms a repayment.
 *
 * @returns The Fineract transaction ID, or null if sync failed
 */
export async function syncRepaymentToFineract(params: {
  paymentId: string;
  loanId: string;
  fineractLoanId: number;
  amount: number;
  transactionDate: Date;
  note?: string;
}): Promise<number | null> {
  const startTime = Date.now();

  try {
    const fineract = await getFineractClient();

    const response = await fineract.postRepayment({
      loanId: params.fineractLoanId,
      amount: params.amount,
      transactionDate: params.transactionDate,
      note: params.note,
      externalId: params.paymentId,
    });

    const fineractTxnId = response.resourceId;

    // Update Lynia payments table with Fineract mapping
    await db
      .from('payments')
      .update({
        fineract_transaction_id: fineractTxnId,
        fineract_synced_at: new Date().toISOString(),
      })
      .eq('id', params.paymentId)
      .execute();

    await logSync({
      entity_type: 'repayment',
      entity_id: params.paymentId,
      fineract_id: fineractTxnId,
      operation: 'repayment',
      direction: 'outbound',
      status: 'success',
      request_payload: params,
      response_payload: response,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[fineract-sync] Payment ${params.paymentId} -> Fineract txn ${fineractTxnId}`);
    return fineractTxnId;
  } catch (error) {
    const apiError = error instanceof FineractApiError ? error : null;

    await logSync({
      entity_type: 'repayment',
      entity_id: params.paymentId,
      operation: 'repayment',
      direction: 'outbound',
      status: 'failed',
      request_payload: params,
      error_message: error instanceof Error ? error.message : String(error),
      http_status_code: apiError?.statusCode,
      duration_ms: Date.now() - startTime,
    });

    console.error(`[fineract-sync] Failed to sync repayment ${params.paymentId}:`, error);
    await queueSyncRetry({
      entityType: 'repayment',
      entityId: params.paymentId,
      operation: 'repayment',
      requestPayload: params as unknown as Record<string, unknown>,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
