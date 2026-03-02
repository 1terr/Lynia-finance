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
  const pendingHandovers = parseInt(pendingResult.data[0]?.count || '0', 10);

  const monthlyResult = await query(
    `SELECT COUNT(*) as count FROM device_handovers
     WHERE distributor_id = $1
       AND status = 'completed'
       AND completed_at >= date_trunc('month', CURRENT_DATE)`,
    [dist.id]
  );
  const monthlyHandovers = parseInt(monthlyResult.data[0]?.count || '0', 10);

  const lastMonthResult = await query(
    `SELECT COUNT(*) as count FROM device_handovers
     WHERE distributor_id = $1
       AND status = 'completed'
       AND completed_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
       AND completed_at < date_trunc('month', CURRENT_DATE)`,
    [dist.id]
  );
  const lastMonthHandovers = parseInt(lastMonthResult.data[0]?.count || '0', 10);

  // PostgreSQL DECIMAL columns return strings via the pg driver.
  // Convert to numbers so the frontend can call .toFixed() safely.
  return successResponse({
    total_devices_distributed: Number(dist.total_devices_distributed) || 0,
    current_inventory: Number(dist.current_inventory_count) || 0,
    pending_handovers: pendingHandovers,
    total_commissions_earned: Number(dist.total_commissions_earned) || 0,
    total_commissions_paid: Number(dist.total_commissions_paid) || 0,
    pending_commissions: Number(dist.pending_commissions) || 0,
    average_rating: Number(dist.average_rating) || 0,
    monthly_handovers: monthlyHandovers,
    last_month_handovers: lastMonthHandovers,
  }, 200, event);
};
