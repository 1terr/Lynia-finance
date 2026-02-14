import { createHmac, timingSafeEqual } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { PaymentRequest, PaymentResponse, PaymentStatusResponse } from './ecocash-provider';
import { requireEnv } from '../../shared/utils/require-env';
import { CircuitBreaker } from '../../shared/utils/circuit-breaker';

const omariCircuitBreaker = new CircuitBreaker({ name: 'omari-api', failureThreshold: 5, resetTimeout: 60000 });

/**
 * O'mari Payment Provider (Old Mutual digital wallet)
 *
 * Direct API integration replacing previous Paynow aggregator routing.
 * USSD: *707#
 * Market share: ~10% in Zimbabwe
 * Estimated fees: ~1% per transaction (0% promo on USD currently)
 */

/**
 * O'mari Configuration
 */
interface OmariConfig {
  merchant_id: string;
  api_key: string;
  api_secret: string;
  webhook_secret: string;
  base_url: string;
  environment: 'sandbox' | 'production';
}

/**
 * O'mari Webhook Payload
 */
export interface OmariWebhook {
  transaction_id: string;
  merchant_reference: string;
  amount: number;
  currency: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED';
  customer_phone: string;
  timestamp: string;
  signature: string;
}

/**
 * O'mari Payment Provider
 * Handles all O'mari payment operations via direct API integration.
 */
export class OmariProvider {
  private config: OmariConfig;
  private client: AxiosInstance;

  constructor() {
    this.config = {
      merchant_id: requireEnv('OMARI_MERCHANT_ID'),
      api_key: requireEnv('OMARI_API_KEY'),
      api_secret: requireEnv('OMARI_API_SECRET'),
      webhook_secret: requireEnv('OMARI_WEBHOOK_SECRET'),
      base_url: process.env.OMARI_BASE_URL || 'https://sandbox.omari.co.zw/api/v1',
      environment: (process.env.OMARI_ENV || 'sandbox') as 'sandbox' | 'production'
    };

    this.client = axios.create({
      baseURL: this.config.base_url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.api_key}`
      }
    });
  }

  /**
   * Initiate a payment
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      if (!this.validatePhoneNumber(request.customer_phone)) {
        throw new Error('Invalid Zimbabwe phone number format');
      }

      const payload = {
        merchant_id: this.config.merchant_id,
        amount: request.amount,
        currency: request.currency,
        customer_phone: request.customer_phone,
        reference: request.reference,
        callback_url: `${process.env.API_BASE_URL}/payments/webhook/omari`,
        description: request.description
      };

      const response = await omariCircuitBreaker.execute(() => this.client.post('/payments/initiate', payload));

      return {
        success: true,
        transaction_id: response.data.transaction_id,
        ussd_code: response.data.ussd_code || '*707#',
        payment_url: response.data.payment_url,
        status: 'pending',
        message: 'Payment initiated successfully. Customer will receive USSD prompt.'
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`O'mari payment failed: ${errorMessage}`);
      }
      throw new Error(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const response = await omariCircuitBreaker.execute(() => this.client.get(`/payments/${transactionId}/status`));

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
  validatePhoneNumber(phone: string): boolean {
    // Zimbabwe phone format: +263771234567
    const pattern = /^\+263(7[1-8])\d{7}$/;
    return pattern.test(phone);
  }

  /**
   * Map O'mari status to our internal status
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
    return `Payment Instructions - O'mari

Amount: $${amount.toFixed(2)}
Payment Reference: ${reference}

Steps to Pay:
1. Dial *707#
2. Select Pay
3. Enter merchant code: ${this.config.merchant_id}
4. Enter amount: ${amount.toFixed(2)}
5. Confirm payment
6. You will receive a confirmation SMS

After payment:
Reply with your O'mari reference number (e.g., OM123456)

We will confirm your payment within 5 minutes.`;
  }

  /**
   * Health check for provider availability
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.client.get('/health', { timeout: 5000 });
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }
}
