/**
 * Device Lock/Unlock Handlers
 *
 * Admin endpoints for managing device lock status, executing lock/unlock
 * commands, and viewing lock history. These are ADMIN operations — the
 * lock-service handles automated lock triggers separately.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse, notFoundResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';
import { auditLog } from './helpers';

// ─── GET /admin/devices/:id/lock-history ───

export const handleGetDeviceLockHistory: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    // Verify device exists
    const device = await queryOne('SELECT id FROM devices WHERE id = $1', [params.id]);
    if (!device.data) {
      return notFoundResponse('Device', event);
    }

    const result = await query(
      `SELECT
        id, device_id, loan_id, customer_id,
        action, reason, lock_type, days_past_due,
        executed_at, executed_by, execution_status,
        lock_provider, provider_response,
        created_at
      FROM device_locks
      WHERE device_id = $1
      ORDER BY created_at DESC`,
      [params.id]
    );

    if (result.error) {
      logger.error('Lock history query failed', {
        action: 'device.lock-history', status: 'failed',
        errorMessage: result.error.message,
      });
      return errorResponse('Failed to fetch lock history', 500, {}, event);
    }

    return successResponse(result.data, 200, event);
  } catch (error) {
    logger.error('Failed to fetch device lock history', {
      action: 'device.lock-history', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── POST /admin/devices/:id/lock ───

export const handleLockDevice: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { reason } = body;

    // Verify device exists and get current status
    const device = await queryOne<{ id: string; lock_status: string; customer_id: string }>(
      'SELECT id, lock_status, customer_id FROM devices WHERE id = $1',
      [params.id]
    );
    if (!device.data) {
      return notFoundResponse('Device', event);
    }
    if (device.data.lock_status === 'locked') {
      return errorResponse('Device is already locked', 409, {}, event);
    }

    const now = new Date().toISOString();

    // Update device lock status
    await query(
      `UPDATE devices SET lock_status = 'locked', updated_at = $2 WHERE id = $1`,
      [params.id, now]
    );

    // Insert lock record
    await queryOne(
      `INSERT INTO device_locks (device_id, customer_id, action, reason, lock_type, executed_at, executed_by, execution_status, created_at)
       VALUES ($1, $2, 'lock', $3, 'manual', $4, $5, 'success', $4)`,
      [params.id, device.data.customer_id || null, reason || 'Manual admin lock', now, auth.userId]
    );

    // Log lock event for effectiveness tracking
    await query(
      `INSERT INTO device_lock_events (device_id, event_type, triggered_by) VALUES ($1, 'lock', $2)`,
      [params.id, auth.userId]
    );

    await auditLog(auth, 'device.lock', 'device', params.id,
      `Device locked: ${reason || 'Manual admin lock'}`, { reason });

    return successResponse({ message: 'Device locked successfully' }, 200, event);
  } catch (error) {
    logger.error('Failed to lock device', {
      action: 'device.lock', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── POST /admin/devices/:id/unlock ───

export const handleUnlockDevice: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { reason } = body;

    // Verify device exists and get current status
    const device = await queryOne<{ id: string; lock_status: string; customer_id: string }>(
      'SELECT id, lock_status, customer_id FROM devices WHERE id = $1',
      [params.id]
    );
    if (!device.data) {
      return notFoundResponse('Device', event);
    }
    if (device.data.lock_status === 'unlocked') {
      return errorResponse('Device is already unlocked', 409, {}, event);
    }

    const now = new Date().toISOString();

    // Update device lock status
    await query(
      `UPDATE devices SET lock_status = 'unlocked', updated_at = $2 WHERE id = $1`,
      [params.id, now]
    );

    // Insert unlock record
    await queryOne(
      `INSERT INTO device_locks (device_id, customer_id, action, reason, lock_type, executed_at, executed_by, execution_status, created_at)
       VALUES ($1, $2, 'unlock', $3, 'manual', $4, $5, 'success', $4)`,
      [params.id, device.data.customer_id || null, reason || 'Manual admin unlock', now, auth.userId]
    );

    // Log unlock event for effectiveness tracking
    await query(
      `INSERT INTO device_lock_events (device_id, event_type, triggered_by) VALUES ($1, 'unlock', $2)`,
      [params.id, auth.userId]
    );

    await auditLog(auth, 'device.unlock', 'device', params.id,
      `Device unlocked: ${reason || 'Manual admin unlock'}`, { reason });

    return successResponse({ message: 'Device unlocked successfully' }, 200, event);
  } catch (error) {
    logger.error('Failed to unlock device', {
      action: 'device.unlock', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};

// ─── PATCH /admin/devices/:id/status ───

export const handleUpdateDeviceLockStatus: RouteHandler = async (event, params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { status } = body;

    if (!status || !['locked', 'unlocked', 'pending'].includes(status)) {
      return errorResponse('Invalid status. Must be locked, unlocked, or pending', 400, {}, event);
    }

    const device = await queryOne<{ id: string }>(
      'SELECT id FROM devices WHERE id = $1', [params.id]
    );
    if (!device.data) {
      return notFoundResponse('Device', event);
    }

    const now = new Date().toISOString();
    await query(
      `UPDATE devices SET lock_status = $1, updated_at = $2 WHERE id = $3`,
      [status, now, params.id]
    );

    await auditLog(auth, 'device.status.update', 'device', params.id,
      `Device lock status changed to ${status}`, { status });

    return successResponse({ message: 'Device status updated' }, 200, event);
  } catch (error) {
    logger.error('Failed to update device status', {
      action: 'device.status.update', status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An unexpected error occurred', 500, {}, event);
  }
};
