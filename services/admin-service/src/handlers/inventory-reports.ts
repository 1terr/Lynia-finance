import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query, queryOne, withTransaction } from '../../../shared/clients/database';
import { successResponse, errorResponse, getSecurityHeaders, parseBody } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger, { getRequestContext } from '../../../shared/utils/logger';

/**
 * GET /admin/reports/inventory
 * Stock summary by device model — counts by status, total value, aging
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
    by_model: byModel.data,
    totals: totals || {},
    aging: aging.data,
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
    by_type: byType.data,
    daily: daily.data,
    recent: recent.data,
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
      AND dm.is_active = true
    ORDER BY dm.manufacturer, dm.model_name
  `);

  return successResponse({
    low_stock_models: lowStock.data,
    out_of_stock_models: outOfStock.data,
    total_low_stock: lowStock.data.length,
    total_out_of_stock: outOfStock.data.length,
    generated_at: new Date().toISOString(),
  }, 200, event);
};

/**
 * POST /admin/inventory/reconcile
 * Compare device_models.available_stock vs actual device count.
 * Optionally fix discrepancies when { fix: true } is passed.
 */
export const handleReconcile: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  const { data: body } = parseBody<{ fix?: boolean }>(event);
  const shouldFix = body?.fix === true;

  try {
    // Compare tracked stock (device_models.available_stock) vs actual count
    // from devices table for statuses that represent "available" stock
    const { data: rows, error } = await query<{
      device_model_id: string;
      model_name: string;
      manufacturer: string;
      tracked_stock: number;
      actual_stock: number;
    }>(`
      SELECT
        dm.id AS device_model_id,
        dm.model_name,
        dm.manufacturer,
        dm.available_stock AS tracked_stock,
        COUNT(d.id) FILTER (WHERE d.status IN ('in_stock', 'assigned', 'reserved')) AS actual_stock
      FROM device_models dm
      LEFT JOIN devices d ON d.device_model_id = dm.id AND d.deleted_at IS NULL
      GROUP BY dm.id, dm.model_name, dm.manufacturer, dm.available_stock
      ORDER BY dm.manufacturer, dm.model_name
    `);

    if (error) {
      logger.error('Reconciliation query failed', {
        action: 'inventory.reconcile',
        status: 'failed',
        errorMessage: error.message,
      });
      return errorResponse('Failed to run reconciliation', 500, {
        requestId: getRequestContext()?.requestId,
        timestamp: new Date().toISOString(),
      }, event);
    }

    const discrepancies = rows
      .filter(r => Number(r.tracked_stock) !== Number(r.actual_stock))
      .map(r => ({
        device_model_id: r.device_model_id,
        model_name: `${r.manufacturer} ${r.model_name}`,
        tracked_stock: Number(r.tracked_stock),
        actual_stock: Number(r.actual_stock),
        difference: Number(r.actual_stock) - Number(r.tracked_stock),
      }));

    // Fix discrepancies if requested
    if (shouldFix && discrepancies.length > 0) {
      await withTransaction(async (tx) => {
        for (const d of discrepancies) {
          await tx(
            `UPDATE device_models SET available_stock = $1, updated_at = NOW() WHERE id = $2`,
            [d.actual_stock, d.device_model_id]
          );
        }
      });

      logger.info('Reconciliation fix applied', {
        action: 'inventory.reconcile',
        status: 'completed',
        modelsFixed: discrepancies.length,
      });
    }

    return successResponse({
      discrepancies,
      total_models_checked: rows.length,
      models_with_discrepancies: discrepancies.length,
      fixed: shouldFix && discrepancies.length > 0,
    }, 200, event);
  } catch (err) {
    logger.error('Reconciliation failed', {
      action: 'inventory.reconcile',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to run reconciliation', 500, {
      requestId: getRequestContext()?.requestId,
      timestamp: new Date().toISOString(),
    }, event);
  }
};

/**
 * Escape a value for CSV output.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 * Doubles any internal double quotes per RFC 4180.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /admin/reports/inventory/export
 * CSV export of full device inventory with joins to related tables.
 * Supports optional filters: ?status=, ?distributor_id=
 */
export const handleExportInventory: RouteHandler = async (event, _params, _auth) => {
  const params = event.queryStringParameters || {};
  const statusFilter = params.status;
  const distributorFilter = params.distributor_id;

  // Build WHERE clause with parameterized filters
  const whereClauses: string[] = ['d.deleted_at IS NULL'];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (statusFilter) {
    whereClauses.push(`d.status = $${paramIndex++}`);
    queryParams.push(statusFilter);
  }

  if (distributorFilter) {
    whereClauses.push(`d.distributor_id = $${paramIndex++}`);
    queryParams.push(distributorFilter);
  }

  const whereClause = whereClauses.join(' AND ');

  const result = await query<{
    imei: string;
    serial_number: string;
    manufacturer: string;
    model_name: string;
    status: string;
    lock_status: string;
    location: string;
    distributor_name: string;
    purchase_price_usd: number;
    retail_price_usd: number;
    condition: string;
    created_at: string;
    customer_name: string;
    loan_id: string;
  }>(`
    SELECT
      d.imei,
      d.serial_number,
      dm.manufacturer,
      dm.model_name,
      d.status,
      COALESCE(d.lock_status, 'unknown') AS lock_status,
      COALESCE(d.location, '') AS location,
      COALESCE(dist.business_name, '') AS distributor_name,
      COALESCE(d.purchase_price_usd, 0) AS purchase_price_usd,
      COALESCE(d.retail_price_usd, 0) AS retail_price_usd,
      COALESCE(d.condition, '') AS condition,
      d.created_at,
      CASE
        WHEN c.id IS NOT NULL THEN COALESCE(c.first_name || ' ' || c.last_name, '')
        ELSE ''
      END AS customer_name,
      COALESCE(l.id::text, '') AS loan_id
    FROM devices d
    LEFT JOIN device_models dm ON dm.id = d.device_model_id
    LEFT JOIN distributors dist ON dist.id = d.distributor_id
    LEFT JOIN loans l ON l.device_id = d.id AND l.status NOT IN ('cancelled', 'rejected')
    LEFT JOIN customers c ON c.id = l.customer_id
    WHERE ${whereClause}
    ORDER BY d.created_at DESC
  `, queryParams);

  if (result.error) {
    logger.error('Inventory CSV export failed', {
      action: 'reports.inventory-export',
      status: 'failed',
      meta: { error: result.error.message },
    });
    return errorResponse('Failed to export inventory data', 500, undefined, event);
  }

  // Build CSV
  const headers = [
    'IMEI', 'Serial Number', 'Manufacturer', 'Model', 'Status', 'Lock Status',
    'Location', 'Distributor Name', 'Purchase Price', 'Retail Price',
    'Condition', 'Created Date', 'Customer Name', 'Loan ID',
  ];

  const csvLines: string[] = [headers.join(',')];

  for (const row of result.data) {
    csvLines.push([
      escapeCsvValue(row.imei),
      escapeCsvValue(row.serial_number),
      escapeCsvValue(row.manufacturer),
      escapeCsvValue(row.model_name),
      escapeCsvValue(row.status),
      escapeCsvValue(row.lock_status),
      escapeCsvValue(row.location),
      escapeCsvValue(row.distributor_name),
      escapeCsvValue(row.purchase_price_usd),
      escapeCsvValue(row.retail_price_usd),
      escapeCsvValue(row.condition),
      escapeCsvValue(row.created_at),
      escapeCsvValue(row.customer_name),
      escapeCsvValue(row.loan_id),
    ].join(','));
  }

  const csvContent = csvLines.join('\n');
  const today = new Date().toISOString().slice(0, 10);

  const securityHeaders = getSecurityHeaders(event);

  return {
    statusCode: 200,
    headers: {
      ...securityHeaders,
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=inventory-export-${today}.csv`,
    },
    body: csvContent,
  };
};
