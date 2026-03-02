import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, notFoundResponse } from '../../../shared/utils/response';
import { requireRole } from '../../../shared/middleware/authorization';
import { resolveDistributor } from '../helpers/resolve-distributor';

/**
 * GET /api/v1/distributor/notifications
 *
 * Returns the most recent notifications for this distributor.
 * Currently pulls from commission payments + inventory assignments.
 * A dedicated notifications table can be added later.
 */
export const handleGetNotifications: RouteHandler = async (event, _params, auth) => {
  requireRole(auth, 'distributor', 'super_admin', 'admin', 'operations_manager');

  const dist = await resolveDistributor(auth, event);

  if (!dist) {
    return notFoundResponse('Distributor', event);
  }

  // Pull recent commission payment events as notifications
  const commissionEvents = await query(
    `SELECT
       dc.id,
       'commission_paid' AS type,
       dc.commission_amount_usd AS amount,
       dc.paid_at AS created_at,
       dc.payment_status
     FROM distributor_commissions dc
     WHERE dc.distributor_id = $1
       AND dc.paid_at IS NOT NULL
     ORDER BY dc.paid_at DESC
     LIMIT 10`,
    [dist.id],
  );

  // Pull recent inventory assignments
  const inventoryEvents = await query(
    `SELECT
       ai.id,
       'inventory_assigned' AS type,
       d.manufacturer,
       d.model,
       ai.assigned_at AS created_at
     FROM agent_inventory ai
     JOIN devices d ON d.id = ai.device_id
     WHERE ai.distributor_id = $1
       AND ai.assigned_at > NOW() - INTERVAL '30 days'
     ORDER BY ai.assigned_at DESC
     LIMIT 10`,
    [dist.id],
  );

  // Combine and format
  const notifications = [
    ...commissionEvents.rows.map((row: Record<string, unknown>) => ({
      id: `comm_${row.id}`,
      type: 'commission_paid',
      title: 'Commission Paid',
      message: `Commission of $${Number(row.amount).toFixed(2)} has been paid.`,
      created_at: row.created_at,
      read: true,
    })),
    ...inventoryEvents.rows.map((row: Record<string, unknown>) => ({
      id: `inv_${row.id}`,
      type: 'inventory_assigned',
      title: 'New Inventory',
      message: `${row.manufacturer} ${row.model} added to your inventory.`,
      created_at: row.created_at,
      read: true,
    })),
  ]
    .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
    .slice(0, 20);

  return successResponse({ notifications, total: notifications.length }, event);
};
