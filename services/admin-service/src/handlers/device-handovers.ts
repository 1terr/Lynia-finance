/**
 * Device Handover Handlers
 *
 * Admin endpoints for listing and updating device handover status.
 * Handovers track the physical transfer of devices from distributors to customers.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse, notFoundResponse } from '../../../shared/utils/response';
import { isAdminOrManager, AuthContext } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

/**
 * Decrement device model available_stock when a handover is completed.
 * Updates the device status to 'assigned' (which also triggers the DB-level
 * stock sync trigger), then performs an explicit safety-net decrement on
 * device_models.available_stock. Logs a warning when stock reaches zero.
 *
 * Failures here must NOT block handover completion — inventory inaccuracy
 * is preferable to a stuck handover.
 */
async function decrementDeviceModelStock(
  deviceId: string,
  handoverId: string,
  auth: AuthContext
): Promise<void> {
  try {
    // Update device status to 'assigned' — the DB trigger (trg_sync_device_model_stock)
    // will auto-decrement available_stock if the device was previously 'in_stock'.
    await query(
      `UPDATE devices SET status = 'assigned', assigned_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'in_stock'`,
      [deviceId]
    );

    // Fetch device_model_id from the device
    const deviceResult = await queryOne<{ device_model_id: string | null }>(
      'SELECT device_model_id FROM devices WHERE id = $1',
      [deviceId]
    );

    const deviceModelId = deviceResult.data?.device_model_id;
    if (!deviceModelId) {
      logger.warn('Device has no device_model_id, skipping stock decrement', {
        action: 'device.handover.stock_decrement',
        status: 'skipped',
        deviceId,
        handoverId,
      });
      return;
    }

    // Safety-net: explicitly decrement available_stock, preventing it from going below 0.
    // This handles edge cases where the device status was already not 'in_stock'
    // and the DB trigger did not fire.
    const stockResult = await queryOne<{ available_stock: number }>(
      `UPDATE device_models
       SET available_stock = GREATEST(available_stock - 1, 0),
           updated_at = NOW()
       WHERE id = $1
       RETURNING available_stock`,
      [deviceModelId]
    );

    const newStock = stockResult.data?.available_stock ?? -1;

    logger.info('Device model stock decremented on handover completion', {
      action: 'device.handover.stock_decrement',
      status: 'completed',
      deviceId,
      deviceModelId,
      handoverId,
      newAvailableStock: newStock,
    });

    // Warn when stock is depleted
    if (newStock === 0) {
      logger.warn('Device model stock depleted — available_stock is now 0', {
        action: 'device.handover.stock_depleted',
        status: 'warning',
        deviceModelId,
        handoverId,
      });
    }

    // Audit log for the inventory change
    await auditLog(
      auth,
      'device.stock.decrement',
      'device_model',
      deviceModelId,
      `Stock decremented by 1 on handover completion (handover ${handoverId}). New stock: ${newStock}`,
      { handoverId, deviceId, deviceModelId, newAvailableStock: newStock }
    );
  } catch (error) {
    // Stock decrement failure must NOT block handover completion
    logger.error('Failed to decrement device model stock on handover completion', {
      action: 'device.handover.stock_decrement',
      status: 'failed',
      deviceId,
      handoverId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── GET /admin/devices/handovers ───

export const handleGetDeviceHandovers: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(qs.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(qs.limit || '25')));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (qs.status) {
      conditions.push(`h.status = $${paramIdx++}`);
      values.push(qs.status);
    }

    if (qs.search) {
      const term = `%${qs.search}%`;
      conditions.push(
        `(CONCAT(c.first_name, ' ', c.last_name) ILIKE $${paramIdx} OR c.phone_number ILIKE $${paramIdx})`
      );
      paramIdx++;
      values.push(term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM device_handovers h
       LEFT JOIN customers c ON c.id = h.customer_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.data?.count || '0');

    // Fetch with JOINs for customer, device, distributor info
    const result = await query(
      `SELECT
        h.id, h.loan_id, h.customer_id, h.device_id, h.distributor_id,
        h.status, h.app_installed, h.app_configured, h.lock_test_passed,
        h.scheduled_date, h.scheduled_time,
        h.completed_at, h.cancelled_at, h.cancellation_reason,
        h.failure_reason, h.notes,
        h.created_at, h.updated_at,
        json_build_object(
          'id', c.id, 'first_name', c.first_name, 'last_name', c.last_name,
          'phone_number', c.phone_number
        ) AS customer,
        json_build_object(
          'id', d.id, 'imei', d.imei, 'model', d.model, 'serial_number', d.serial_number
        ) AS device,
        json_build_object(
          'id', dist.id, 'name', dist.business_name
        ) AS distributor
      FROM device_handovers h
      LEFT JOIN customers c ON c.id = h.customer_id
      LEFT JOIN devices d ON d.id = h.device_id
      LEFT JOIN distributors dist ON dist.id = h.distributor_id
      ${whereClause}
      ORDER BY h.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, limit, offset]
    );

    if (result.error) {
      logger.error('Handover list query failed', {
        action: 'device.handovers.list', status: 'failed',
        errorMessage: result.error.message,
      });
      return errorResponse('Failed to fetch handovers', 500, {}, event);
    }

    return successResponse({
      data: result.data,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    }, 200, event);
  } catch (error) {
    logger.error('Failed to fetch device handovers', {
      action: 'device.handovers.list', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── PATCH /admin/devices/handovers/:id ───

export const handleUpdateHandoverStatus: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { status, notes } = body;

    if (!status) {
      return errorResponse('status is required', 400, {}, event);
    }

    const validStatuses = ['initiated', 'identity_verified', 'deposit_verified', 'device_inspected', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400, {}, event);
    }

    // Check handover exists
    const existing = await queryOne<{ id: string; status: string; device_id: string }>(
      'SELECT id, status, device_id FROM device_handovers WHERE id = $1',
      [params.id]
    );
    if (!existing.data) {
      return notFoundResponse('Handover', event);
    }

    const now = new Date().toISOString();
    const updates: string[] = [`status = $1`, `updated_at = $2`];
    const values: unknown[] = [status, now];
    let paramIdx = 3;

    if (notes) {
      updates.push(`notes = $${paramIdx++}`);
      values.push(notes);
    }

    if (status === 'completed') {
      updates.push(`completed_at = $${paramIdx++}`);
      values.push(now);
    }
    if (status === 'cancelled') {
      updates.push(`cancelled_at = $${paramIdx++}`);
      values.push(now);
      if (body.cancellation_reason) {
        updates.push(`cancellation_reason = $${paramIdx++}`);
        values.push(body.cancellation_reason);
      }
    }
    if (status === 'failed' && body.failure_reason) {
      updates.push(`failure_reason = $${paramIdx++}`);
      values.push(body.failure_reason);
    }

    values.push(params.id);
    await query(
      `UPDATE device_handovers SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      values
    );

    // Decrement device model stock when handover is completed
    if (status === 'completed' && existing.data.device_id) {
      await decrementDeviceModelStock(existing.data.device_id, params.id, auth);
    }

    await auditLog(auth, 'device.handover.update', 'device_handover', params.id,
      `Handover status changed from ${existing.data.status} to ${status}`,
      { previous_status: existing.data.status, new_status: status, notes });

    return successResponse({ message: 'Handover status updated' }, 200, event);
  } catch (error) {
    logger.error('Failed to update handover status', {
      action: 'device.handover.update', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};
