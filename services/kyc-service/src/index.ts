/**
 * KYC Service Lambda Handler
 *
 * Slim router entrypoint — all business logic lives in handler modules
 * under ./handlers/. This file only wires routes to handlers via the
 * shared lambda-router utility.
 */

import { createRouter } from '../../shared/utils/lambda-router';

import { handleInitiateKYC } from './handlers/initiate-kyc';
import { handleKYCCallback } from './handlers/callback-handler';
import { handleGetKYCStatus } from './handlers/get-kyc-status';
import { handleRetryKYC } from './handlers/retry-kyc';

export const handler = createRouter({
  'GET /kyc/health': async (_event, _params, _auth) => ({
    statusCode: 200,
    body: JSON.stringify({ status: 'ok', service: 'kyc-service', timestamp: new Date().toISOString() }),
    headers: { 'Content-Type': 'application/json' },
  }),
  'POST /kyc/initiate':     handleInitiateKYC,
  'POST /kyc/callback':     handleKYCCallback,
  'GET /kyc/:customerId':   handleGetKYCStatus,
  'POST /kyc/retry':        handleRetryKYC,
}, { serviceName: 'kyc-service', skipAuth: true });
