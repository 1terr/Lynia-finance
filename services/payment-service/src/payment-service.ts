import { db } from '../../shared/clients/database';
import { convertToUsd } from './currency-conversion';
import logger from '../../shared/utils/logger';
import { SQSQueues } from '../../shared/utils/sqs-publisher';
import type { PaymentProvider, PaymentRequest, PaymentResponse, PaymentStatusResponse, ProviderHealthResult } from './payment-provider.interface';
import { EcoCashProvider } from './ecocash-provider';
import { OneMoneyProvider } from './onemoney-provider';
import { OmariProvider } from './omari-provider';
import { InnBucksProvider } from './innbucks-provider';
import { PaymentAnalyticsService, type TrackedPaymentMethod } from './payment-analytics';
import { PaymentEventLogger } from './payment-event-logger';
import { PaymentStateMachine } from './payment-state-machine';

// Re-export for backward compatibility
export type { PaymentGateway } from './payment-provider.interface';
import type { PaymentGateway } from './payment-provider.interface';

/**
 * Payment Initiation Request
 */
export interface InitiatePaymentRequest {
  loan_id: string;
  customer_id: string;
  amount: number;
  currency: 'USD' | 'ZWL';
  customer_phone: string;
  gateway?: PaymentGateway; // Optional: auto-select if not provided
  payment_type: 'deposit' | 'repayment' | 'penalty';
  description?: string;
}

/**
 * Payment Record
 */
export interface Payment {
  id: string;
  loan_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'held' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'released';
  gateway: PaymentGateway;
  gateway_transaction_id?: string;
  gateway_reference?: string;
  payment_type: string;
  description?: string;
  initiated_at: Date;
  completed_at?: Date;
  failed_at?: Date;
  held_at?: Date;
  hold_expires_at?: Date;
  released_at?: Date;
  release_reason?: string;
}

/**
 * RBZ Transaction Limits (in USD equivalent)
 * As per Reserve Bank of Zimbabwe regulations
 */
const TRANSACTION_LIMITS = {
  SINGLE_TRANSACTION_USD: 2000,
  DAILY_LIMIT_USD: 5000,
  MONTHLY_LIMIT_USD: 50000,
};

/**
 * Unified Payment Service
 * Handles all payment operations across multiple gateways
 */
export class PaymentService {
  private providers: Map<PaymentGateway, PaymentProvider>;
  private analytics: PaymentAnalyticsService;
  private eventLogger: PaymentEventLogger;
  private stateMachine: PaymentStateMachine;

  constructor() {
    this.providers = new Map<PaymentGateway, PaymentProvider>([
      ['ecocash', new EcoCashProvider()],
      ['onemoney', new OneMoneyProvider()],
      ['omari', new OmariProvider()],
      ['innbucks', new InnBucksProvider()],
    ]);
    this.analytics = new PaymentAnalyticsService();
    this.eventLogger = new PaymentEventLogger();
    this.stateMachine = new PaymentStateMachine(this.eventLogger);
  }

  /**
   * Get a provider by gateway name. Throws if not found.
   */
  private getProvider(gateway: PaymentGateway): PaymentProvider {
    const provider = this.providers.get(gateway);
    if (!provider) {
      throw new Error(`Unknown payment gateway: ${gateway}`);
    }
    return provider;
  }

  /**
   * Get health status of all providers
   */
  async getProviderHealth(): Promise<Record<PaymentGateway, ProviderHealthResult>> {
    const results: Record<string, ProviderHealthResult> = {};
    for (const [name, provider] of this.providers) {
      results[name] = await provider.healthCheck();
    }
    return results as Record<PaymentGateway, ProviderHealthResult>;
  }

  /**
   * Validate transaction against RBZ regulatory limits.
   * Checks single transaction, daily aggregate, and monthly aggregate.
   */
  async validateTransactionLimits(
    customerId: string,
    amount: number,
    currency: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Convert to USD equivalent for limit checking
    const amountUsd = await convertToUsd(amount, currency);

    // 1. Single transaction limit
    if (amountUsd > TRANSACTION_LIMITS.SINGLE_TRANSACTION_USD) {
      return {
        allowed: false,
        reason: `Single transaction limit exceeded. Maximum: $${TRANSACTION_LIMITS.SINGLE_TRANSACTION_USD} USD.`,
      };
    }

    // 2. Daily aggregate limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: dailyPayments } = await db
      .from('payments')
      .select('amount, currency')
      .eq('customer_id', customerId)
      .in('status', ['pending', 'processing', 'completed'])
      .gte('initiated_at', today.toISOString())
      .execute();

    const dailyTotal = (dailyPayments || []).reduce(
      (sum: number, p: { amount?: number }) => sum + (p.amount || 0), 0
    );

    if (dailyTotal + amountUsd > TRANSACTION_LIMITS.DAILY_LIMIT_USD) {
      return {
        allowed: false,
        reason: `Daily transaction limit exceeded. Daily limit: $${TRANSACTION_LIMITS.DAILY_LIMIT_USD} USD. Today's total: $${dailyTotal.toFixed(2)}.`,
      };
    }

    // 3. Monthly aggregate limit
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: monthlyPayments } = await db
      .from('payments')
      .select('amount, currency')
      .eq('customer_id', customerId)
      .in('status', ['pending', 'processing', 'completed'])
      .gte('initiated_at', monthStart.toISOString())
      .execute();

    const monthlyTotal = (monthlyPayments || []).reduce(
      (sum: number, p: { amount?: number }) => sum + (p.amount || 0), 0
    );

    if (monthlyTotal + amountUsd > TRANSACTION_LIMITS.MONTHLY_LIMIT_USD) {
      return {
        allowed: false,
        reason: `Monthly transaction limit exceeded. Monthly limit: $${TRANSACTION_LIMITS.MONTHLY_LIMIT_USD} USD. This month's total: $${monthlyTotal.toFixed(2)}.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Initiate a payment
   */
  async initiatePayment(request: InitiatePaymentRequest): Promise<{
    payment_id: string;
    transaction_id: string;
    gateway: PaymentGateway;
    ussd_code?: string;
    payment_url?: string;
    instructions: string;
  }> {
    try {
      // Validate RBZ transaction limits
      const limitCheck = await this.validateTransactionLimits(
        request.customer_id,
        request.amount,
        request.currency
      );

      if (!limitCheck.allowed) {
        throw new Error(limitCheck.reason || 'Transaction limit exceeded');
      }

      // Select payment gateway
      const gateway = request.gateway || await this.selectGateway(request.customer_id);

      logger.info(`Initiating payment via ${gateway} for loan ${request.loan_id}`, { action: 'payment.initiate' });

      // Generate payment reference
      const paymentReference = this.generatePaymentReference();

      // Create payment record in database (status: pending)
      const { data: payment, error: paymentError } = await db
        .from('payments')
        .insert({
          loan_id: request.loan_id,
          customer_id: request.customer_id,
          amount: request.amount,
          currency: request.currency,
          status: 'pending',
          gateway: gateway,
          payment_type: request.payment_type,
          description: request.description || `Loan ${request.payment_type}`,
          reference: paymentReference,
          initiated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single()
        .execute();

      if (paymentError || !payment) {
        logger.error('Error creating payment record', { action: 'payment.initiate', meta: { error: paymentError instanceof Error ? paymentError.message : String(paymentError) } });
        throw new Error('Failed to create payment record');
      }

      // Log initial event
      this.eventLogger.logEvent({
        payment_id: payment.id,
        loan_id: request.loan_id,
        customer_id: request.customer_id,
        to_status: 'pending',
        event_type: 'initiated',
        gateway,
      }).catch(() => {});

      // Transition pending -> held (PREPARE phase)
      try {
        await this.stateMachine.transition(payment.id, 'pending', 'held', {
          gateway,
          loan_id: request.loan_id,
          customer_id: request.customer_id,
        });
      } catch (err) {
        logger.error(`Failed to transition payment ${payment.id} to held`, { action: 'payment.initiate', meta: { error: err instanceof Error ? err.message : String(err) } });
        // Fall through — provider call will still work with pending status
      }

      // Prepare payment request
      const paymentReq: PaymentRequest = {
        amount: request.amount,
        currency: request.currency,
        customer_phone: request.customer_phone,
        reference: payment.id,
        description: request.description || `Lynia Finance - Loan #${request.loan_id} ${request.payment_type}`
      };

      // Initiate payment via selected gateway
      const provider = this.getProvider(gateway);
      let response: PaymentResponse;
      try {
        response = await provider.initiatePayment(paymentReq);
      } catch (providerError) {
        // Provider failed — release the hold
        try {
          await this.stateMachine.transition(payment.id, 'held', 'released', {
            gateway,
            release_reason: `Provider error: ${providerError instanceof Error ? providerError.message : 'Unknown'}`,
            loan_id: request.loan_id,
            customer_id: request.customer_id,
          });
        } catch {
          // If hold transition failed (e.g., still pending), mark as failed directly
          await db.from('payments').update({ status: 'failed', failed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', payment.id).execute();
        }
        throw providerError;
      }

      const instructions = provider.generatePaymentInstructions(request.amount, paymentReference);

      // Transition held -> processing (COMMIT phase — provider accepted)
      try {
        await this.stateMachine.transition(payment.id, 'held', 'processing', {
          gateway,
          provider_transaction_id: response.transaction_id,
          loan_id: request.loan_id,
          customer_id: request.customer_id,
        });
      } catch {
        // Fallback: direct update if state machine fails (e.g., still pending)
        await db.from('payments').update({
          gateway_transaction_id: response.transaction_id,
          status: 'processing',
          updated_at: new Date().toISOString()
        }).eq('id', payment.id).execute();
      }

      // Also update gateway_transaction_id
      await db
        .from('payments')
        .update({
          gateway_transaction_id: response.transaction_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id)
        .execute();

      logger.info(`Payment ${payment.id} initiated via ${gateway}: ${response.transaction_id}`, { action: 'payment.initiate' });

      return {
        payment_id: payment.id,
        transaction_id: response.transaction_id,
        gateway: gateway,
        ussd_code: response.ussd_code,
        payment_url: response.payment_url,
        instructions: instructions
      };

    } catch (error) {
      logger.error('Error initiating payment', { action: 'payment.initiate', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
      throw new Error(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(paymentId: string): Promise<Payment> {
    try {
      // Fetch payment from database
      const { data: payment, error } = await db
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single()
        .execute();

      if (error || !payment) {
        throw new Error('Payment not found');
      }

      // If payment is in a terminal state, return cached status
      if (['completed', 'failed', 'cancelled', 'released'].includes(payment.status)) {
        return payment;
      }

      // Check status with gateway if pending/processing
      if (payment.gateway_transaction_id) {
        const provider = this.getProvider(payment.gateway);
        const statusResponse = await provider.checkPaymentStatus(payment.gateway_transaction_id);

        // Update database if status changed
        if (statusResponse.status !== payment.status) {
          await this.updatePaymentStatus(paymentId, statusResponse);
        }

        return {
          ...payment,
          status: statusResponse.status,
          completed_at: statusResponse.completed_at
        };
      }

      return payment;

    } catch (error) {
      logger.error('Error checking payment status', { action: 'payment.status', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
      throw new Error(`Failed to check payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process payment completion (called by webhook or status check)
   */
  async processPaymentCompletion(paymentId: string): Promise<void> {
    try {
      logger.info(`Processing payment completion for ${paymentId}`, { action: 'payment.completion' });

      // Fetch payment
      const { data: payment, error } = await db
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single()
        .execute();

      if (error || !payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        logger.info(`Payment ${paymentId} is not completed (status: ${payment.status})`, { action: 'payment.completion' });
        return;
      }

      // Update loan with payment
      await this.linkPaymentToLoan(payment);

      // Trigger next step based on payment type
      if (payment.payment_type === 'deposit') {
        // Notify customer that deposit was received
        SQSQueues.sendNotification({
          customerId: payment.customer_id,
          channel: 'whatsapp',
          templateName: 'deposit_confirmed',
          templateParams: {
            amount: String(payment.amount),
            loan_id: payment.loan_id,
          },
        }).catch(err => logger.warn('Failed to send deposit notification', {
          action: 'payment.notify',
          meta: { paymentId, error: err instanceof Error ? err.message : 'Unknown' },
        }));
      } else if (payment.payment_type === 'repayment') {
        // Check if loan is fully paid off — trigger device unlock
        const { data: updatedLoan } = await db
          .from('loans')
          .select('status, device_id')
          .eq('id', payment.loan_id)
          .single()
          .execute();

        if (updatedLoan?.status === 'paid_off' && updatedLoan?.device_id) {
          SQSQueues.processDeviceLock({
            deviceId: updatedLoan.device_id,
            action: 'unlock',
            reason: 'loan_paid_off',
            loanId: payment.loan_id,
          }).catch(err => logger.warn('Failed to queue device unlock', {
            action: 'payment.unlock',
            meta: { paymentId, loanId: payment.loan_id, error: err instanceof Error ? err.message : 'Unknown' },
          }));
        }
      } else if (payment.payment_type === 'penalty') {
        logger.info('Penalty payment completed', {
          action: 'payment.penalty_paid',
          meta: { paymentId, loanId: payment.loan_id, amount: payment.amount },
        });
      }

      logger.info(`Payment ${paymentId} processed successfully`, { action: 'payment.completed' });

    } catch (error) {
      logger.error('Error processing payment completion', { action: 'payment.completion', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
      throw error;
    }
  }

  /**
   * Link payment to loan and update loan status
   */
  private async linkPaymentToLoan(payment: Payment): Promise<void> {
    const { data: loan, error: loanError } = await db
      .from('loans')
      .select('*')
      .eq('id', payment.loan_id)
      .single()
      .execute();

    if (loanError || !loan) {
      logger.error('Loan not found', { action: 'payment.link_loan', meta: { loanId: payment.loan_id } });
      return;
    }

    if (payment.payment_type === 'deposit') {
      // Update loan status to paid_deposit
      await db
        .from('loans')
        .update({
          deposit_paid: true,
          deposit_amount: payment.amount,
          deposit_paid_at: payment.completed_at,
          status: 'paid_deposit',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.loan_id)
        .execute();

      logger.info(`Loan ${payment.loan_id} deposit paid: $${payment.amount}`, { action: 'payment.link_loan' });

    } else if (payment.payment_type === 'repayment') {
      // Update loan balance
      const newBalance = (loan.outstanding_balance || loan.principal_amount) - payment.amount;

      await db
        .from('loans')
        .update({
          outstanding_balance: newBalance,
          last_payment_date: payment.completed_at,
          last_payment_amount: payment.amount,
          status: newBalance <= 0 ? 'paid_off' : 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.loan_id)
        .execute();

      logger.info(`Loan ${payment.loan_id} repayment: $${payment.amount}, new balance: $${newBalance}`, { action: 'payment.link_loan' });
    }
  }

  /**
   * Update payment status in database
   */
  private async updatePaymentStatus(
    paymentId: string,
    statusResponse: PaymentStatusResponse
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status: statusResponse.status,
      gateway_reference: statusResponse.reference,
      updated_at: new Date().toISOString()
    };

    if (statusResponse.status === 'completed') {
      updateData.completed_at = statusResponse.completed_at || new Date().toISOString();
      await this.processPaymentCompletion(paymentId);
    } else if (statusResponse.status === 'failed') {
      updateData.failed_at = new Date().toISOString();
      updateData.failure_reason = statusResponse.failure_reason;
    }

    await db
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .execute();

    logger.info(`Payment ${paymentId} status updated to ${statusResponse.status}`, { action: 'payment.status_update' });
  }

  /**
   * Select payment gateway based on customer preference or availability.
   *
   * Default is EcoCash (~70% market share in Zimbabwe).
   * Direct integrations with all 4 providers replace the Paynow aggregator.
   */
  private async selectGateway(customerId: string): Promise<PaymentGateway> {
    const { data: customer } = await db
      .from('customers')
      .select('preferred_payment_gateway')
      .eq('id', customerId)
      .single()
      .execute();

    if (customer?.preferred_payment_gateway) {
      return customer.preferred_payment_gateway as PaymentGateway;
    }

    // Default to EcoCash (highest market share ~70%)
    return 'ecocash';
  }

  /**
   * Track payment method analytics after webhook confirms payment
   */
  async trackCompletedPayment(
    paymentId: string,
    _providerReference: string
  ): Promise<void> {
    try {
      const { data: payment } = await db
        .from('payments')
        .select('id, loan_id, customer_id, amount, currency, gateway')
        .eq('id', paymentId)
        .single()
        .execute();

      if (!payment) return;

      const method: TrackedPaymentMethod = payment.gateway as TrackedPaymentMethod;

      const feeAmount = this.analytics.calculateFee(
        payment.amount,
        'direct',
        method
      );

      await this.analytics.trackPaymentMethod({
        payment_id: payment.id,
        loan_id: payment.loan_id,
        customer_id: payment.customer_id,
        payment_method: method,
        gateway: payment.gateway,
        amount: payment.amount,
        currency: payment.currency,
        fee_amount: feeAmount,
        fee_percentage: payment.amount > 0 ? (feeAmount / payment.amount) * 100 : 0,
        status: 'completed',
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      // Never let analytics tracking block the payment flow
      logger.error('Failed to track payment analytics', { action: 'payment.track_analytics', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    }
  }

  /**
   * Generate unique payment reference
   */
  private generatePaymentReference(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `LYN-${timestamp}-${random}`;
  }

  /**
   * Reconcile payments (check for pending payments and update status)
   */
  async reconcilePayments(maxAge: number = 24): Promise<{
    checked: number;
    updated: number;
    completed: number;
    failed: number;
    released: number;
  }> {
    try {
      logger.info(`Starting payment reconciliation (max age: ${maxAge} hours)`, { action: 'payment.reconcile' });

      const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);

      // Phase 1: Release expired holds
      let released = 0;
      const { data: expiredHolds } = await db
        .from('payments')
        .select('*')
        .eq('status', 'held')
        .lt('hold_expires_at', new Date().toISOString())
        .execute();

      for (const held of (expiredHolds || [])) {
        try {
          // Last-chance: poll provider if we have a transaction ID
          if (held.gateway_transaction_id) {
            const provider = this.getProvider(held.gateway);
            const providerStatus = await provider.checkPaymentStatus(held.gateway_transaction_id);
            if (providerStatus.status === 'completed') {
              await this.stateMachine.transition(held.id, 'held', 'processing', {
                gateway: held.gateway,
                actor_type: 'reconciliation',
              });
              continue;
            }
          }
          // Release the expired hold
          await this.stateMachine.transition(held.id, 'held', 'released', {
            gateway: held.gateway,
            release_reason: 'Hold expired during reconciliation',
            actor_type: 'reconciliation',
          });
          released++;
        } catch (err) {
          logger.error(`Error releasing expired hold for payment ${held.id}`, { action: 'payment.reconcile', meta: { error: err instanceof Error ? err.message : String(err) } });
        }
      }

      // Phase 2: Reconcile pending/processing payments (existing behavior)
      const { data: payments, error } = await db
        .from('payments')
        .select('*')
        .in('status', ['pending', 'processing'])
        .gte('initiated_at', cutoffTime.toISOString())
        .execute();

      if (error || !payments) {
        throw new Error('Failed to fetch payments for reconciliation');
      }

      let checked = 0;
      let updated = 0;
      let completed = 0;
      let failed = 0;

      for (const payment of payments) {
        try {
          const updatedPayment = await this.checkPaymentStatus(payment.id);
          checked++;

          if (updatedPayment.status !== payment.status) {
            updated++;

            if (updatedPayment.status === 'completed') {
              completed++;
            } else if (updatedPayment.status === 'failed') {
              failed++;
            }
          }
        } catch (error) {
          logger.error(`Error reconciling payment ${payment.id}`, { action: 'payment.reconcile', meta: { error: error instanceof Error ? error.message : String(error) } });
        }
      }

      logger.info(`Reconciliation complete: ${checked} checked, ${updated} updated, ${completed} completed, ${failed} failed, ${released} released`, { action: 'payment.reconcile' });

      return { checked, updated, completed, failed, released };

    } catch (error) {
      logger.error('Error during payment reconciliation', { action: 'payment.reconcile', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
      throw error;
    }
  }
}
