import { RouteHandler } from '../../../shared/utils/lambda-router';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { isAdminOrManager } from '../../../shared/middleware/authorization';
import logger from '../../../shared/utils/logger';

// ─── GET /api/v1/search?q=<term> ───

export const handleGlobalSearch: RouteHandler = async (event, _params, auth) => {
  if (!isAdminOrManager(auth)) {
    return errorResponse('Forbidden', 403, {}, event);
  }

  const qs = event.queryStringParameters || {};
  const searchTerm = qs.q?.trim();

  if (!searchTerm || searchTerm.length < 2) {
    return errorResponse(
      'Search query must be at least 2 characters',
      400,
      { code: 'VAL_REQ_001' },
      event
    );
  }

  const term = `%${searchTerm}%`;
  // Strip dashes and spaces for national ID matching
  const normalized = searchTerm.replace(/[-\s]/g, '');
  const normalizedTerm = `%${normalized}%`;

  logger.info({
    action: 'global_search',
    status: 'started',
    metadata: { queryLength: searchTerm.length },
  });

  try {
    const [customersResult, loansResult, paymentsResult, devicesResult] =
      await Promise.all([
        // ─── Customers ───
        query(
          `SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.phone_number,
            c.national_id,
            c.kyc_status,
            c.status,
            (SELECT COUNT(*) FROM loans WHERE customer_id = c.id) AS loan_count,
            (SELECT COUNT(*) FROM payments WHERE customer_id = c.id) AS payment_count,
            (SELECT COUNT(*) FROM devices WHERE customer_id = c.id) AS device_count
          FROM customers c
          WHERE c.deleted_at IS NULL
            AND (
              CONCAT(c.first_name, ' ', c.last_name) ILIKE $1
              OR c.phone_number ILIKE $1
              OR c.email ILIKE $1
              OR REPLACE(REPLACE(c.national_id, '-', ''), ' ', '') ILIKE $2
            )
          ORDER BY c.created_at DESC
          LIMIT 5`,
          [term, normalizedTerm]
        ),

        // ─── Loans ───
        query(
          `SELECT
            l.id,
            l.loan_number,
            l.status,
            l.outstanding_balance_usd,
            l.customer_id,
            CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
            l.days_past_due
          FROM loans l
          JOIN customers c ON c.id = l.customer_id
          WHERE l.deleted_at IS NULL
            AND (
              l.loan_number ILIKE $1
              OR CAST(l.fineract_loan_id AS TEXT) ILIKE $1
              OR CONCAT(c.first_name, ' ', c.last_name) ILIKE $1
              OR c.phone_number ILIKE $1
              OR REPLACE(REPLACE(c.national_id, '-', ''), ' ', '') ILIKE $2
            )
          ORDER BY l.created_at DESC
          LIMIT 5`,
          [term, normalizedTerm]
        ),

        // ─── Payments ───
        query(
          `SELECT
            p.id,
            p.reference_number,
            p.amount_usd,
            p.status,
            p.payment_date,
            p.customer_id,
            CONCAT(c.first_name, ' ', c.last_name) AS customer_name
          FROM payments p
          JOIN customers c ON c.id = p.customer_id
          WHERE (
              p.reference_number ILIKE $1
              OR p.transaction_id ILIKE $1
              OR CONCAT(c.first_name, ' ', c.last_name) ILIKE $1
              OR c.phone_number ILIKE $1
              OR REPLACE(REPLACE(c.national_id, '-', ''), ' ', '') ILIKE $2
            )
          ORDER BY p.created_at DESC
          LIMIT 5`,
          [term, normalizedTerm]
        ),

        // ─── Devices ───
        query(
          `SELECT
            d.id,
            d.imei,
            d.manufacturer,
            d.model,
            d.status,
            d.customer_id,
            CONCAT(c.first_name, ' ', c.last_name) AS customer_name
          FROM devices d
          LEFT JOIN customers c ON c.id = d.customer_id
          WHERE (
              d.imei ILIKE $1
              OR d.serial_number ILIKE $1
              OR CONCAT(c.first_name, ' ', c.last_name) ILIKE $1
              OR c.phone_number ILIKE $1
              OR REPLACE(REPLACE(c.national_id, '-', ''), ' ', '') ILIKE $2
            )
          ORDER BY d.created_at DESC
          LIMIT 5`,
          [term, normalizedTerm]
        ),
      ]);

    // Check for query errors
    if (customersResult.error || loansResult.error || paymentsResult.error || devicesResult.error) {
      const firstError = customersResult.error || loansResult.error || paymentsResult.error || devicesResult.error;
      logger.error({
        action: 'global_search',
        status: 'failed',
        metadata: { error: firstError?.message },
      });
      return errorResponse('Search failed', 500, {}, event);
    }

    const customers = customersResult.data.map((row) => ({
      ...row,
      loan_count: parseInt(String(row.loan_count) || '0'),
      payment_count: parseInt(String(row.payment_count) || '0'),
      device_count: parseInt(String(row.device_count) || '0'),
    }));

    const results = {
      customers,
      loans: loansResult.data,
      payments: paymentsResult.data,
      devices: devicesResult.data,
    };

    const total =
      customers.length +
      loansResult.data.length +
      paymentsResult.data.length +
      devicesResult.data.length;

    logger.info({
      action: 'global_search',
      status: 'completed',
      metadata: {
        total,
        customers: customers.length,
        loans: loansResult.data.length,
        payments: paymentsResult.data.length,
        devices: devicesResult.data.length,
      },
    });

    return successResponse({ results, query: searchTerm, total }, 200, event);
  } catch (error) {
    logger.error({
      action: 'global_search',
      status: 'failed',
      metadata: { error: (error as Error).message },
    });
    return errorResponse('Search failed', 500, {}, event);
  }
};
