/**
 * Paynow Payment Gateway Provider (T014)
 *
 * Paynow is Zimbabwe's leading payment gateway aggregator.
 * It handles EcoCash, OneMoney, O'mari, Visa/Mastercard, and ZimSwitch
 * through a single integration.
 *
 * Key benefit: O'mari (Old Mutual digital wallet) is automatically
 * supported alongside EcoCash and OneMoney without separate integration.
 *
 * API Docs: https://developers.paynow.co.zw
 */

import { createHmac } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { PaymentRequest, PaymentResponse, PaymentStatusResponse } from './ecocash-provider';

// ===================================================================
// CONFIGURATION
// ===================================================================

interface PaynowConfig {
  integration_id: string;
  integration_key: string;
  result_url: string;
  return_url: string;
  base_url: string;
  environment: 'sandbox' | 'production';
}

/**
 * Payment methods available via Paynow gateway.
 * O'mari is included automatically when customers choose
 * their payment method on the Paynow redirect page.
 */
export type PaynowPaymentMethod =
  | 'ecocash'
  | 'onemoney'
  | 'omari'
  | 'visa'
  | 'mastercard'
  | 'zimswitch';

/**
 * Paynow webhook callback payload
 */
export interface PaynowWebhook {
  reference: string;          // Our payment reference
  paynowreference: string;   // Paynow's reference
  amount: string;             // Amount as string
  status: PaynowStatus;
  pollurl: string;
  hash: string;               // HMAC-SHA512 signature
}

export type PaynowStatus =
  | 'Paid'
  | 'Awaiting Delivery'
  | 'Delivered'
  | 'Created'
  | 'Sent'
  | 'Cancelled'
  | 'Disputed'
  | 'Refunded'
  | 'Failed';

// ===================================================================
// PAYNOW PROVIDER
// ===================================================================

export class PaynowProvider {
  private config: PaynowConfig;
  private client: AxiosInstance;

  constructor() {
    this.config = {
      integration_id: process.env.PAYNOW_INTEGRATION_ID || 'test_integration',
      integration_key: process.env.PAYNOW_INTEGRATION_KEY || 'test_key',
      result_url: process.env.PAYNOW_RESULT_URL || `${process.env.API_BASE_URL}/payments/webhook/paynow`,
      return_url: process.env.PAYNOW_RETURN_URL || 'https://lynia.co.zw/payment/complete',
      base_url: process.env.PAYNOW_BASE_URL || 'https://www.paynow.co.zw/interface',
      environment: (process.env.PAYNOW_ENV || 'sandbox') as 'sandbox' | 'production',
    };

    this.client = axios.create({
      timeout: 30000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    console.log(`PaynowProvider initialized in ${this.config.environment} mode`);
  }

  /**
   * Initiate a payment through Paynow.
   *
   * When no specific mobile method is provided, the customer is redirected
   * to Paynow's payment page where they can choose EcoCash, OneMoney,
   * O'mari, or card payment.
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      console.log(`Initiating Paynow payment, reference: ${request.reference}`);

      const values: Record<string, string> = {
        id: this.config.integration_id,
        reference: request.reference,
        amount: request.amount.toFixed(2),
        additionalinfo: request.description,
        returnurl: this.config.return_url,
        resulturl: this.config.result_url,
        status: 'Message',
      };

      values.hash = this.generateHash(values);

      const response = await this.client.post(
        `${this.config.base_url}/initiatetransaction`,
        this.encodeFormData(values)
      );

      const result = this.parsePaynowResponse(response.data);

      if (result.status === 'Error') {
        throw new Error(`Paynow error: ${result.error}`);
      }

      console.log(`Paynow transaction created: ${result.paynowreference}`);

      return {
        success: true,
        transaction_id: result.paynowreference || request.reference,
        payment_url: result.browserurl,
        status: 'pending',
        message: 'Payment initiated. Customer will be redirected to Paynow to select payment method.',
      };
    } catch (error) {
      console.error('Error initiating Paynow payment:', error);

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data || error.message;
        throw new Error(`Paynow payment failed: ${errorMessage}`);
      }

      throw new Error(
        `Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Initiate a mobile money payment directly (STK push).
   *
   * Supports EcoCash, OneMoney, and O'mari.
   * The USSD push is sent directly to the customer's phone.
   */
  async initiateMobilePayment(
    request: PaymentRequest,
    method: 'ecocash' | 'onemoney'
  ): Promise<PaymentResponse> {
    try {
      console.log(`Initiating Paynow mobile payment via ${method}, reference: ${request.reference}`);

      if (!this.validatePhoneNumber(request.customer_phone)) {
        throw new Error('Invalid Zimbabwe phone number format');
      }

      const values: Record<string, string> = {
        id: this.config.integration_id,
        reference: request.reference,
        amount: request.amount.toFixed(2),
        additionalinfo: request.description,
        resulturl: this.config.result_url,
        phone: request.customer_phone.replace('+', ''),
        method: method,
        status: 'Message',
      };

      values.hash = this.generateHash(values);

      const response = await this.client.post(
        `${this.config.base_url}/remotetransaction`,
        this.encodeFormData(values)
      );

      const result = this.parsePaynowResponse(response.data);

      if (result.status === 'Error') {
        throw new Error(`Paynow error: ${result.error}`);
      }

      const ussdCode = method === 'ecocash' ? '*151#' : '*111#';

      console.log(`Paynow mobile payment initiated via ${method}: ${result.paynowreference}`);

      return {
        success: true,
        transaction_id: result.paynowreference || request.reference,
        ussd_code: ussdCode,
        payment_url: result.pollurl,
        status: 'pending',
        message: `Payment initiated via ${method === 'ecocash' ? 'EcoCash' : 'OneMoney'}. Customer will receive USSD prompt.`,
      };
    } catch (error) {
      console.error(`Error initiating Paynow ${method} payment:`, error);

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data || error.message;
        throw new Error(`Paynow ${method} payment failed: ${errorMessage}`);
      }

      throw new Error(
        `Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check payment status by polling the Paynow poll URL
   */
  async checkPaymentStatus(pollUrl: string): Promise<PaymentStatusResponse> {
    try {
      console.log('Checking Paynow payment status');

      const response = await this.client.get(pollUrl);
      const result = this.parsePaynowResponse(response.data);

      return {
        transaction_id: result.paynowreference || '',
        reference: result.reference || '',
        amount: parseFloat(result.amount || '0'),
        currency: 'USD',
        status: this.mapStatus(result.status || 'Pending'),
        customer_phone: '',
        completed_at: result.status === 'Paid' ? new Date() : undefined,
        failure_reason: result.status === 'Failed' ? 'Payment failed' : undefined,
      };
    } catch (error) {
      console.error('Error checking Paynow payment status:', error);
      throw new Error(
        `Failed to check payment status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify Paynow webhook signature (HMAC-SHA512)
   */
  verifyWebhookSignature(payload: PaynowWebhook): boolean {
    const values: Record<string, string> = { ...payload };
    const receivedHash = values.hash;
    delete values.hash;

    const expectedHash = this.generateHash(values);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(receivedHash),
        Buffer.from(expectedHash)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate payment instructions for customers.
   * Since Paynow handles method selection, instructions point to the redirect.
   */
  generatePaymentInstructions(amount: number, reference: string): string {
    return `
💰 *Payment Instructions*

Amount: *$${amount.toFixed(2)}*
Reference: *${reference}*

You'll be redirected to a secure payment page where you can choose:
- EcoCash
- OneMoney
- O'mari
- Visa/Mastercard

Select your preferred payment method and follow the prompts.

We'll confirm your payment automatically.
    `.trim();
  }

  /**
   * Generate instructions specifically for O'mari payments
   */
  generateOmariInstructions(amount: number, reference: string): string {
    return `
💰 *O'mari Payment Instructions*

Amount: *$${amount.toFixed(2)}*
Reference: *${reference}*

*To pay with O'mari:*
1. You'll receive a *707# payment prompt on your phone
2. Enter your O'mari PIN to confirm
3. Payment completes instantly

*No O'mari account?*
Dial *707# on any network (Econet, NetOne, Telecel) to register.
O'mari currently has *0% fees* on USD transactions!

We'll confirm your payment automatically.
    `.trim();
  }

  // -------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------

  /**
   * Generate HMAC-SHA512 hash for Paynow request/response verification
   */
  private generateHash(values: Record<string, string>): string {
    const stringToHash = Object.values(values).join('') + this.config.integration_key;
    return createHmac('sha512', this.config.integration_key)
      .update(stringToHash)
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Encode object as URL-encoded form data
   */
  private encodeFormData(values: Record<string, string>): string {
    return Object.entries(values)
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
      .join('&');
  }

  /**
   * Parse Paynow's URL-encoded response into an object
   */
  private parsePaynowResponse(data: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (typeof data !== 'string') return result;

    data.split('&').forEach((pair) => {
      const [key, ...valueParts] = pair.split('=');
      if (key) {
        result[decodeURIComponent(key).toLowerCase()] = decodeURIComponent(valueParts.join('='));
      }
    });

    return result;
  }

  /**
   * Map Paynow status strings to internal status
   */
  private mapStatus(
    status: string
  ): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'delivered':
      case 'awaiting delivery':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'cancelled':
      case 'refunded':
      case 'disputed':
        return 'cancelled';
      case 'sent':
        return 'processing';
      case 'created':
      default:
        return 'pending';
    }
  }

  /**
   * Validate Zimbabwe phone number
   */
  private validatePhoneNumber(phone: string): boolean {
    const cleaned = phone.replace('+', '');
    return /^263(7[1-8])\d{7}$/.test(cleaned);
  }
}
