import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, notFoundResponse } from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { resolveDistributor } from '../helpers/resolve-distributor';

/**
 * GET /api/v1/distributor/stats
 */
export const handleGetStats: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(
    auth,
    event,
    'id, total_devices_distributed, current_inventory_count, total_commissions_earned, total_commissions_paid, pending_commissions, average_rating'
  );

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  const pendingResult = await query(
    `SELECT COUNT(*) as count FROM device_handovers
     WHERE distributor_id = $1 AND status NOT IN ('completed', 'failed', 'cancelled')`,
    [dist.id]
  );
  const pendingHandovers = parseInt(pendingResult.rows[0]?.count || '0', 10);

  const monthlyResult = await query(
    `SELECT COUNT(*) as count FROM device_handovers
     WHERE distributor_id = $1
       AND status = 'completed'
       AND completed_at >= date_trunc('month', CURRENT_DATE)`,
    [dist.id]
  );
  const monthlyHandovers = parseInt(monthlyResult.rows[0]?.count || '0', 10);

  return successResponse({
    total_devices_distributed: dist.total_devices_distributed,
    current_inventory: dist.current_inventory_count,
    pending_handovers: pendingHandovers,
    total_commissions_earned: dist.total_commissions_earned,
    total_commissions_paid: dist.total_commissions_paid,
    pending_commissions: dist.pending_commissions,
    average_rating: dist.average_rating,
    monthly_handovers: monthlyHandovers,
  }, 200, event);
};
