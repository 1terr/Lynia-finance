/**
 * GET /scoring/:customerId
 *
 * Retrieve the most recent credit score for a customer.
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import { getSecurityHeaders } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

export const handleGetScore: RouteHandler = async (event, params, _auth) => {
  const customerId = params.customerId;

  if (!customerId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'customerId is required' }),
      headers: getSecurityHeaders(event)
    };
  }

  try {
    const { data, error } = await db
      .from('credit_scores')
      .select('*')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    if (error || !data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Credit score not found for this customer' }),
        headers: getSecurityHeaders(event)
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    logger.error('Failed to fetch credit score', {
      action: 'scoring.getScore',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch credit score',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};
