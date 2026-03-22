/**
 * Lock Effectiveness Report Handler
 *
 * Correlates device lock events with subsequent payments to measure
 * how effective locking is at recovering overdue payments.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger, { getRequestContext } from '../../../shared/utils/logger';

/** GET /api/v1/reports/lock-effectiveness */
export const handleGetLockEffectiveness: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Insufficient permissions', 403, {}, event);
  }

  try {
    const qs = event.queryStringParameters || {};

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];

    const dateFrom = qs.date_from || defaultFrom;
    const dateTo = qs.date_to || defaultTo;

    // Main effectiveness query: correlate lock events with subsequent payments
    const effectivenessResult = await query<{
      total_locks: string;
      paid_within_48h: string;
      paid_within_7d: string;
      paid_within_30d: string;
      paid_eventually: string;
      avg_hours_to_payment: string | null;
    }>(`
      WITH lock_events AS (
        SELECT
          dle.id AS lock_id,
          dle.device_id,
          dle.created_at AS lock_date,
          d.customer_id,
          l.id AS loan_id
        FROM device_lock_events dle
        JOIN devices d ON d.id = dle.device_id
        LEFT JOIN loans l ON l.customer_id = d.customer_id
          AND l.status IN ('active', 'disbursed', 'defaulted')
        WHERE dle.event_type = 'lock'
          AND dle.created_at >= $1
          AND dle.created_at <= ($2::date + INTERVAL '1 day')
      ),
      payment_after_lock AS (
        SELECT
          le.lock_id,
          le.lock_date,
          MIN(p.payment_date) AS first_payment_date,
          MIN(p.payment_date) - le.lock_date AS time_to_payment
        FROM lock_events le
        LEFT JOIN payments p ON p.customer_id = le.customer_id
          AND p.payment_date > le.lock_date
          AND p.status = 'confirmed'
        GROUP BY le.lock_id, le.lock_date
      )
      SELECT
        COUNT(*)::text AS total_locks,
        COUNT(CASE WHEN first_payment_date IS NOT NULL AND time_to_payment <= INTERVAL '48 hours' THEN 1 END)::text AS paid_within_48h,
        COUNT(CASE WHEN first_payment_date IS NOT NULL AND time_to_payment <= INTERVAL '7 days' THEN 1 END)::text AS paid_within_7d,
        COUNT(CASE WHEN first_payment_date IS NOT NULL AND time_to_payment <= INTERVAL '30 days' THEN 1 END)::text AS paid_within_30d,
        COUNT(CASE WHEN first_payment_date IS NOT NULL THEN 1 END)::text AS paid_eventually,
        AVG(EXTRACT(EPOCH FROM time_to_payment) / 3600)::numeric(10,1)::text AS avg_hours_to_payment
      FROM payment_after_lock
    `, [dateFrom, dateTo]);

    if (effectivenessResult.error) {
      logger.error('Lock effectiveness query failed', {
        action: 'reports.lock-effectiveness',
        status: 'failed',
        errorMessage: effectivenessResult.error.message,
      });
      return errorResponse('Failed to fetch lock effectiveness data', 500, {
        requestId: getRequestContext()?.requestId,
        timestamp: new Date().toISOString(),
      }, event);
    }

    const summary = effectivenessResult.data[0] || {
      total_locks: '0',
      paid_within_48h: '0',
      paid_within_7d: '0',
      paid_within_30d: '0',
      paid_eventually: '0',
      avg_hours_to_payment: null,
    };

    // Monthly trend: locks per month and conversion rate
    const trendResult = await query<{
      month: string;
      total_locks: string;
      paid_within_30d: string;
      conversion_rate: string;
    }>(`
      WITH monthly_locks AS (
        SELECT
          TO_CHAR(dle.created_at, 'YYYY-MM') AS month,
          dle.id AS lock_id,
          dle.created_at AS lock_date,
          d.customer_id
        FROM device_lock_events dle
        JOIN devices d ON d.id = dle.device_id
        WHERE dle.event_type = 'lock'
          AND dle.created_at >= $1
          AND dle.created_at <= ($2::date + INTERVAL '1 day')
      ),
      monthly_with_payments AS (
        SELECT
          ml.month,
          ml.lock_id,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM payments p
              WHERE p.customer_id = ml.customer_id
                AND p.payment_date > ml.lock_date
                AND p.payment_date <= ml.lock_date + INTERVAL '30 days'
                AND p.status = 'confirmed'
            ) THEN 1
            ELSE 0
          END AS paid_within_30d
        FROM monthly_locks ml
      )
      SELECT
        month,
        COUNT(*)::text AS total_locks,
        SUM(paid_within_30d)::text AS paid_within_30d,
        CASE
          WHEN COUNT(*) > 0 THEN ROUND(SUM(paid_within_30d)::numeric / COUNT(*) * 100, 1)::text
          ELSE '0'
        END AS conversion_rate
      FROM monthly_with_payments
      GROUP BY month
      ORDER BY month
    `, [dateFrom, dateTo]);

    if (trendResult.error) {
      logger.error('Lock effectiveness trend query failed', {
        action: 'reports.lock-effectiveness-trend',
        status: 'failed',
        errorMessage: trendResult.error.message,
      });
      // Return summary without trend on trend query failure
      return successResponse({
        summary: {
          total_locks: parseInt(summary.total_locks, 10),
          paid_within_48h: parseInt(summary.paid_within_48h, 10),
          paid_within_7d: parseInt(summary.paid_within_7d, 10),
          paid_within_30d: parseInt(summary.paid_within_30d, 10),
          paid_eventually: parseInt(summary.paid_eventually, 10),
          avg_hours_to_payment: summary.avg_hours_to_payment ? parseFloat(summary.avg_hours_to_payment) : null,
        },
        trend: [],
        date_from: dateFrom,
        date_to: dateTo,
        generated_at: new Date().toISOString(),
      }, 200, event);
    }

    return successResponse({
      summary: {
        total_locks: parseInt(summary.total_locks, 10),
        paid_within_48h: parseInt(summary.paid_within_48h, 10),
        paid_within_7d: parseInt(summary.paid_within_7d, 10),
        paid_within_30d: parseInt(summary.paid_within_30d, 10),
        paid_eventually: parseInt(summary.paid_eventually, 10),
        avg_hours_to_payment: summary.avg_hours_to_payment ? parseFloat(summary.avg_hours_to_payment) : null,
      },
      trend: trendResult.data.map((row) => ({
        month: row.month,
        total_locks: parseInt(row.total_locks, 10),
        paid_within_30d: parseInt(row.paid_within_30d, 10),
        conversion_rate: parseFloat(row.conversion_rate),
      })),
      date_from: dateFrom,
      date_to: dateTo,
      generated_at: new Date().toISOString(),
    }, 200, event);
  } catch (err) {
    logger.error('Lock effectiveness report failed', {
      action: 'reports.lock-effectiveness',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to generate lock effectiveness report', 500, {
      requestId: getRequestContext()?.requestId,
      timestamp: new Date().toISOString(),
    }, event);
  }
};
