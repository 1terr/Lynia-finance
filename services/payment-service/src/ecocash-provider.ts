import { createHmac, timingSafeEqual } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { requireEnv } from '../../shared/utils/require-env';
import { CircuitBreaker } from '../../shared/utils/circuit-breaker';

const ecocashCircuitBreaker = new CircuitBreaker({ name: 'ecocash-api', failureThreshold: 5, resetTimeout: 60000 });

/**
 * EcoCash Configuration
 */
interface EcoCashConfig {
  merchant_id: string;
  api_key: string;
  api_secret: string;
  webhook_secret: string;
  base_url: string;
  environment: 'sandbox' | 'production';
}

/**
 * Payment Request
 */
export interface PaymentRequest {
  amount: number;
  currency: 'USD' | 'ZWL';
  customer_phone: string; // +263771234567
  reference: string; // Our payment ID
  description: string;
}

/**
 * Payment Response
 */
export interface PaymentResponse {
  success: boolean;
  transaction_id: string;
  payment_url?: string;
  ussd_code?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
}

/**
 * Payment Status Response
 */
export interface PaymentStatusResponse {
  transaction_id: string;
  reference: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  customer_phone: string;
  completed_at?: Date;
  failure_reason?: string;
}

/**
 * EcoCash Webhook Payload
 */
export interface EcoCashWebhook {
  transaction_id: string;
  merchant_reference: string; // Our payment ID
  amount: number;
  currency: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED';
  customer_phone: string;
  timestamp: string;
  signature: string; // HMAC for verification
}

/**
 * EcoCash Payment Provider
 * Handles all EcoCash payment operations
 */
export class EcoCashProvider {
  private config: EcoCashConfig;
  private client: AxiosInstance;

  constructor() {
    this.config = {
      merchant_id: requireEnv('ECOCASH_MERCHANT_ID'),
      api_key: requireEnv('ECOCASH_API_KEY'),
      api_secret: requireEnv('ECOCASH_API_SECRET'),
      webhook_secret: requireEnv('ECOCASH_WEBHOOK_SECRET'),
      base_url: process.env.ECOCASH_BASE_URL || 'https://sandbox.ecocash.co.zw/api/v1',
      environment: (process.env.ECOCASH_ENV || 'sandbox') as 'sandbox' | 'production'
    };

    this.client = axios.create({
      baseURL: this.config.base_url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.api_key}`
      }
    });

    console.log(`EcoCashProvider initialized in ${this.config.environment} mode`);
  }

  /**
   * Initiate a payment
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      console.log(`Initiating EcoCash payment, reference: ${request.reference}`);

      // Validate phone number format (Zimbabwe)
      if (!this.validatePhoneNumber(request.customer_phone)) {
        throw new Error('Invalid Zimbabwe phone number format');
      }

      // Construct API request
      const payload = {
        merchant_id: this.config.merchant_id,
        amount: request.amount,
        currency: request.currency,
        customer_phone: request.customer_phone,
        reference: request.reference,
        callback_url: `${process.env.API_BASE_URL}/payments/webhook/ecocash`,
        description: request.description
      };

      // Make API request
      const response = await ecocashCircuitBreaker.execute(() => this.client.post('/payments/initiate', payload));

      console.log(`EcoCash payment initiated: ${response.data.transaction_id}`);

      return {
        success: true,
        transaction_id: response.data.transaction_id,
        ussd_code: response.data.ussd_code || '*151#',
        payment_url: response.data.payment_url,
        status: 'pending',
        message: 'Payment initiated successfully. Customer will receive USSD prompt.'
      };

    } catch (error) {
      console.error('Error initiating EcoCash payment:', error);

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`EcoCash payment failed: ${errorMessage}`);
      }

      throw new Error(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      console.log(`Checking EcoCash payment status: ${transactionId}`);

      const response = await ecocashCircuitBreaker.execute(() => this.client.get(`/payments/${transactionId}/status`));

      return {
        transaction_id: response.data.transaction_id,
        reference: response.data.merchant_reference,
        amount: response.data.amount,
        currency: response.data.currency,
        status: this.mapStatus(response.data.status),
        customer_phone: response.data.customer_phone,
        completed_at: response.data.completed_at ? new Date(response.data.completed_at) : undefined,
        failure_reason: response.data.failure_reason
      };

    } catch (error) {
      console.error('Error checking EcoCash payment status:', error);
      throw new Error(`Failed to check payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(receivedSignature: string, payload: string): boolean {
    const expectedSignature = createHmac('sha256', this.config.webhook_secret)
      .update(payload)
      .digest('hex');

    try {
      return timingSafeEqual(
        Buffer.from(receivedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Validate Zimbabwe phone number
   */
  private validatePhoneNumber(phone: string): boolean {
    // Zimbabwe phone format: +263771234567 or +263731234567
    const pattern = /^\+263(7[1-8])\d{7}$/;
    return pattern.test(phone);
  }

  /**
   * Map EcoCash status to our internal status
   */
  private mapStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
      case 'CANCELED':
        return 'cancelled';
      case 'PROCESSING':
        return 'processing';
      case 'PENDING':
      default:
        return 'pending';
    }
  }

  /**
   * Generate payment instructions for USSD manual flow
   */
  generatePaymentInstructions(amount: number, reference: string): string {
    return `
💰 *EcoCash Payment Instructions*

Amount: *$${amount.toFixed(2)}*
Payment Reference: *${reference}*

*Steps to Pay:*
1. Dial *151#
2. Select option 4 (Make Payment)
3. Select option 3 (Merchant)
4. Enter merchant code: *${this.config.merchant_id}*
5. Enter amount: *${amount.toFixed(2)}*
6. Enter your PIN
7. You'll receive a confirmation SMS

*After payment:*
Reply with your EcoCash reference number (e.g., MP123456)

We'll confirm your payment within 5 minutes.
    `.trim();
  }
}
