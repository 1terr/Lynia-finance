import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { HandoverService, InitiateHandoverRequest } from './handover-service';
import { LockManagementService } from './lock-management-service';
import { getSecurityHeaders } from '../../shared/utils/response';
import logger from '../../shared/utils/logger';

const handoverService = new HandoverService();
const lockService = new LockManagementService();

/**
 * Lock Service Lambda Handler
 * Handles device lock/unlock operations (Trustonic integration)
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // Lock/Unlock endpoints
    if (path === '/locks/lock' && method === 'POST') {
      return await lockDevice(event);
    } else if (path === '/locks/unlock' && method === 'POST') {
      return await unlockDevice(event);
    } else if (path === '/locks/process-scheduled' && method === 'POST') {
      return await processAutomatedLocksApi(event);
    } else if (path.startsWith('/locks/') && method === 'GET') {
      const deviceId = event.pathParameters?.deviceId;
      return await getLockStatus(deviceId!, event);
    }

    // Handover endpoints
    else if (path === '/handovers/check-readiness' && method === 'POST') {
      return await checkHandoverReadiness(event);
    } else if (path === '/handovers/initiate' && method === 'POST') {
      return await initiateHandover(event);
    } else if (path === '/handovers/verify-identity' && method === 'POST') {
      return await verifyIdentity(event);
    } else if (path === '/handovers/verify-deposit' && method === 'POST') {
      return await verifyDeposit(event);
    } else if (path === '/handovers/device-condition' && method === 'POST') {
      return await recordDeviceCondition(event);
    } else if (path === '/handovers/complete' && method === 'POST') {
      return await completeHandover(event);
    } else if (path.match(/\/handovers\/[^/]+$/) && method === 'GET') {
      const handoverId = event.pathParameters?.handoverId;
      return await getHandoverStatus(handoverId!, event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    logger.error('Lock service handler error', { action: 'lock.handler', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};

async function lockDevice(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { device_id, reason, admin_user_id } = body;

    if (!device_id || !reason) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['device_id', 'reason']
        }),
        headers: getSecurityHeaders(event)
      };
    }

    await lockService.lockDevice(
      device_id,
      reason,
      admin_user_id ? 'admin' : 'system',
      admin_user_id
    );

    const status = await lockService.getLockStatus(device_id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        device_id: status.device_id,
        lock_status: status.lock_status,
        locked_at: status.locked_at
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error locking device', { action: 'lock.lockDevice', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to lock device',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

async function unlockDevice(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { device_id, reason, admin_user_id } = body;

    if (!device_id || !reason) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['device_id', 'reason']
        }),
        headers: getSecurityHeaders(event)
      };
    }

    await lockService.unlockDevice(
      device_id,
      reason,
      admin_user_id ? 'admin' : 'system',
      admin_user_id
    );

    const status = await lockService.getLockStatus(device_id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        device_id: status.device_id,
        lock_status: status.lock_status,
        unlocked_at: status.unlocked_at
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error unlocking device', { action: 'lock.unlockDevice', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to unlock device',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

async function getLockStatus(deviceId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!deviceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'device_id is required' }),
        headers: getSecurityHeaders(event)
      };
    }

    const status = await lockService.getLockStatus(deviceId);

    return {
      statusCode: 200,
      body: JSON.stringify(status),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error getting lock status', { action: 'lock.getLockStatus', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get lock status',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

async function processAutomatedLocksApi(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    logger.info('Processing automated device locks', { action: 'lock.processAutomated' });

    const result = await lockService.processAutomatedLocks();

    logger.info('Automated lock processing complete', { action: 'lock.processAutomated', ...result });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    logger.error('Error during automated lock processing', { action: 'lock.processAutomated', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process automated locks',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

/**
 * POST /handovers/check-readiness
 * Check if loan is ready for handover
 */
async function checkHandoverReadiness(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { loan_id } = body;

    if (!loan_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'loan_id is required' }),
        headers: getSecurityHeaders(event)
      };
    }

    const readiness = await handoverService.checkHandoverReadiness(loan_id);

    return {
      statusCode: 200,
      body: JSON.stringify(readiness),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error checking handover readiness', { action: 'lock.handover.checkReadiness', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to check handover readiness',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

/**
 * POST /handovers/initiate
 * Initiate device handover workflow
 */
async function initiateHandover(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const request: InitiateHandoverRequest = body;

    // Validate required fields
    const required = ['loan_id', 'device_id', 'customer_id', 'distributor_id', 'handover_location', 'handed_over_by'];
    const missing = required.filter(field => !request[field as keyof InitiateHandoverRequest]);

    if (missing.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: missing
        }),
        headers: getSecurityHeaders(event)
      };
    }

    const handover = await handoverService.initiateHandover(request);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        handover_id: handover.id,
        status: handover.status
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error initiating handover', { action: 'lock.handover.initiate', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to initiate handover',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

/**
 * POST /handovers/verify-identity
 * Verify customer identity at handover
 */
async function verifyIdentity(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { handover_id, id_number } = body;

    if (!handover_id || !id_number) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['handover_id', 'id_number']
        }),
        headers: getSecurityHeaders(event)
      };
    }

    const result = await handoverService.verifyCustomerIdentity(handover_id, id_number);

    return {
      statusCode: result.verified ? 200 : 400,
      body: JSON.stringify(result),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error verifying identity', { action: 'lock.handover.verifyIdentity', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to verify identity',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

/**
 * POST /handovers/verify-deposit
 * Verify deposit payment (CRITICAL CHECKPOINT)
 */
async function verifyDeposit(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { handover_id } = body;

    if (!handover_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'handover_id is required' }),
        headers: getSecurityHeaders(event)
      };
    }

    const result = await handoverService.verifyDepositPayment(handover_id);

    return {
      statusCode: result.verified ? 200 : 400,
      body: JSON.stringify(result),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error verifying deposit', { action: 'lock.handover.verifyDeposit', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to verify deposit',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

/**
 * POST /handovers/device-condition
 * Record device condition inspection
 */
async function recordDeviceCondition(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { handover_id, device_condition } = body;

    if (!handover_id || !device_condition) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['handover_id', 'device_condition']
        }),
        headers: getSecurityHeaders(event)
      };
    }

    await handoverService.recordDeviceCondition(handover_id, device_condition);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Device condition recorded'
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error recording device condition', { action: 'lock.handover.recordDeviceCondition', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to record device condition',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

/**
 * POST /handovers/complete
 * Complete handover and activate loan
 */
async function completeHandover(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { handover_id } = body;

    if (!handover_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'handover_id is required' }),
        headers: getSecurityHeaders(event)
      };
    }

    const result = await handoverService.completeHandover(handover_id);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error completing handover', { action: 'lock.handover.complete', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to complete handover',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

/**
 * GET /handovers/{handoverId}
 * Get handover status
 */
async function getHandoverStatus(handoverId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!handoverId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'handover_id is required' }),
        headers: getSecurityHeaders(event)
      };
    }

    const handover = await handoverService.getHandoverStatus(handoverId);

    return {
      statusCode: 200,
      body: JSON.stringify(handover),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error getting handover status', { action: 'lock.handover.getStatus', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get handover status',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}
