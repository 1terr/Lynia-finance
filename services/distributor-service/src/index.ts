/**
 * Distributor Service Lambda Handler
 * Serves the distributor dashboard frontend -- profile, inventory,
 * handovers, commissions, and dashboard stats.
 */

import { createRouter } from '../../shared/utils/lambda-router';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleGetStats } from './handlers/stats';
import { handleGetInventory } from './handlers/inventory';
import {
  handleGetHandovers,
  handleSearchApprovedLoans,
  handleVerifyIdentity,
  handleVerifyDevice,
  handleVerifyDeposit,
  handleSubmitHandover,
  handleHandoverAction,
} from './handlers/handovers';
import { handleGetCommissions } from './handlers/commissions';
import { handleGetNotifications } from './handlers/notifications';

export const handler = createRouter({
  'GET /api/v1/distributor/profile': handleGetProfile,
  'PATCH /api/v1/distributor/profile': handleUpdateProfile,
  'GET /api/v1/distributor/stats': handleGetStats,
  'GET /api/v1/distributor/inventory': handleGetInventory,
  'GET /api/v1/distributor/handovers': handleGetHandovers,
  'GET /api/v1/distributor/handovers/search': handleSearchApprovedLoans,
  'POST /api/v1/distributor/handovers': handleSubmitHandover,
  'POST /api/v1/distributor/handovers/verify-identity': handleVerifyIdentity,
  'POST /api/v1/distributor/handovers/verify-device': handleVerifyDevice,
  'POST /api/v1/distributor/handovers/verify-deposit': handleVerifyDeposit,
  'POST /api/v1/distributor/handovers/:id/:action': handleHandoverAction,
  'GET /api/v1/distributor/commissions': handleGetCommissions,
  'GET /api/v1/distributor/notifications': handleGetNotifications,
}, { serviceName: 'distributor-service' });
