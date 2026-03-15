/**
 * POST /payments/reconcile
 * Reconcile pending payments
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { errorResponse, getSecurityHeaders } from '../../../shared/utils/response';
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
    const requestId = event.requestContext?.requestId || 'unknown';
    logger.error('Error reconciling payments', { action: 'payment.reconcile', status: 'failed', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return errorResponse('Reconciliation failed', 500, { requestId }, event);
  }
};
