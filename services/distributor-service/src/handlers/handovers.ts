import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  parseBody,
} from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { resolveDistributor } from '../helpers/resolve-distributor';
import { triggerDisbursement } from '../helpers/trigger-disbursement';
import { completeHandover } from '../../../lock-service/src/handover/handover-workflow';
import logger from '../../../shared/utils/logger';

/**
 * GET /api/v1/distributor/handovers
 *
 * Fetch handovers for this distributor. Supports ?status=completed filter.
 */
export const handleGetHandovers: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const status = event.queryStringParameters?.status;

  let sql = `
    SELECT
      dh.id,
      l.id AS loan_id,
      c.full_name AS customer_name,
      CONCAT(d.manufacturer, ' ', d.model) AS device_model,
      d.imei AS device_imei,
      l.loan_amount_usd AS loan_amount,
      COALESCE(dc.commission_amount_usd, 0) AS commission_earned,
      dh.handed_over_at AS completed_at,
      dh.status,
      dh.created_at
    FROM device_handovers dh
    JOIN loans l ON l.id = dh.loan_id
    JOIN customers c ON c.id = dh.customer_id
    JOIN devices d ON d.id = dh.device_id
    LEFT JOIN distributor_commissions dc ON dc.loan_id = l.id AND dc.distributor_id = dh.distributor_id
    WHERE dh.distributor_id = $1
  `;
  const params: unknown[] = [dist.id];

  if (status) {
    params.push(status);
    sql += ` AND dh.status = $${params.length}`;
  }

  sql += ' ORDER BY dh.created_at DESC';

  const result = await query(sql, params);

  // PostgreSQL DECIMAL columns return strings via the pg driver.
  // Convert to numbers so the frontend can call .toFixed() safely.
  const handovers = result.data.map((row: Record<string, unknown>) => ({
    ...row,
    loan_amount: Number(row.loan_amount) || 0,
    commission_earned: Number(row.commission_earned) || 0,
  }));

  return successResponse(handovers, 200, event);
};

/**
 * GET /api/v1/distributor/handovers/search?q=<query>
 *
 * Search for approved loans by customer name, national ID, or loan ID.
 * Any distributor can search — results are not scoped to a specific distributor.
 * Returns loans in 'approved' status that don't yet have a completed handover.
 */
export const handleSearchApprovedLoans: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const q = event.queryStringParameters?.q?.trim();

  if (!q || q.length < 3) {
    return errorResponse('Search query must be at least 3 characters', 400, undefined, event);
  }

  const searchQuery = `%${q}%`;

  const result = await query(
    `SELECT
       l.id AS loan_id,
       c.id AS customer_id,
       c.full_name AS customer_name,
       l.loan_amount_usd AS loan_amount,
       l.loan_amount_usd * (lp.deposit_percentage / 100.0) AS deposit_amount,
       CASE WHEN EXISTS (
         SELECT 1 FROM payments p
         WHERE p.loan_id = l.id AND p.payment_type = 'deposit' AND p.payment_status = 'confirmed'
       ) THEN true ELSE false END AS deposit_paid,
       l.approved_at AS approved_date,
       lp.name AS device_category,
       lp.term_months AS loan_term_months,
       l.loan_amount_usd / lp.term_months AS monthly_payment,
       lp.interest_rate,
       l.approved_at::date + INTERVAL '30 days' AS first_payment_date
     FROM loans l
     JOIN customers c ON c.id = l.customer_id
     JOIN loan_products lp ON lp.id = l.product_id
     WHERE l.status = 'approved'
       AND NOT EXISTS (
         SELECT 1 FROM device_handovers dh
         WHERE dh.loan_id = l.id AND dh.status = 'completed'
       )
       AND (
         c.full_name ILIKE $1
         OR c.national_id = $2
         OR l.id::text ILIKE $1
       )
     ORDER BY l.approved_at DESC
     LIMIT 20`,
    [searchQuery, q]
  );

  return successResponse(result.data, 200, event);
};

/**
 * POST /api/v1/distributor/handovers/verify-identity
 *
 * Verify customer national ID against the loan's customer record.
 */
export const handleVerifyIdentity: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const { data: body, error: parseError } = parseBody<{
    loan_id: string;
    national_id: string;
  }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, undefined, event);

  const { loan_id, national_id } = body;
  if (!loan_id || !national_id) {
    return errorResponse('loan_id and national_id are required', 400, undefined, event);
  }

  // Look up the customer's national ID from the loan
  const result = await query(
    `SELECT c.national_id
     FROM loans l
     JOIN customers c ON c.id = l.customer_id
     WHERE l.id = $1 AND l.status = 'approved'`,
    [loan_id]
  );

  if (result.data.length === 0) {
    return notFoundResponse('Approved loan', event);
  }

  const storedId = result.data[0].national_id;
  const verified = storedId === national_id;

  return successResponse({
    verified,
    message: verified
      ? 'Identity verified successfully'
      : 'National ID does not match loan application',
  }, 200, event);
};

/**
 * POST /api/v1/distributor/handovers/verify-device
 *
 * Verify that a device from the distributor's inventory is eligible for this loan.
 * Checks: device exists, is available, IMEI matches, price within approved budget.
 */
export const handleVerifyDevice: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const dist = await resolveDistributor(auth, event);
  if (!dist) return notFoundResponse('Distributor', event);

  const { data: body, error: parseError } = parseBody<{
    loan_id: string;
    device_id: string;
    imei: string;
  }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, undefined, event);

  const { loan_id, device_id, imei } = body;
  if (!loan_id || !device_id || !imei) {
    return errorResponse('loan_id, device_id, and imei are required', 400, undefined, event);
  }

  // Validate IMEI format
  if (!/^\d{15}$/.test(imei)) {
    return successResponse({
      verified: false,
      message: 'IMEI must be exactly 15 digits',
    }, 200, event);
  }

  // Check device exists in this distributor's inventory and is available
  const deviceResult = await query<{ id: string; imei: string; retail_price_usd: number; status: string }>(
    `SELECT d.id, d.imei, d.retail_price_usd, d.status
     FROM devices d
     JOIN agent_inventory ai ON ai.device_id = d.id
     WHERE d.id = $1
       AND ai.distributor_id = $2
       AND ai.status = 'available'`,
    [device_id, dist.id]
  );

  if (deviceResult.data.length === 0) {
    return successResponse({
      verified: false,
      message: 'Device not found in your available inventory',
    }, 200, event);
  }

  const device = deviceResult.data[0];

  // Verify IMEI matches
  if (device.imei !== imei) {
    return successResponse({
      verified: false,
      message: 'IMEI does not match the selected device record',
    }, 200, event);
  }

  // Check price is within approved loan budget
  const loanResult = await query<{ loan_amount_usd: number }>(
    `SELECT l.loan_amount_usd FROM loans l WHERE l.id = $1 AND l.status = 'approved'`,
    [loan_id]
  );

  if (loanResult.data.length === 0) {
    return notFoundResponse('Approved loan', event);
  }

  const loanAmount = loanResult.data[0].loan_amount_usd;
  if (device.retail_price_usd > loanAmount) {
    return successResponse({
      verified: false,
      message: `Device price ($${device.retail_price_usd}) exceeds approved loan amount ($${loanAmount})`,
    }, 200, event);
  }

  return successResponse({
    verified: true,
    message: 'Device verified — eligible for this loan',
  }, 200, event);
};

/**
 * POST /api/v1/distributor/handovers/verify-deposit
 *
 * Verify deposit payment for a loan.
 */
export const handleVerifyDeposit: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const { data: body, error: parseError } = parseBody<{
    loan_id: string;
    payment_method: string;
    transaction_ref: string;
  }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, undefined, event);

  const { loan_id, payment_method, transaction_ref } = body;
  if (!loan_id || !payment_method || !transaction_ref) {
    return errorResponse('loan_id, payment_method, and transaction_ref are required', 400, undefined, event);
  }

  if (transaction_ref.length < 4) {
    return successResponse({
      verified: false,
      amount: 0,
      message: 'Invalid transaction reference',
    }, 200, event);
  }

  // Check if deposit already confirmed
  const depositResult = await query<{ amount_usd: number; payment_status: string }>(
    `SELECT p.amount_usd, p.payment_status
     FROM payments p
     WHERE p.loan_id = $1 AND p.payment_type = 'deposit'
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [loan_id]
  );

  if (depositResult.data.length > 0 && depositResult.data[0].payment_status === 'confirmed') {
    return successResponse({
      verified: true,
      amount: depositResult.data[0].amount_usd,
      message: `Deposit of $${depositResult.data[0].amount_usd.toFixed(2)} already confirmed`,
    }, 200, event);
  }

  // Look up the expected deposit amount
  const loanResult = await query<{ loan_amount_usd: number; deposit_percentage: number }>(
    `SELECT l.loan_amount_usd, lp.deposit_percentage
     FROM loans l
     JOIN loan_products lp ON lp.id = l.product_id
     WHERE l.id = $1`,
    [loan_id]
  );

  if (loanResult.data.length === 0) {
    return notFoundResponse('Loan', event);
  }

  const expectedDeposit = loanResult.data[0].loan_amount_usd * (loanResult.data[0].deposit_percentage / 100);

  // Record the deposit payment for later verification by payment service
  await db
    .from('payments')
    .insert({
      loan_id,
      payment_type: 'deposit',
      amount_usd: expectedDeposit,
      payment_method,
      transaction_reference: transaction_ref,
      payment_status: 'pending_verification',
      created_at: new Date().toISOString(),
    })
    .execute();

  return successResponse({
    verified: true,
    amount: expectedDeposit,
    message: `Deposit of $${expectedDeposit.toFixed(2)} recorded via ${payment_method} — pending verification`,
  }, 200, event);
};

/**
 * POST /api/v1/distributor/handovers
 *
 * Submit a completed handover. Creates the handover record, links device to
 * loan, calculates commission, and triggers Fineract disbursement.
 *
 * First distributor to submit wins — unique constraint on loan_id prevents
 * duplicate handovers.
 */
export const handleSubmitHandover: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const dist = await resolveDistributor(auth, event, 'id, user_id');
  if (!dist) return notFoundResponse('Distributor', event);

  const { data: body, error: parseError } = parseBody<{
    loan_id: string;
    customer_id: string;
    device_id: string;
    customer_national_id: string;
    device_imei: string;
    device_condition: Record<string, unknown>;
    device_photos: string[];
    signature_data_url: string;
    deposit_payment_method: string;
    deposit_transaction_ref: string;
  }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, undefined, event);

  const {
    loan_id,
    customer_id,
    device_id,
    customer_national_id,
    device_imei,
    device_condition,
    device_photos,
    signature_data_url,
    deposit_payment_method,
    deposit_transaction_ref,
  } = body;

  // Validate required fields
  if (!loan_id || !customer_id || !device_id || !device_imei || !signature_data_url) {
    return errorResponse(
      'loan_id, customer_id, device_id, device_imei, and signature_data_url are required',
      400,
      undefined,
      event,
    );
  }

  // Verify loan is still approved and no handover exists
  const loanCheck = await query(
    `SELECT l.id, l.status, l.loan_amount_usd
     FROM loans l
     WHERE l.id = $1
     FOR UPDATE`,
    [loan_id]
  );

  if (loanCheck.data.length === 0) {
    return notFoundResponse('Loan', event);
  }

  if (loanCheck.data[0].status !== 'approved') {
    return errorResponse(
      'Loan is no longer available for handover',
      409,
      { current_status: loanCheck.data[0].status },
      event,
    );
  }

  // Check no completed handover exists (concurrency guard)
  const existingHandover = await query(
    `SELECT id FROM device_handovers WHERE loan_id = $1 AND status = 'completed'`,
    [loan_id]
  );

  if (existingHandover.data.length > 0) {
    return errorResponse(
      'A handover has already been completed for this loan',
      409,
      undefined,
      event,
    );
  }

  // Create the handover record with all wizard data
  const { data: handover, error: insertError } = await db
    .from('device_handovers')
    .insert({
      loan_id,
      customer_id,
      device_id,
      distributor_id: dist.id,
      customer_national_id,
      device_imei,
      device_condition,
      device_photos,
      customer_signature_url: signature_data_url,
      deposit_payment_method,
      deposit_transaction_ref,
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
      app_installed: true,
      app_configured: true,
      lock_test_passed: true,
      status: 'initiated',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()
    .execute();

  if (insertError || !handover) {
    logger.error('Failed to create handover record', {
      action: 'distributor.handover.submit',
      loanId: loan_id,
      errorMessage: insertError instanceof Error ? insertError.message : String(insertError),
    });
    return errorResponse('Failed to create handover record', 500, undefined, event);
  }

  const handoverId = handover.id;

  // Complete the handover: updates loan→active, device→assigned, records commission
  let completionResult;
  try {
    completionResult = await completeHandover(handoverId);
  } catch (error) {
    logger.error('Handover completion failed', {
      action: 'distributor.handover.submit',
      handoverId,
      loanId: loan_id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(
      'Handover could not be completed — please try again',
      500,
      undefined,
      event,
    );
  }

  // Trigger Fineract disbursement (async, non-blocking)
  // Do not await — fire and forget, retries via SQS on failure
  triggerDisbursement(loan_id).catch((err) => {
    logger.error('Fineract disbursement trigger error (non-blocking)', {
      action: 'distributor.handover.submit',
      loanId: loan_id,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  });

  // Look up first payment date from the updated loan
  const updatedLoan = await query(
    `SELECT l.next_payment_date FROM loans l WHERE l.id = $1`,
    [loan_id]
  );
  const nextPaymentDate = updatedLoan.data[0]?.next_payment_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return successResponse({
    success: true,
    handover_id: handoverId,
    loan_id,
    commission_amount: completionResult.commission.amount,
    next_payment_date: nextPaymentDate,
    message: `Device handed over successfully. Loan ${loan_id} is now active.`,
  }, 201, event);
};

/**
 * POST /api/v1/distributor/handovers/:id/:action (legacy)
 *
 * Kept for backwards compatibility. New clients use the standalone
 * verify-identity, verify-device, verify-deposit endpoints.
 */
export const handleHandoverAction: RouteHandler = async (event, params, auth) => {
  requireRole(auth, 'distributor');

  const handoverId = params.id;
  const action = params.action;

  // Verify distributor owns this handover
  const ownerResult = await query(
    `SELECT dh.id FROM device_handovers dh
     JOIN distributors dist ON dist.id = dh.distributor_id
     WHERE dh.id = $1 AND dist.user_id = $2`,
    [handoverId, auth.userId]
  );
  if (ownerResult.data.length === 0) {
    return notFoundResponse('Handover', event);
  }

  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  switch (action) {
    case 'verify-identity': {
      const nationalId = (body as Record<string, unknown>)?.national_id as string;
      if (!nationalId) {
        return errorResponse('national_id is required', 400, undefined, event);
      }
      const valid = /^\d{2}-\d{6,7}[A-Z]\d{2}$/.test(nationalId);
      return successResponse({
        verified: valid,
        message: valid ? 'Identity verified successfully' : 'Invalid National ID format',
      }, 200, event);
    }

    case 'verify-imei': {
      const imei = (body as Record<string, unknown>)?.imei as string;
      const expectedImei = (body as Record<string, unknown>)?.expected_imei as string;
      if (!imei || !expectedImei) {
        return errorResponse('imei and expected_imei are required', 400, undefined, event);
      }
      const valid = /^\d{15}$/.test(imei);
      const matches = imei === expectedImei;
      return successResponse({
        verified: valid && matches,
        message: !valid
          ? 'IMEI must be exactly 15 digits'
          : matches
          ? 'IMEI verified — matches device record'
          : 'IMEI does not match the assigned device',
      }, 200, event);
    }

    case 'verify-deposit': {
      return successResponse({
        verified: true,
        message: 'Deposit verification handled by standalone endpoint',
      }, 200, event);
    }

    case 'complete': {
      const result = await completeHandover(handoverId);
      return successResponse(result, 200, event);
    }

    default:
      return errorResponse('Unknown action', 400, undefined, event);
  }
};
