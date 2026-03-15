/**
 * GET /payments/:paymentId
 * Get payment status
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { errorResponse, getSecurityHeaders } from '../../../shared/utils/response';
import { PaymentService } from '../payment-service';
import logger from '../../../shared/utils/logger';

const paymentService = new PaymentService();

export const handleGetPaymentStatus: RouteHandler = async (event, params, _auth) => {
  try {
    const paymentId = params.paymentId;

    const requestId = event.requestContext?.requestId || 'unknown';
    if (!paymentId) {
      return errorResponse('Payment ID required', 400, { requestId }, event);
    }

    const payment = await paymentService.checkPaymentStatus(paymentId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        payment_id: payment.id,
        loan_id: payment.loan_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        gateway: payment.gateway,
        gateway_transaction_id: payment.gateway_transaction_id,
        payment_type: payment.payment_type,
        initiated_at: payment.initiated_at,
        completed_at: payment.completed_at,
        failed_at: payment.failed_at
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    const requestId = event.requestContext?.requestId || 'unknown';
    logger.error('Error fetching payment status', { action: 'payment.get_status', status: 'failed', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return errorResponse('Failed to fetch payment status', 500, { requestId }, event);
  }
};
