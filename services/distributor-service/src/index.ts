import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db, query } from '../../shared/clients/database';
import {
  getSecurityHeaders,
  successResponse,
  errorResponse,
  notFoundResponse,
  parseBody,
} from '../../shared/utils/response';
import { getAuthContext, requireRole, AuthContext } from '../../shared/middleware/authorization';
import { HandoverService } from '../../lock-service/src/handover-service';

const handoverService = new HandoverService();

/**
 * Distributor Service Lambda Handler
 * Serves the distributor dashboard frontend — profile, inventory,
 * handovers, commissions, and dashboard stats.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // OPTIONS preflight
    if (method === 'OPTIONS') {
      return { statusCode: 200, body: '', headers: getSecurityHeaders(event) };
    }

    const auth = getAuthContext(event);

    // ── Profile ──
    if (path === '/api/v1/distributor/profile' && method === 'GET') {
      return await handleGetProfile(event, auth);
    }
    if (path === '/api/v1/distributor/profile' && method === 'PATCH') {
      return await handleUpdateProfile(event, auth);
    }

    // ── Dashboard Stats ──
    if (path === '/api/v1/distributor/stats' && method === 'GET') {
      return await handleGetStats(event, auth);
    }

    // ── Inventory ──
    if (path === '/api/v1/distributor/inventory' && method === 'GET') {
      return await handleGetInventory(event, auth);
    }

    // ── Handovers ──
    if (path === '/api/v1/distributor/handovers' && method === 'GET') {
      return await handleGetHandovers(event, auth);
    }
    if (path === '/api/v1/distributor/handovers' && method === 'POST') {
      return await handleSubmitHandover(event, auth);
    }

    // Handover step routes: /api/v1/distributor/handovers/{id}/{action}
    const handoverActionMatch = path.match(
      /^\/api\/v1\/distributor\/handovers\/([a-f0-9-]+)\/(verify-identity|verify-imei|verify-deposit|record-condition|complete)$/
    );
    if (handoverActionMatch && method === 'POST') {
      const handoverId = handoverActionMatch[1];
      const action = handoverActionMatch[2];
      return await handleHandoverAction(event, auth, handoverId, action);
    }

    // ── Commissions ──
    if (path === '/api/v1/distributor/commissions' && method === 'GET') {
      return await handleGetCommissions(event, auth);
    }

    return errorResponse('Not found', 404, undefined, event);
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number; code?: string };
    if (error.statusCode === 403) {
      return errorResponse(error.message, 403, undefined, event);
    }
    console.error('Distributor service error:', error);
    return errorResponse('Internal server error', 500, undefined, event);
  }
};

// ═══════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════

async function handleGetProfile(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  requireRole(auth, 'distributor');

  const { data: distributor, error } = await db
    .from('distributors')
    .select('*')
    .eq('user_id', auth.userId)
    .single()
    .execute();

  if (error || !distributor) {
    return notFoundResponse('Distributor profile', event);
  }

  return successResponse(distributor, 200, event);
}

async function handleUpdateProfile(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  requireRole(auth, 'distributor');

  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  // Only allow updating safe fields
  const allowedFields = [
    'phone_number', 'email', 'address', 'city', 'province',
    'bank_name', 'account_number', 'mobile_money_number',
    'latitude', 'longitude',
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body && field in (body as Record<string, unknown>)) {
      updates[field] = (body as Record<string, unknown>)[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse('No valid fields to update', 400, undefined, event);
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await db
    .from('distributors')
    .update(updates)
    .eq('user_id', auth.userId)
    .select()
    .single()
    .execute();

  if (error || !updated) {
    return errorResponse('Failed to update profile', 500, undefined, event);
  }

  return successResponse(updated, 200, event);
}

// ═══════════════════════════════════════════════════════
// Dashboard Stats
// ═══════════════════════════════════════════════════════

async function handleGetStats(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  requireRole(auth, 'distributor');

  // Get distributor record
  const { data: dist } = await db
    .from('distributors')
    .select('id, total_devices_distributed, current_inventory_count, total_commissions_earned, total_commissions_paid, pending_commissions, average_rating')
    .eq('user_id', auth.userId)
    .single()
    .execute();

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  // Count pending handovers
  const pendingResult = await query(
    `SELECT COUNT(*) as count FROM device_handovers
     WHERE distributor_id = $1 AND status NOT IN ('completed', 'failed', 'cancelled')`,
    [dist.id]
  );
  const pendingHandovers = parseInt(pendingResult.rows[0]?.count || '0', 10);

  // Count handovers this month
  const monthlyResult = await query(
    `SELECT COUNT(*) as count FROM device_handovers
     WHERE distributor_id = $1
       AND status = 'completed'
       AND completed_at >= date_trunc('month', CURRENT_DATE)`,
    [dist.id]
  );
  const monthlyHandovers = parseInt(monthlyResult.rows[0]?.count || '0', 10);

  return successResponse({
    total_devices_distributed: dist.total_devices_distributed,
    current_inventory: dist.current_inventory_count,
    pending_handovers: pendingHandovers,
    total_commissions_earned: dist.total_commissions_earned,
    total_commissions_paid: dist.total_commissions_paid,
    pending_commissions: dist.pending_commissions,
    average_rating: dist.average_rating,
    monthly_handovers: monthlyHandovers,
  }, 200, event);
}

// ═══════════════════════════════════════════════════════
// Inventory
// ═══════════════════════════════════════════════════════

async function handleGetInventory(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  requireRole(auth, 'distributor');

  const { data: dist } = await db
    .from('distributors')
    .select('id')
    .eq('user_id', auth.userId)
    .single()
    .execute();

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const result = await query(
    `SELECT
       d.id,
       d.manufacturer AS brand,
       d.model,
       d.imei,
       d.retail_price_usd AS retail_price,
       d.status,
       d.condition,
       ai.received_at
     FROM devices d
     JOIN agent_inventory ai ON ai.device_id = d.id
     WHERE ai.distributor_id = $1
       AND ai.status != 'sold'
     ORDER BY ai.received_at DESC`,
    [dist.id]
  );

  return successResponse(result.rows, 200, event);
}

// ═══════════════════════════════════════════════════════
// Handovers
// ═══════════════════════════════════════════════════════

async function handleGetHandovers(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  requireRole(auth, 'distributor');

  const { data: dist } = await db
    .from('distributors')
    .select('id')
    .eq('user_id', auth.userId)
    .single()
    .execute();

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
  return successResponse(result.rows, 200, event);
}

async function handleSubmitHandover(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
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

  // Get the handover to verify ownership
  const { data: handover } = await db
    .from('device_handovers')
    .select('*, distributors(user_id)')
    .eq('id', body.handover_id)
    .single()
    .execute();

  if (!handover) {
    return notFoundResponse('Handover', event);
  }

  // Verify distributor owns this handover
  if (handover.distributors?.user_id !== auth.userId) {
    return errorResponse('Access denied', 403, undefined, event);
  }

  // Update handover with submission data
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

  // Complete the handover workflow
  const result = await handoverService.completeHandover(body.handover_id);

  return successResponse({
    success: result.success,
    handover_id: body.handover_id,
    loan_id: result.loan_id,
    commission_amount: result.commission.amount,
    next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    message: `Device handed over successfully. Loan ${result.loan_id} is now active.`,
  }, 200, event);
}

async function handleHandoverAction(
  event: APIGatewayProxyEvent,
  auth: AuthContext,
  handoverId: string,
  action: string
): Promise<APIGatewayProxyResult> {
  requireRole(auth, 'distributor');

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
      // Simple IMEI check: 15 digits, matches expected
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
}

// ═══════════════════════════════════════════════════════
// Commissions
// ═══════════════════════════════════════════════════════

async function handleGetCommissions(
  event: APIGatewayProxyEvent,
  auth: AuthContext
): Promise<APIGatewayProxyResult> {
  requireRole(auth, 'distributor');

  const { data: dist } = await db
    .from('distributors')
    .select('id')
    .eq('user_id', auth.userId)
    .single()
    .execute();

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const result = await query(
    `SELECT
       dc.id,
       dc.loan_id,
       CONCAT(d.manufacturer, ' ', d.model) AS device_model,
       c.full_name AS customer_name,
       dc.device_retail_price_usd AS device_retail_price,
       dc.commission_percentage,
       dc.commission_amount_usd AS commission_amount,
       dc.payment_status,
       dc.calculation_date,
       dc.paid_at
     FROM distributor_commissions dc
     JOIN loans l ON l.id = dc.loan_id
     JOIN devices dev ON dev.id = dc.device_id
     JOIN customers c ON c.id = l.customer_id
     JOIN devices d ON d.id = dc.device_id
     WHERE dc.distributor_id = $1
     ORDER BY dc.calculation_date DESC`,
    [dist.id]
  );

  return successResponse(result.rows, 200, event);
}
