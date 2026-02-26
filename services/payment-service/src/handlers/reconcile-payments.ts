/**
 * POST /payments/reconcile
 * Reconcile pending payments
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RouteHandler } from '../../../shared/utils/lambda-router';
import { getSecurityHeaders } from '../../../shared/utils/response';
import { PaymentService } from '../payment-service';
import logger from '../../../shared/utils/logger';

const paymentService = new PaymentService();

export const handleReconcilePayments: RouteHandler = async (event, _params, _auth) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const maxAge = body.max_age_hours || 24;

    const result = await paymentService.reconcilePayments(maxAge);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...result
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error reconciling payments', { action: 'payment.reconcile', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Reconciliation failed',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};
