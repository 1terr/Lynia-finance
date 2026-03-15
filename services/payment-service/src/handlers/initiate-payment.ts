/**
 * POST /payments/initiate
 * Initiate a payment
 */

import { RouteHandler } from '../../../shared/utils/lambda-router';
import { errorResponse, getSecurityHeaders } from '../../../shared/utils/response';
import { PaymentService, InitiatePaymentRequest } from '../payment-service';
import logger from '../../../shared/utils/logger';

const paymentService = new PaymentService();

export const handleInitiatePayment: RouteHandler = async (event, _params, _auth) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const request: InitiatePaymentRequest = body;

    // Validate required fields
    const requestId = event.requestContext?.requestId || 'unknown';
    if (!request.loan_id || !request.customer_id || !request.amount || !request.customer_phone || !request.payment_type) {
      return errorResponse('Missing required fields', 400, {
        requestId,
        required: ['loan_id', 'customer_id', 'amount', 'customer_phone', 'payment_type'],
      }, event);
    }

    // Initiate payment
    const result = await paymentService.initiatePayment(request);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        payment_id: result.payment_id,
        transaction_id: result.transaction_id,
        gateway: result.gateway,
        ussd_code: result.ussd_code,
        payment_url: result.payment_url,
        instructions: result.instructions
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    const requestId = event.requestContext?.requestId || 'unknown';
    logger.error('Error initiating payment', { action: 'payment.initiate', status: 'failed', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return errorResponse('Payment initiation failed', 500, { requestId }, event);
  }
};
