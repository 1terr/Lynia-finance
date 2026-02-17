/**
 * Unified Payment Provider Interface
 *
 * All Zimbabwe mobile money providers must implement this interface.
 * Inspired by PH-EE's channel connector abstraction, adapted to
 * our direct-integration Lambda architecture.
 *
 * Providers: EcoCash, OneMoney, O'mari, InnBucks
 */

// ===================================================================
// CANONICAL TYPES (provider-agnostic)
// ===================================================================

/** Payment gateway identifiers */
export type PaymentGateway = 'ecocash' | 'onemoney' | 'omari' | 'innbucks';

/** Payment status values */
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/** Payment request — provider-agnostic */
export interface PaymentRequest {
  amount: number;
  currency: 'USD' | 'ZWL';
  customer_phone: string; // E.164: +263...
  reference: string; // Our payment ID
  description: string;
}

/** Payment response from provider */
export interface PaymentResponse {
  success: boolean;
  transaction_id: string;
  payment_url?: string;
  ussd_code?: string;
  status: PaymentStatus;
  message: string;
}

/** Payment status response from provider */
export interface PaymentStatusResponse {
  transaction_id: string;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  customer_phone: string;
  completed_at?: Date;
  failure_reason?: string;
}

/** Provider capabilities — what operations this provider supports */
export interface ProviderCapabilities {
  supportsRefund: boolean;
  supportsStatusPolling: boolean;
  supportsWebhook: boolean;
  supportsUSSD: boolean;
  maxTransactionAmountUSD: number;
  supportedCurrencies: ('USD' | 'ZWL')[];
}

/** Health check result */
export interface ProviderHealthResult {
  healthy: boolean;
  latencyMs: number;
  circuitState?: string;
}

// ===================================================================
// PROVIDER INTERFACE
// ===================================================================

/**
 * PaymentProvider — all 4 Zimbabwe mobile money providers implement this.
 */
export interface PaymentProvider {
  /** Unique provider identifier */
  readonly name: PaymentGateway;

  /** Initiate a payment with the provider */
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;

  /** Check payment status with the provider */
  checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse>;

  /** Verify webhook signature authenticity */
  verifyWebhookSignature(signature: string, payload: string): boolean;

  /** Generate user-facing payment instructions (for WhatsApp) */
  generatePaymentInstructions(amount: number, reference: string): string;

  /** Provider health check */
  healthCheck(): Promise<ProviderHealthResult>;

  /** Describe provider capabilities */
  getCapabilities(): ProviderCapabilities;
}
