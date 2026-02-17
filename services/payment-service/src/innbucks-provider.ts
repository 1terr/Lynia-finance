/**
 * InnBucks Payment Provider Integration
 *
 * Rewritten as a class implementing PaymentProvider interface.
 * Features: circuit breaker, webhook signature verification,
 * health check, idempotent payment processing.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { requireEnv } from '../../shared/utils/require-env';
import { CircuitBreaker } from '../../shared/utils/circuit-breaker';
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
  PaymentStatus,
  ProviderCapabilities,
  ProviderHealthResult,
} from './payment-provider.interface';

const innbucksCircuitBreaker = new CircuitBreaker({ name: 'innbucks-api', failureThreshold: 5, resetTimeout: 60000 });

/**
 * InnBucks Configuration
 */
interface InnBucksConfig {
  merchant_id: string;
  api_key: string;
  api_secret: string;
  webhook_secret: string;
  base_url: string;
  environment: 'sandbox' | 'production';
}

/**
 * InnBucks Webhook Payload
 */
export interface InnBucksWebhook {
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
 * InnBucks Payment Provider
 * Handles all InnBucks payment operations via direct API integration.
 */
export class InnBucksProvider implements PaymentProvider {
  readonly name = 'innbucks' as const;
  private config: InnBucksConfig;
  private client: AxiosInstance;

  constructor() {
    this.config = {
      merchant_id: requireEnv('INNBUCKS_MERCHANT_ID'),
      api_key: requireEnv('INNBUCKS_API_KEY'),
      api_secret: process.env.INNBUCKS_API_SECRET || '',
      webhook_secret: process.env.INNBUCKS_WEBHOOK_SECRET || '',
      base_url: process.env.INNBUCKS_API_URL || 'https://sandbox.innbucks.co.zw/api/v1',
      environment: (process.env.INNBUCKS_ENV || 'sandbox') as 'sandbox' | 'production'
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
        msisdn: request.customer_phone.replace('+', ''),
        reference: request.reference,
        narrative: request.description,
        callback_url: `${process.env.API_BASE_URL}/payments/webhook/innbucks`
      };

      const response = await innbucksCircuitBreaker.execute(() => this.client.post('/payments/initiate', payload));

      return {
        success: true,
        transaction_id: response.data.transaction_id,
        ussd_code: response.data.ussd_code,
        payment_url: response.data.payment_url,
        status: 'pending',
        message: 'Payment initiated successfully. Customer will receive InnBucks prompt.'
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`InnBucks payment failed: ${errorMessage}`);
      }
      throw new Error(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const response = await innbucksCircuitBreaker.execute(() => this.client.get(`/payments/${transactionId}/status`));

      return {
        transaction_id: response.data.transaction_id,
        reference: response.data.merchant_reference || response.data.reference,
        amount: response.data.amount,
        currency: response.data.currency,
        status: this.mapStatus(response.data.status),
        customer_phone: response.data.customer_phone || response.data.msisdn || '',
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
    if (!this.config.webhook_secret) {
      console.warn('InnBucks webhook secret not configured — skipping signature verification');
      return true;
    }

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
    const pattern = /^\+263(7[1-8])\d{7}$/;
    return pattern.test(phone);
  }

  /**
   * Map InnBucks status to our internal status
   */
  private mapStatus(status: string): PaymentStatus {
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
   * Generate payment instructions for InnBucks
   */
  generatePaymentInstructions(amount: number, reference: string): string {
    return `Payment Instructions - InnBucks

Amount: $${amount.toFixed(2)}
Payment Reference: ${reference}

Steps to Pay:
1. Open InnBucks app or dial USSD
2. Select Pay Merchant
3. Enter merchant code: ${this.config.merchant_id}
4. Enter amount: ${amount.toFixed(2)}
5. Confirm payment
6. You will receive a confirmation notification

After payment:
Reply with your InnBucks reference number

We will confirm your payment within 5 minutes.`;
  }

  /**
   * Health check for provider availability
   */
  async healthCheck(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      await this.client.get('/health', { timeout: 5000 });
      return { healthy: true, latencyMs: Date.now() - start, circuitState: innbucksCircuitBreaker.getState() };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, circuitState: innbucksCircuitBreaker.getState() };
    }
  }

  /**
   * Describe provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsRefund: false,
      supportsStatusPolling: true,
      supportsWebhook: true,
      supportsUSSD: false,
      maxTransactionAmountUSD: 2000,
      supportedCurrencies: ['USD', 'ZWL'],
    };
  }
}
