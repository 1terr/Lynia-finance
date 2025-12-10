import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { HandoverService, InitiateHandoverRequest } from './handover-service';
import { LockManagementService } from './lock-management-service';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const handoverService = new HandoverService();
const lockService = new LockManagementService();

/**
 * Lock Service Lambda Handler
 * Handles device lock/unlock operations (Trustonic integration)
 */
export const handler = async (
  event: APIGatewayProxyEvent | ScheduledEvent
): Promise<APIGatewayProxyResult | void> => {
  try {
    // Handle scheduled event (cron job for automated lock processing)
    if ('source' in event && event.source === 'aws.events') {
      return await processAutomatedLocks();
    }

    // Handle API Gateway events
    const apiEvent = event as APIGatewayProxyEvent;
    console.log('Event:', JSON.stringify(apiEvent, null, 2));

    const path = apiEvent.path;
    const method = apiEvent.httpMethod;

    // Lock/Unlock endpoints
    if (path === '/locks/lock' && method === 'POST') {
      return await lockDevice(apiEvent);
    } else if (path === '/locks/unlock' && method === 'POST') {
      return await unlockDevice(apiEvent);
    } else if (path.startsWith('/locks/') && method === 'GET') {
      const deviceId = apiEvent.pathParameters?.deviceId;
      return await getLockStatus(deviceId!);
    }

    // Handover endpoints
    else if (path === '/handovers/check-readiness' && method === 'POST') {
      return await checkHandoverReadiness(apiEvent);
    } else if (path === '/handovers/initiate' && method === 'POST') {
      return await initiateHandover(apiEvent);
    } else if (path === '/handovers/verify-identity' && method === 'POST') {
      return await verifyIdentity(apiEvent);
    } else if (path === '/handovers/verify-deposit' && method === 'POST') {
      return await verifyDeposit(apiEvent);
    } else if (path === '/handovers/device-condition' && method === 'POST') {
      return await recordDeviceCondition(apiEvent);
    } else if (path === '/handovers/complete' && method === 'POST') {
      return await completeHandover(apiEvent);
    } else if (path.match(/\/handovers\/[^/]+$/) && method === 'GET') {
      const handoverId = apiEvent.pathParameters?.handoverId;
      return await getHandoverStatus(handoverId!);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error locking device:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to lock device',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error unlocking device:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to unlock device',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  }
}

async function getLockStatus(deviceId: string): Promise<APIGatewayProxyResult> {
  try {
    if (!deviceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'device_id is required' }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    const status = await lockService.getLockStatus(deviceId);

    return {
      statusCode: 200,
      body: JSON.stringify(status),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error getting lock status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get lock status',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  }
}

async function processAutomatedLocks(): Promise<void> {
  try {
    console.log('Processing automated device locks...');

    const result = await lockService.processAutomatedLocks();

    console.log(`Automated lock processing complete:`, result);

  } catch (error) {
    console.error('Error during automated lock processing:', error);
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    const readiness = await handoverService.checkHandoverReadiness(loan_id);

    return {
      statusCode: 200,
      body: JSON.stringify(readiness),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error checking handover readiness:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to check handover readiness',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error initiating handover:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to initiate handover',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    const result = await handoverService.verifyCustomerIdentity(handover_id, id_number);

    return {
      statusCode: result.verified ? 200 : 400,
      body: JSON.stringify(result),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error verifying identity:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to verify identity',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    const result = await handoverService.verifyDepositPayment(handover_id);

    return {
      statusCode: result.verified ? 200 : 400,
      body: JSON.stringify(result),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error verifying deposit:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to verify deposit',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    await handoverService.recordDeviceCondition(handover_id, device_condition);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Device condition recorded'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error recording device condition:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to record device condition',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    const result = await handoverService.completeHandover(handover_id);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error completing handover:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to complete handover',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  }
}

/**
 * GET /handovers/{handoverId}
 * Get handover status
 */
async function getHandoverStatus(handoverId: string): Promise<APIGatewayProxyResult> {
  try {
    if (!handoverId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'handover_id is required' }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      };
    }

    const handover = await handoverService.getHandoverStatus(handoverId);

    return {
      statusCode: 200,
      body: JSON.stringify(handover),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };

  } catch (error) {
    console.error('Error getting handover status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get handover status',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    };
  }
}
