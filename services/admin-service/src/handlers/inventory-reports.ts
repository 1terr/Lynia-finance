import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

/**
 * GET /admin/reports/inventory
 * Stock summary by device model — counts by status, total value, aging
 *
 * NOTE: This handler uses `.rows` on the return value of `query()`, but
 * `query()` returns `{ data, error }` — `.rows` is undefined. This is a
 * known existing bug preserved as-is during extraction.
 */
export const handleInventoryReport: RouteHandler = async (event, _params, _auth) => {
  // Stock by model
  const byModel = await query(`
    SELECT
      dm.id AS device_model_id,
      dm.manufacturer,
      dm.model_name,
      dm.available_stock,
      dm.reorder_level,
      COUNT(d.id) AS total_units,
      COUNT(d.id) FILTER (WHERE d.status = 'in_stock') AS in_stock,
      COUNT(d.id) FILTER (WHERE d.status = 'assigned') AS assigned,
      COUNT(d.id) FILTER (WHERE d.status = 'reserved') AS reserved,
      COUNT(d.id) FILTER (WHERE d.status = 'sold') AS sold,
      COUNT(d.id) FILTER (WHERE d.status = 'damaged') AS damaged,
      COUNT(d.id) FILTER (WHERE d.status = 'returned') AS returned,
      COUNT(d.id) FILTER (WHERE d.status = 'lost') AS lost,
      COUNT(d.id) FILTER (WHERE d.status = 'written_off') AS written_off,
      COALESCE(SUM(d.retail_price_usd) FILTER (WHERE d.status = 'in_stock'), 0) AS in_stock_value,
      COALESCE(SUM(d.retail_price_usd), 0) AS total_value
    FROM device_models dm
    LEFT JOIN devices d ON d.device_model_id = dm.id AND d.deleted_at IS NULL
    GROUP BY dm.id, dm.manufacturer, dm.model_name, dm.available_stock, dm.reorder_level
    ORDER BY dm.manufacturer, dm.model_name
  `);

  // Overall totals
  const totals = await queryOne(`
    SELECT
      COUNT(*) AS total_devices,
      COUNT(*) FILTER (WHERE status = 'in_stock') AS total_in_stock,
      COUNT(*) FILTER (WHERE status = 'sold') AS total_sold,
      COUNT(*) FILTER (WHERE status = 'damaged') AS total_damaged,
      COUNT(*) FILTER (WHERE status = 'lost') AS total_lost,
      COUNT(*) FILTER (WHERE status = 'written_off') AS total_written_off,
      COALESCE(SUM(retail_price_usd), 0) AS total_inventory_value,
      COALESCE(SUM(retail_price_usd) FILTER (WHERE status = 'in_stock'), 0) AS available_inventory_value
    FROM devices
    WHERE deleted_at IS NULL
  `);

  // Aging — how long devices have been in_stock
  const aging = await query(`
    SELECT
      CASE
        WHEN NOW() - d.created_at < INTERVAL '30 days' THEN '0-30 days'
        WHEN NOW() - d.created_at < INTERVAL '60 days' THEN '31-60 days'
        WHEN NOW() - d.created_at < INTERVAL '90 days' THEN '61-90 days'
        ELSE '90+ days'
      END AS age_bracket,
      COUNT(*) AS count,
      COALESCE(SUM(d.retail_price_usd), 0) AS value
    FROM devices d
    WHERE d.status = 'in_stock' AND d.deleted_at IS NULL
    GROUP BY age_bracket
    ORDER BY
      CASE age_bracket
        WHEN '0-30 days' THEN 1
        WHEN '31-60 days' THEN 2
        WHEN '61-90 days' THEN 3
        ELSE 4
      END
  `);

  return successResponse({
    by_model: (byModel as any).rows,
    totals: totals || {},
    aging: (aging as any).rows,
    generated_at: new Date().toISOString(),
  }, 200, event);
};

/**
 * GET /admin/reports/inventory/movements
 * Movement summary — aggregated by movement_type, time period
 */
export const handleMovementsReport: RouteHandler = async (event, _params, _auth) => {
  const params = event.queryStringParameters || {};
  const days = parseInt(params.days || '30', 10);
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  // Movements by type
  const byType = await query(`
    SELECT
      movement_type,
      COUNT(*) AS count,
      MIN(created_at) AS earliest,
      MAX(created_at) AS latest
    FROM inventory_movements
    WHERE created_at >= $1
    GROUP BY movement_type
    ORDER BY count DESC
  `, [sinceDate.toISOString()]);

  // Daily movement counts
  const daily = await query(`
    SELECT
      DATE(created_at) AS date,
      movement_type,
      COUNT(*) AS count
    FROM inventory_movements
    WHERE created_at >= $1
    GROUP BY DATE(created_at), movement_type
    ORDER BY date DESC
  `, [sinceDate.toISOString()]);

  // Recent movements (last 50)
  const recent = await query(`
    SELECT
      im.id,
      im.device_id,
      im.movement_type,
      im.from_status,
      im.to_status,
      im.from_location,
      im.to_location,
      im.notes,
      im.created_at,
      d.imei AS device_imei,
      d.manufacturer,
      d.model AS device_model,
      au.email AS performed_by_name
    FROM inventory_movements im
    LEFT JOIN devices d ON d.id = im.device_id
    LEFT JOIN admin_users au ON au.id = im.performed_by
    WHERE im.created_at >= $1
    ORDER BY im.created_at DESC
    LIMIT 50
  `, [sinceDate.toISOString()]);

  return successResponse({
    period_days: days,
    by_type: (byType as any).rows,
    daily: (daily as any).rows,
    recent: (recent as any).rows,
    generated_at: new Date().toISOString(),
  }, 200, event);
};

/**
 * GET /admin/reports/inventory/low-stock
 * Models where available_stock <= reorder_level
 */
export const handleLowStockReport: RouteHandler = async (event, _params, _auth) => {
  const lowStock = await query(`
    SELECT
      dm.id,
      dm.manufacturer,
      dm.model_name,
      dm.available_stock,
      dm.reorder_level,
      dm.lead_time_days,
      dm.retail_price_usd,
      (dm.reorder_level - dm.available_stock) AS deficit,
      COUNT(d.id) FILTER (WHERE d.status = 'in_stock') AS actual_in_stock,
      COUNT(d.id) FILTER (WHERE d.status = 'reserved') AS reserved,
      COUNT(d.id) FILTER (WHERE d.status = 'assigned') AS assigned_to_distributors
    FROM device_models dm
    LEFT JOIN devices d ON d.device_model_id = dm.id AND d.deleted_at IS NULL
    WHERE dm.reorder_level > 0
    GROUP BY dm.id, dm.manufacturer, dm.model_name, dm.available_stock,
             dm.reorder_level, dm.lead_time_days, dm.retail_price_usd
    HAVING dm.available_stock <= dm.reorder_level
    ORDER BY (dm.reorder_level - dm.available_stock) DESC
  `);

  const outOfStock = await query(`
    SELECT
      dm.id,
      dm.manufacturer,
      dm.model_name,
      dm.retail_price_usd
    FROM device_models dm
    WHERE dm.available_stock = 0
      AND dm.active = true
    ORDER BY dm.manufacturer, dm.model_name
  `);

  return successResponse({
    low_stock_models: (lowStock as any).rows,
    out_of_stock_models: (outOfStock as any).rows,
    total_low_stock: (lowStock as any).rows.length,
    total_out_of_stock: (outOfStock as any).rows.length,
    generated_at: new Date().toISOString(),
  }, 200, event);
};
