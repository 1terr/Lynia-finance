import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db, query } from '../../../shared/clients/database';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  parseBody,
} from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { HandoverService } from '../../../lock-service/src/handover-service';
import { resolveDistributor } from '../helpers/resolve-distributor';

const handoverService = new HandoverService();

/**
 * GET /api/v1/distributor/handovers
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
      c.phone_number AS customer_phone,
      CONCAT(d.manufacturer, ' ', d.model) AS device_model,
      d.imei AS device_imei,
      l.loan_amount_usd AS loan_amount,
      l.loan_amount_usd * (lp.deposit_percentage / 100.0) AS deposit_amount,
      CASE WHEN EXISTS (
        SELECT 1 FROM payments p
        WHERE p.loan_id = l.id AND p.payment_type = 'deposit' AND p.payment_status = 'confirmed'
      ) THEN true ELSE false END AS deposit_paid,
      dh.scheduled_date,
      dh.status,
      dh.created_at
    FROM device_handovers dh
    JOIN loans l ON l.id = dh.loan_id
    JOIN customers c ON c.id = dh.customer_id
    JOIN devices d ON d.id = dh.device_id
    LEFT JOIN loan_products lp ON lp.id = l.product_id
    WHERE dh.distributor_id = $1
  `;
  const params: unknown[] = [dist.id];

  if (status) {
    params.push(status);
    sql += ` AND dh.status = $${params.length}`;
  }

  sql += ' ORDER BY dh.created_at DESC';

  const result = await query(sql, params);
  return successResponse(result.data, 200, event);
};

/**
 * POST /api/v1/distributor/handovers
 */
export const handleSubmitHandover: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor');

  const { data: body, error: parseError } = parseBody<{
    handover_id: string;
    customer_national_id: string;
    scanned_imei: string;
    device_condition: Record<string, unknown>;
    device_photos: string[];
    signature_data_url: string;
    deposit_payment_method: string;
    deposit_transaction_ref: string;
  }>(event);
  if (parseError) return parseError;
  if (!body) return errorResponse('Missing request body', 400, undefined, event);

  const { data: handover } = await db
    .from('device_handovers')
    .select('*, distributors(user_id)')
    .eq('id', body.handover_id)
    .single()
    .execute();

  if (!handover) {
    return notFoundResponse('Handover', event);
  }

  if (handover.distributors?.user_id !== auth.userId) {
    return errorResponse('Access denied', 403, undefined, event);
  }

  await db
    .from('device_handovers')
    .update({
      device_condition: body.device_condition,
      device_photos: body.device_photos,
      customer_signature_url: body.signature_data_url,
      deposit_payment_method: body.deposit_payment_method,
      deposit_transaction_ref: body.deposit_transaction_ref,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.handover_id)
    .execute();

  const result = await handoverService.completeHandover(body.handover_id);

  return successResponse({
    success: result.success,
    handover_id: body.handover_id,
    loan_id: result.loan_id,
    commission_amount: result.commission.amount,
    next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    message: `Device handed over successfully. Loan ${result.loan_id} is now active.`,
  }, 200, event);
};

/**
 * POST /api/v1/distributor/handovers/:id/:action
 * Handles: verify-identity, verify-imei, verify-deposit, record-condition, complete
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
  if (ownerResult.rows.length === 0) {
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
      const result = await handoverService.verifyCustomerIdentity(handoverId, nationalId);
      return successResponse(result, 200, event);
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
      const result = await handoverService.verifyDepositPayment(handoverId);
      return successResponse(result, 200, event);
    }

    case 'record-condition': {
      const condition = (body as Record<string, unknown>)?.device_condition as Record<string, unknown>;
      if (!condition) {
        return errorResponse('device_condition is required', 400, undefined, event);
      }
      await handoverService.recordDeviceCondition(handoverId, condition as Parameters<typeof handoverService.recordDeviceCondition>[1]);
      return successResponse({ success: true }, 200, event);
    }

    case 'complete': {
      const result = await handoverService.completeHandover(handoverId);
      return successResponse(result, 200, event);
    }

    default:
      return errorResponse('Unknown action', 400, undefined, event);
  }
};
