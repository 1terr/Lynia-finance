/**
 * Distributor Service Lambda Handler
 * Serves the distributor dashboard frontend -- profile, inventory,
 * handovers, commissions, and dashboard stats.
 */

import { createRouter } from '../../shared/utils/lambda-router';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleGetStats } from './handlers/stats';
import { handleGetInventory } from './handlers/inventory';
import { handleGetHandovers, handleSubmitHandover, handleHandoverAction } from './handlers/handovers';
import { handleGetCommissions } from './handlers/commissions';

export const handler = createRouter({
  'GET /api/v1/distributor/profile': handleGetProfile,
  'PATCH /api/v1/distributor/profile': handleUpdateProfile,
  'GET /api/v1/distributor/stats': handleGetStats,
  'GET /api/v1/distributor/inventory': handleGetInventory,
  'GET /api/v1/distributor/handovers': handleGetHandovers,
  'POST /api/v1/distributor/handovers': handleSubmitHandover,
  'POST /api/v1/distributor/handovers/:id/:action': handleHandoverAction,
  'GET /api/v1/distributor/commissions': handleGetCommissions,
}, { serviceName: 'distributor-service' });
