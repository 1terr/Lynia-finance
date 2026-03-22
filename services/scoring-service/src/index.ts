/**
 * Scoring Service Lambda Handler
 *
 * Slim router entrypoint — all business logic lives in handler modules
 * under ./handlers/ and scoring algorithm in ./scoring/. This file only
 * wires routes to handlers via the shared lambda-router utility.
 */

import { createRouter } from '../../shared/utils/lambda-router';

import { handleCalculateScore } from './handlers/calculate-score';
import { handleGetScore } from './handlers/get-score';
import { handleVerifyOrganization } from './handlers/verify-organization';

export const handler = createRouter({
  'GET /scoring/health': async (_event, _params, _auth) => ({
    statusCode: 200,
    body: JSON.stringify({ status: 'ok', service: 'scoring-service', timestamp: new Date().toISOString() }),
    headers: { 'Content-Type': 'application/json' },
  }),
  'POST /scoring/calculate':            handleCalculateScore,
  'POST /scoring/verify-organization':  handleVerifyOrganization,
  'GET /scoring/:customerId':           handleGetScore,
}, { serviceName: 'scoring-service', skipAuth: true });
