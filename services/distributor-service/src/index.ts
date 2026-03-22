/**
 * Distributor Service Lambda Handler
 * Serves the distributor dashboard frontend -- profile, inventory,
 * handovers, commissions, and dashboard stats.
 */

import { createRouter } from '../../shared/utils/lambda-router';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleGetStats } from './handlers/stats';
import { handleGetInventory } from './handlers/inventory';
import { handleGetDeviceMovements } from './handlers/device-movements';
import {
  handleGetHandovers,
  handleSearchApprovedLoans,
  handleVerifyIdentity,
  handleVerifyDevice,
  handleVerifyDeposit,
  handleSubmitHandover,
  handleHandoverAction,
  handleUploadHandoverPhoto,
} from './handlers/handovers';
import { handleGetCommissions } from './handlers/commissions';
import { handleGetNotifications } from './handlers/notifications';
import {
  handleGetTransfers as handleGetDistTransfers,
  handleGetPendingCount,
  handleGetTransferById as handleGetDistTransferById,
  handleConfirmTransfer,
  handleRejectTransfer,
  handleInitiateReturn,
  handleMarkNotificationRead,
} from './handlers/transfers';

export const handler = createRouter({
  'GET /api/v1/distributor/health': async (_event, _params, _auth) => ({
    statusCode: 200,
    body: JSON.stringify({ status: 'ok', service: 'distributor-service', timestamp: new Date().toISOString() }),
    headers: { 'Content-Type': 'application/json' },
  }),
  'GET /api/v1/distributor/profile': handleGetProfile,
  'PATCH /api/v1/distributor/profile': handleUpdateProfile,
  'GET /api/v1/distributor/stats': handleGetStats,
  'GET /api/v1/distributor/devices/:id/movements': handleGetDeviceMovements,
  'GET /api/v1/distributor/inventory': handleGetInventory,
  'GET /api/v1/distributor/handovers': handleGetHandovers,
  'GET /api/v1/distributor/handovers/search': handleSearchApprovedLoans,
  'POST /api/v1/distributor/handovers': handleSubmitHandover,
  'POST /api/v1/distributor/handovers/verify-identity': handleVerifyIdentity,
  'POST /api/v1/distributor/handovers/verify-device': handleVerifyDevice,
  'POST /api/v1/distributor/handovers/verify-deposit': handleVerifyDeposit,
  'POST /api/v1/distributor/handovers/upload-photo': handleUploadHandoverPhoto,
  'POST /api/v1/distributor/handovers/:id/:action': handleHandoverAction,
  'GET /api/v1/distributor/commissions': handleGetCommissions,
  'GET /api/v1/distributor/notifications': handleGetNotifications,
  'GET /api/v1/distributor/transfers/pending-count': handleGetPendingCount,
  'GET /api/v1/distributor/transfers': handleGetDistTransfers,
  'POST /api/v1/distributor/transfers/return': handleInitiateReturn,
  'POST /api/v1/distributor/transfers/:id/confirm': handleConfirmTransfer,
  'POST /api/v1/distributor/transfers/:id/reject': handleRejectTransfer,
  'GET /api/v1/distributor/transfers/:id': handleGetDistTransferById,
  'PATCH /api/v1/distributor/notifications/:id/read': handleMarkNotificationRead,
}, { serviceName: 'distributor-service' });
