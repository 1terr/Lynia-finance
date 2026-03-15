/**
 * Lock Service Lambda Handler
 * Handles device lock/unlock operations (Trustonic integration)
 * and device handover workflows.
 *
 * Migrated from if/else routing to createRouter() for consistency
 * with other services.
 */

import { createRouter, RouteHandler } from '../../shared/utils/lambda-router';
import { successResponse, errorResponse, validationErrorResponse, getSecurityHeaders } from '../../shared/utils/response';
import { HandoverService, InitiateHandoverRequest } from './handover-service';
import { LockManagementService } from './lock-management-service';
import logger from '../../shared/utils/logger';

const handoverService = new HandoverService();
const lockService = new LockManagementService();

// ─── Lock Handlers ───────────────────────────────────────────────────

const handleLockDevice: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');
  const { device_id, reason, admin_user_id } = body;

  if (!device_id || !reason) {
    return validationErrorResponse('Missing required fields', {
      device_id: !device_id ? 'device_id is required' : '',
      reason: !reason ? 'reason is required' : '',
    }, event);
  }

  await lockService.lockDevice(
    device_id,
    reason,
    admin_user_id ? 'admin' : 'system',
    admin_user_id
  );

  const status = await lockService.getLockStatus(device_id);

  return successResponse({
    device_id: status.device_id,
    lock_status: status.lock_status,
    locked_at: status.locked_at,
  }, 200, event);
};

const handleUnlockDevice: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');
  const { device_id, reason, admin_user_id } = body;

  if (!device_id || !reason) {
    return validationErrorResponse('Missing required fields', {
      device_id: !device_id ? 'device_id is required' : '',
      reason: !reason ? 'reason is required' : '',
    }, event);
  }

  await lockService.unlockDevice(
    device_id,
    reason,
    admin_user_id ? 'admin' : 'system',
    admin_user_id
  );

  const status = await lockService.getLockStatus(device_id);

  return successResponse({
    device_id: status.device_id,
    lock_status: status.lock_status,
    unlocked_at: status.unlocked_at,
  }, 200, event);
};

const handleGetLockStatus: RouteHandler = async (event, params, _auth) => {
  const deviceId = params.deviceId;

  if (!deviceId) {
    return validationErrorResponse('device_id is required', undefined, event);
  }

  const status = await lockService.getLockStatus(deviceId);

  return successResponse(status, 200, event);
};

const handleProcessAutomatedLocks: RouteHandler = async (event, _params, _auth) => {
  logger.info('Processing automated device locks', { action: 'lock.processAutomated' });

  const result = await lockService.processAutomatedLocks();

  logger.info('Automated lock processing complete', { action: 'lock.processAutomated', ...result });

  return successResponse({ result }, 200, event);
};

// ─── Handover Handlers ───────────────────────────────────────────────

const handleCheckHandoverReadiness: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');
  const { loan_id } = body;

  if (!loan_id) {
    return validationErrorResponse('loan_id is required', undefined, event);
  }

  const readiness = await handoverService.checkHandoverReadiness(loan_id);

  return successResponse(readiness, 200, event);
};

const handleInitiateHandover: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');
  const request: InitiateHandoverRequest = body;

  const required = ['loan_id', 'device_id', 'customer_id', 'distributor_id', 'handover_location', 'handed_over_by'] as const;
  const missing = required.filter(field => !request[field as keyof InitiateHandoverRequest]);

  if (missing.length > 0) {
    return validationErrorResponse('Missing required fields', Object.fromEntries(
      missing.map(f => [f, `${f} is required`])
    ), event);
  }

  const handover = await handoverService.initiateHandover(request);

  return successResponse({
    handover_id: handover.id,
    status: handover.status,
  }, 200, event);
};

const handleVerifyIdentity: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');
  const { handover_id, id_number } = body;

  if (!handover_id || !id_number) {
    return validationErrorResponse('Missing required fields', {
      handover_id: !handover_id ? 'handover_id is required' : '',
      id_number: !id_number ? 'id_number is required' : '',
    }, event);
  }

  const result = await handoverService.verifyCustomerIdentity(handover_id, id_number);

  return {
    statusCode: result.verified ? 200 : 400,
    body: JSON.stringify({ success: result.verified, data: result }),
    headers: getSecurityHeaders(event),
  };
};

const handleVerifyDeposit: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');
  const { handover_id } = body;

  if (!handover_id) {
    return validationErrorResponse('handover_id is required', undefined, event);
  }

  const result = await handoverService.verifyDepositPayment(handover_id);

  return {
    statusCode: result.verified ? 200 : 400,
    body: JSON.stringify({ success: result.verified, data: result }),
    headers: getSecurityHeaders(event),
  };
};

const handleRecordDeviceCondition: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');
  const { handover_id, device_condition } = body;

  if (!handover_id || !device_condition) {
    return validationErrorResponse('Missing required fields', {
      handover_id: !handover_id ? 'handover_id is required' : '',
      device_condition: !device_condition ? 'device_condition is required' : '',
    }, event);
  }

  await handoverService.recordDeviceCondition(handover_id, device_condition);

  return successResponse({ message: 'Device condition recorded' }, 200, event);
};

const handleCompleteHandover: RouteHandler = async (event, _params, _auth) => {
  const body = JSON.parse(event.body || '{}');
  const { handover_id } = body;

  if (!handover_id) {
    return validationErrorResponse('handover_id is required', undefined, event);
  }

  const result = await handoverService.completeHandover(handover_id);

  return successResponse(result, 200, event);
};

const handleGetHandoverStatus: RouteHandler = async (event, params, _auth) => {
  const handoverId = params.handoverId;

  if (!handoverId) {
    return validationErrorResponse('handover_id is required', undefined, event);
  }

  const handover = await handoverService.getHandoverStatus(handoverId);

  return successResponse(handover, 200, event);
};

// ─── Router ──────────────────────────────────────────────────────────

export const handler = createRouter({
  // Lock routes (static before parameterized)
  'POST /locks/lock': handleLockDevice,
  'POST /locks/unlock': handleUnlockDevice,
  'POST /locks/process-scheduled': handleProcessAutomatedLocks,
  'GET /locks/:deviceId': handleGetLockStatus,

  // Handover routes (static before parameterized)
  'POST /handovers/check-readiness': handleCheckHandoverReadiness,
  'POST /handovers/initiate': handleInitiateHandover,
  'POST /handovers/verify-identity': handleVerifyIdentity,
  'POST /handovers/verify-deposit': handleVerifyDeposit,
  'POST /handovers/device-condition': handleRecordDeviceCondition,
  'POST /handovers/complete': handleCompleteHandover,
  'GET /handovers/:handoverId': handleGetHandoverStatus,
}, { serviceName: 'lock-service', skipAuth: true });
