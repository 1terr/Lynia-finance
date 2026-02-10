import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PaymentService, InitiatePaymentRequest } from './payment-service';
import { EcoCashProvider, EcoCashWebhook } from './ecocash-provider';
import { OneWalletProvider, OneWalletWebhook } from './onewallet-provider';
import { OmariProvider, OmariWebhook } from './omari-provider';

const paymentService = new PaymentService();
const ecocashProvider = new EcoCashProvider();
const onewalletProvider = new OneWalletProvider();
const omariProvider = new OmariProvider();

/**
 * Payment Service Lambda Handler
 * Handles payment processing (EcoCash, OneWallet, O'mari, InnBucks)
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // Route requests
    if (path === '/payments/initiate' && method === 'POST') {
      return await initiatePayment(event);
    } else if (path === '/payments/webhook/ecocash' && method === 'POST') {
      return await handleEcoCashWebhook(event);
    } else if (path === '/payments/webhook/onewallet' && method === 'POST') {
      return await handleOneWalletWebhook(event);
    } else if (path === '/payments/webhook/omari' && method === 'POST') {
      return await handleOmariWebhook(event);
    } else if (path.match(/\/payments\/[^/]+$/) && method === 'GET') {
      const paymentId = event.pathParameters?.paymentId;
      return await getPaymentStatus(paymentId!);
    } else if (path === '/payments/reconcile' && method === 'POST') {
      return await reconcilePayments(event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }
};

/**
 * POST /payments/initiate
 * Initiate a payment
 */
async function initiatePayment(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };

  } catch (error) {
    console.error('Error initiating payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Payment initiation failed',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }
}

/**
 * POST /payments/webhook/ecocash
 * Handle EcoCash webhook
 */
async function handleEcoCashWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const payload: EcoCashWebhook = JSON.parse(event.body || '{}');

    // Verify webhook signature
    const receivedSignature = event.headers['x-signature'] || event.headers['X-Signature'];
    if (receivedSignature) {
      const isValid = ecocashProvider.verifyWebhookSignature(receivedSignature, event.body!);
      if (!isValid) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid signature' }),
          headers: { 'Content-Type': 'application/json' }
        };
      }
    }

    const paymentId = payload.merchant_reference;

    if (payload.status === 'SUCCESS') {
      await paymentService.checkPaymentStatus(paymentId);
      await paymentService.processPaymentCompletion(paymentId);
      await paymentService.trackCompletedPayment(paymentId, payload.transaction_id);
    } else if (payload.status === 'FAILED' || payload.status === 'CANCELLED') {
      await paymentService.checkPaymentStatus(paymentId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error('Error processing EcoCash webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

/**
 * POST /payments/webhook/onewallet
 * Handle OneWallet webhook (formerly OneMoney)
 */
async function handleOneWalletWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const payload: OneWalletWebhook = JSON.parse(event.body || '{}');

    // Verify webhook signature
    const receivedSignature = event.headers['x-signature'] || event.headers['X-Signature'];
    if (receivedSignature) {
      const isValid = onewalletProvider.verifyWebhookSignature(receivedSignature, event.body!);
      if (!isValid) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid signature' }),
          headers: { 'Content-Type': 'application/json' }
        };
      }
    }

    const paymentId = payload.merchant_reference;

    if (payload.status === 'SUCCESS') {
      await paymentService.checkPaymentStatus(paymentId);
      await paymentService.processPaymentCompletion(paymentId);
      await paymentService.trackCompletedPayment(paymentId, payload.transaction_id);
    } else if (payload.status === 'FAILED' || payload.status === 'CANCELLED') {
      await paymentService.checkPaymentStatus(paymentId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error('Error processing OneWallet webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

/**
 * POST /payments/webhook/omari
 * Handle O'mari webhook (direct integration, replacing Paynow aggregator)
 */
async function handleOmariWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const payload: OmariWebhook = JSON.parse(event.body || '{}');

    // Verify webhook signature
    const receivedSignature = event.headers['x-signature'] || event.headers['X-Signature'];
    if (receivedSignature) {
      const isValid = omariProvider.verifyWebhookSignature(receivedSignature, event.body!);
      if (!isValid) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid signature' }),
          headers: { 'Content-Type': 'application/json' }
        };
      }
    }

    const paymentId = payload.merchant_reference;

    if (payload.status === 'SUCCESS') {
      await paymentService.checkPaymentStatus(paymentId);
      await paymentService.processPaymentCompletion(paymentId);
      await paymentService.trackCompletedPayment(paymentId, payload.transaction_id);
    } else if (payload.status === 'FAILED' || payload.status === 'CANCELLED') {
      await paymentService.checkPaymentStatus(paymentId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error('Error processing O\'mari webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

/**
 * GET /payments/{paymentId}
 * Get payment status
 */
async function getPaymentStatus(paymentId: string): Promise<APIGatewayProxyResult> {
  try {
    if (!paymentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Payment ID required' }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };

  } catch (error) {
    console.error('Error fetching payment status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch payment status',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }
}

/**
 * POST /payments/reconcile
 * Reconcile pending payments
 */
async function reconcilePayments(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };

  } catch (error) {
    console.error('Error reconciling payments:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Reconciliation failed',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }
}
