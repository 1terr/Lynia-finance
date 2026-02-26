/**
 * GET /payments/:paymentId
 * Get payment status
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RouteHandler } from '../../../shared/utils/lambda-router';
import { getSecurityHeaders } from '../../../shared/utils/response';
import { PaymentService } from '../payment-service';
import logger from '../../../shared/utils/logger';

const paymentService = new PaymentService();

export const handleGetPaymentStatus: RouteHandler = async (event, params, _auth) => {
  try {
    const paymentId = params.paymentId;

    if (!paymentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Payment ID required' }),
        headers: getSecurityHeaders(event)
      };
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
    logger.error('Error fetching payment status', { action: 'payment.get_status', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch payment status',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};
