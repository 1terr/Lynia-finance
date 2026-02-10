import { createHmac } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { PaymentRequest, PaymentResponse, PaymentStatusResponse } from './ecocash-provider';

/**
 * OneWallet Configuration (formerly OneMoney)
 * Provider: NetOne
 * USSD: *111#
 */
interface OneWalletConfig {
  merchant_id: string;
  api_key: string;
  api_secret: string;
  webhook_secret: string;
  base_url: string;
  environment: 'sandbox' | 'production';
}

/**
 * OneWallet Webhook Payload
 */
export interface OneWalletWebhook {
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
 * OneWallet Payment Provider (formerly OneMoney)
 * Handles all OneWallet payment operations via direct API integration.
 */
export class OneWalletProvider {
  private config: OneWalletConfig;
  private client: AxiosInstance;

  constructor() {
    this.config = {
      merchant_id: process.env.ONEWALLET_MERCHANT_ID || process.env.ONEMONEY_MERCHANT_ID || 'test_merchant',
      api_key: process.env.ONEWALLET_API_KEY || process.env.ONEMONEY_API_KEY || 'test_api_key',
      api_secret: process.env.ONEWALLET_API_SECRET || process.env.ONEMONEY_API_SECRET || 'test_api_secret',
      webhook_secret: process.env.ONEWALLET_WEBHOOK_SECRET || process.env.ONEMONEY_WEBHOOK_SECRET || 'test_webhook_secret',
      base_url: process.env.ONEWALLET_BASE_URL || 'https://sandbox.onemoney.co.zw/api/v1',
      environment: (process.env.ONEWALLET_ENV || process.env.ONEMONEY_ENV || 'sandbox') as 'sandbox' | 'production'
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
        callback_url: `${process.env.API_BASE_URL}/payments/webhook/onewallet`,
        description: request.description
      };

      const response = await this.client.post('/payments/initiate', payload);

      return {
        success: true,
        transaction_id: response.data.transaction_id,
        ussd_code: response.data.ussd_code || '*111#',
        payment_url: response.data.payment_url,
        status: 'pending',
        message: 'Payment initiated successfully. Customer will receive USSD prompt.'
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`OneWallet payment failed: ${errorMessage}`);
      }
      throw new Error(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const response = await this.client.get(`/payments/${transactionId}/status`);

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
      return crypto.timingSafeEqual(
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
    // Zimbabwe phone format: +263711234567 (NetOne prefix: 71)
    const pattern = /^\+263(7[1-8])\d{7}$/;
    return pattern.test(phone);
  }

  /**
   * Map OneWallet status to our internal status
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
    return `Payment Instructions - OneWallet

Amount: $${amount.toFixed(2)}
Payment Reference: ${reference}

Steps to Pay:
1. Dial *111#
2. Select option 3 (Payments)
3. Select option 1 (Merchant Payment)
4. Enter merchant code: ${this.config.merchant_id}
5. Enter amount: ${amount.toFixed(2)}
6. Enter your PIN
7. You will receive a confirmation SMS

After payment:
Reply with your OneWallet reference number (e.g., OW123456)

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
