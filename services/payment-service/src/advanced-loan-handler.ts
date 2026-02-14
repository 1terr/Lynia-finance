/**
 * Advanced Loan Features - Lambda Handler (Phase 8)
 *
 * Unified API handler for:
 *  - Penalty configuration (CRUD)
 *  - Penalty application and waiver
 *  - Loan write-offs (request, approve, reject, reverse, recovery)
 *  - Loan rescheduling (request, approve, activate, reject, cancel)
 *
 * All endpoints require Cognito JWT authentication.
 * Write operations require admin or manager role.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  parseBody,
} from '../../shared/utils/response';
import {
  getAuthContext,
  requireRole,
  AuthContext,
} from '../../shared/middleware/authorization';

import {
  createPenaltyConfiguration,
  updatePenaltyConfiguration,
  getActivePenaltyConfigurations,
  getPenaltyConfiguration,
  calculatePenalties,
  applyPenalties,
  waivePenalty,
  getLoanPenalties,
  getLoanPenaltySummary,
  PenaltyError,
} from './penalty-service';

import {
  requestWriteOff,
  approveWriteOff,
  rejectWriteOff,
  reverseWriteOff,
  getWriteOff,
  getLoanWriteOffs,
  getPendingWriteOffs,
  getWriteOffSummary,
  checkWriteOffEligibility,
  recordRecovery,
  WriteOffError,
} from './write-off-service';

import {
  requestReschedule,
  approveReschedule,
  activateReschedule,
  rejectReschedule,
  cancelReschedule,
  acknowledgeReschedule,
  getReschedule,
  getLoanReschedules,
  getPendingReschedules,
  RescheduleError,
} from './reschedule-service';

// ===================================================================
// LAMBDA HANDLER
// ===================================================================

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // ---------------------------------------------------------------
    // PENALTY CONFIGURATION ROUTES
    // ---------------------------------------------------------------
    if (path === '/loans/penalties/configurations' && method === 'POST') {
      return await handleCreatePenaltyConfig(event);
    }
    if (path === '/loans/penalties/configurations' && method === 'GET') {
      return await handleGetPenaltyConfigs(event);
    }
    if (path.match(/\/loans\/penalties\/configurations\/[^/]+$/) && method === 'GET') {
      return await handleGetPenaltyConfig(event);
    }
    if (path.match(/\/loans\/penalties\/configurations\/[^/]+$/) && method === 'PUT') {
      return await handleUpdatePenaltyConfig(event);
    }

    // ---------------------------------------------------------------
    // PENALTY APPLICATION ROUTES
    // ---------------------------------------------------------------
    if (path.match(/\/loans\/[^/]+\/penalties\/calculate$/) && method === 'GET') {
      return await handleCalculatePenalties(event);
    }
    if (path.match(/\/loans\/[^/]+\/penalties\/apply$/) && method === 'POST') {
      return await handleApplyPenalties(event);
    }
    if (path.match(/\/loans\/[^/]+\/penalties$/) && method === 'GET') {
      return await handleGetLoanPenalties(event);
    }
    if (path.match(/\/loans\/[^/]+\/penalties\/summary$/) && method === 'GET') {
      return await handleGetPenaltySummary(event);
    }
    if (path.match(/\/loans\/penalties\/[^/]+\/waive$/) && method === 'POST') {
      return await handleWaivePenalty(event);
    }

    // ---------------------------------------------------------------
    // WRITE-OFF ROUTES
    // ---------------------------------------------------------------
    if (path === '/loans/write-offs' && method === 'POST') {
      return await handleRequestWriteOff(event);
    }
    if (path === '/loans/write-offs/pending' && method === 'GET') {
      return await handleGetPendingWriteOffs(event);
    }
    if (path === '/loans/write-offs/summary' && method === 'GET') {
      return await handleGetWriteOffSummary(event);
    }
    if (path.match(/\/loans\/[^/]+\/write-offs$/) && method === 'GET') {
      return await handleGetLoanWriteOffs(event);
    }
    if (path.match(/\/loans\/[^/]+\/write-offs\/eligibility$/) && method === 'GET') {
      return await handleCheckWriteOffEligibility(event);
    }
    if (path.match(/\/loans\/write-offs\/[^/]+\/approve$/) && method === 'POST') {
      return await handleApproveWriteOff(event);
    }
    if (path.match(/\/loans\/write-offs\/[^/]+\/reject$/) && method === 'POST') {
      return await handleRejectWriteOff(event);
    }
    if (path.match(/\/loans\/write-offs\/[^/]+\/reverse$/) && method === 'POST') {
      return await handleReverseWriteOff(event);
    }
    if (path.match(/\/loans\/write-offs\/[^/]+\/recovery$/) && method === 'POST') {
      return await handleRecordRecovery(event);
    }
    if (path.match(/\/loans\/write-offs\/[^/]+$/) && method === 'GET') {
      return await handleGetWriteOff(event);
    }

    // ---------------------------------------------------------------
    // RESCHEDULE ROUTES
    // ---------------------------------------------------------------
    if (path === '/loans/reschedules' && method === 'POST') {
      return await handleRequestReschedule(event);
    }
    if (path === '/loans/reschedules/pending' && method === 'GET') {
      return await handleGetPendingReschedules(event);
    }
    if (path.match(/\/loans\/[^/]+\/reschedules$/) && method === 'GET') {
      return await handleGetLoanReschedules(event);
    }
    if (path.match(/\/loans\/reschedules\/[^/]+\/approve$/) && method === 'POST') {
      return await handleApproveReschedule(event);
    }
    if (path.match(/\/loans\/reschedules\/[^/]+\/activate$/) && method === 'POST') {
      return await handleActivateReschedule(event);
    }
    if (path.match(/\/loans\/reschedules\/[^/]+\/reject$/) && method === 'POST') {
      return await handleRejectReschedule(event);
    }
    if (path.match(/\/loans\/reschedules\/[^/]+\/cancel$/) && method === 'POST') {
      return await handleCancelReschedule(event);
    }
    if (path.match(/\/loans\/reschedules\/[^/]+\/acknowledge$/) && method === 'POST') {
      return await handleAcknowledgeReschedule(event);
    }
    if (path.match(/\/loans\/reschedules\/[^/]+$/) && method === 'GET') {
      return await handleGetReschedule(event);
    }

    return notFoundResponse('Route', event);
  } catch (error) {
    return handleError(error, event);
  }
};

// ===================================================================
// PENALTY CONFIGURATION HANDLERS
// ===================================================================

async function handleCreatePenaltyConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const config = await createPenaltyConfiguration(body as never, auth.userId);
  return successResponse(config, 201, event);
}

async function handleGetPenaltyConfigs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const productId = event.queryStringParameters?.product_id;
  const configs = await getActivePenaltyConfigurations(productId);
  return successResponse(configs, 200, event);
}

async function handleGetPenaltyConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const configId = extractPathParam(event.path, 'configurations');
  const config = await getPenaltyConfiguration(configId);
  return successResponse(config, 200, event);
}

async function handleUpdatePenaltyConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const configId = extractPathParam(event.path, 'configurations');
  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const config = await updatePenaltyConfiguration(configId, body as never, auth.userId);
  return successResponse(config, 200, event);
}

// ===================================================================
// PENALTY APPLICATION HANDLERS
// ===================================================================

async function handleCalculatePenalties(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const loanId = extractLoanId(event.path);
  const calculations = await calculatePenalties(loanId);
  return successResponse(calculations, 200, event);
}

async function handleApplyPenalties(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const loanId = extractLoanId(event.path);
  const result = await applyPenalties(loanId, auth.userId);
  return successResponse(result, 200, event);
}

async function handleGetLoanPenalties(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const loanId = extractLoanId(event.path);
  const status = event.queryStringParameters?.status as never;
  const penalties = await getLoanPenalties(loanId, status);
  return successResponse(penalties, 200, event);
}

async function handleGetPenaltySummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const loanId = extractLoanId(event.path);
  const summary = await getLoanPenaltySummary(loanId);
  return successResponse(summary, 200, event);
}

async function handleWaivePenalty(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const penaltyId = extractPathParam(event.path, 'penalties');
  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const reason = (body as Record<string, string>)?.reason;
  if (!reason) {
    return validationErrorResponse('reason is required', undefined, event);
  }

  const waived = await waivePenalty(penaltyId, auth.userId, reason);
  return successResponse(waived, 200, event);
}

// ===================================================================
// WRITE-OFF HANDLERS
// ===================================================================

async function handleRequestWriteOff(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const writeOff = await requestWriteOff(body as never, auth.userId);
  return successResponse(writeOff, 201, event);
}

async function handleApproveWriteOff(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const writeOffId = extractPathParam(event.path, 'write-offs');
  const writeOff = await approveWriteOff(writeOffId, auth.userId);
  return successResponse(writeOff, 200, event);
}

async function handleRejectWriteOff(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const writeOffId = extractPathParam(event.path, 'write-offs');
  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const reason = (body as Record<string, string>)?.reason;
  if (!reason) {
    return validationErrorResponse('reason is required', undefined, event);
  }

  const writeOff = await rejectWriteOff(writeOffId, auth.userId, reason);
  return successResponse(writeOff, 200, event);
}

async function handleReverseWriteOff(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin');

  const writeOffId = extractPathParam(event.path, 'write-offs');
  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const reason = (body as Record<string, string>)?.reason;
  if (!reason) {
    return validationErrorResponse('reason is required', undefined, event);
  }

  const writeOff = await reverseWriteOff(writeOffId, auth.userId, reason);
  return successResponse(writeOff, 200, event);
}

async function handleGetWriteOff(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const writeOffId = extractPathParam(event.path, 'write-offs');
  const writeOff = await getWriteOff(writeOffId);
  return successResponse(writeOff, 200, event);
}

async function handleGetLoanWriteOffs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const loanId = extractLoanId(event.path);
  const writeOffs = await getLoanWriteOffs(loanId);
  return successResponse(writeOffs, 200, event);
}

async function handleGetPendingWriteOffs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const writeOffs = await getPendingWriteOffs();
  return successResponse(writeOffs, 200, event);
}

async function handleGetWriteOffSummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const summary = await getWriteOffSummary();
  return successResponse(summary, 200, event);
}

async function handleCheckWriteOffEligibility(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const loanId = extractLoanId(event.path);
  const eligibility = await checkWriteOffEligibility(loanId);
  return successResponse(eligibility, 200, event);
}

async function handleRecordRecovery(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const writeOffId = extractPathParam(event.path, 'write-offs');
  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const { amount, notes } = body as { amount: number; notes: string };
  if (!amount || !notes) {
    return validationErrorResponse('amount and notes are required', undefined, event);
  }

  const writeOff = await recordRecovery(writeOffId, amount, notes, auth.userId);
  return successResponse(writeOff, 200, event);
}

// ===================================================================
// RESCHEDULE HANDLERS
// ===================================================================

async function handleRequestReschedule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const reschedule = await requestReschedule(body as never, auth.userId);
  return successResponse(reschedule, 201, event);
}

async function handleApproveReschedule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const rescheduleId = extractPathParam(event.path, 'reschedules');
  const reschedule = await approveReschedule(rescheduleId, auth.userId);
  return successResponse(reschedule, 200, event);
}

async function handleActivateReschedule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const rescheduleId = extractPathParam(event.path, 'reschedules');
  const reschedule = await activateReschedule(rescheduleId, auth.userId);
  return successResponse(reschedule, 200, event);
}

async function handleRejectReschedule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const rescheduleId = extractPathParam(event.path, 'reschedules');
  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  const reason = (body as Record<string, string>)?.reason;
  if (!reason) {
    return validationErrorResponse('reason is required', undefined, event);
  }

  const reschedule = await rejectReschedule(rescheduleId, auth.userId, reason);
  return successResponse(reschedule, 200, event);
}

async function handleCancelReschedule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const rescheduleId = extractPathParam(event.path, 'reschedules');
  const reschedule = await cancelReschedule(rescheduleId, auth.userId);
  return successResponse(reschedule, 200, event);
}

async function handleAcknowledgeReschedule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Customer or any authenticated user can acknowledge
  getAuthContext(event);

  const rescheduleId = extractPathParam(event.path, 'reschedules');
  const reschedule = await acknowledgeReschedule(rescheduleId);
  return successResponse(reschedule, 200, event);
}

async function handleGetReschedule(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const rescheduleId = extractPathParam(event.path, 'reschedules');
  const reschedule = await getReschedule(rescheduleId);
  return successResponse(reschedule, 200, event);
}

async function handleGetLoanReschedules(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager', 'support');

  const loanId = extractLoanId(event.path);
  const reschedules = await getLoanReschedules(loanId);
  return successResponse(reschedules, 200, event);
}

async function handleGetPendingReschedules(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const auth = getAuthContext(event);
  requireRole(auth, 'admin', 'manager');

  const reschedules = await getPendingReschedules();
  return successResponse(reschedules, 200, event);
}

// ===================================================================
// HELPERS
// ===================================================================

/**
 * Extract a path parameter that follows a known segment.
 * e.g., /loans/write-offs/{id}/approve -> extracts {id} after 'write-offs'
 */
function extractPathParam(path: string, afterSegment: string): string {
  const segments = path.split('/').filter(Boolean);
  const idx = segments.indexOf(afterSegment);
  if (idx >= 0 && idx + 1 < segments.length) {
    return segments[idx + 1];
  }
  throw new Error(`Could not extract path parameter after '${afterSegment}'`);
}

/**
 * Extract loan ID from paths like /loans/{loanId}/penalties
 */
function extractLoanId(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const idx = segments.indexOf('loans');
  if (idx >= 0 && idx + 1 < segments.length) {
    return segments[idx + 1];
  }
  throw new Error('Could not extract loan ID from path');
}

/**
 * Central error handler for all service errors
 */
function handleError(error: unknown, event: APIGatewayProxyEvent): APIGatewayProxyResult {
  if (error instanceof PenaltyError) {
    const statusCode = error.code.includes('VAL') || error.code.includes('AMT') ? 400
      : error.code.includes('001') && error.message.includes('not found') ? 404
      : 422;
    return errorResponse(error.message, statusCode, { code: error.code }, event);
  }

  if (error instanceof WriteOffError) {
    const statusCode = error.code.includes('AMT') || error.code.includes('DUP') || error.code.includes('STATUS') ? 400
      : error.code.includes('001') && error.message.includes('not found') ? 404
      : 422;
    return errorResponse(error.message, statusCode, { code: error.code }, event);
  }

  if (error instanceof RescheduleError) {
    const statusCode = error.code.includes('TERM') || error.code.includes('RATE') || error.code.includes('HOLIDAY') || error.code.includes('DUP') || error.code.includes('LIMIT') ? 400
      : error.code.includes('001') && error.message.includes('not found') ? 404
      : 422;
    return errorResponse(error.message, statusCode, { code: error.code }, event);
  }

  // Auth errors
  if (error instanceof Error && (error as unknown as Record<string, unknown>).statusCode === 403) {
    return errorResponse(error.message, 403, undefined, event);
  }

  console.error('Unhandled error in advanced-loan-handler:', error);
  return errorResponse(
    'An unexpected error occurred. Please try again later.',
    500,
    undefined,
    event
  );
}
