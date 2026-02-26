/**
 * POST /payments/initiate
 * Initiate a payment
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RouteHandler } from '../../../shared/utils/lambda-router';
import { getSecurityHeaders } from '../../../shared/utils/response';
import { PaymentService, InitiatePaymentRequest } from '../payment-service';
import logger from '../../../shared/utils/logger';

const paymentService = new PaymentService();

export const handleInitiatePayment: RouteHandler = async (event, _params, _auth) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const request: InitiatePaymentRequest = body;

    // Validate required fields
    if (!request.loan_id || !request.customer_id || !request.amount || !request.customer_phone || !request.payment_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['loan_id', 'customer_id', 'amount', 'customer_phone', 'payment_type']
        }),
        headers: getSecurityHeaders(event)
      };
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
    logger.error('Error initiating payment', { action: 'payment.initiate', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Payment initiation failed',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};
