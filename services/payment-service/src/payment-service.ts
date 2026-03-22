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
import { disburseLoanInFineract } from '../../shared/clients/fineract-sync';

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
  payment_type: 'deposit' | 'repayment' | 'penalty' | 'disbursement';
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

    // Group by currency and convert each group to USD to avoid N individual DB lookups
    const dailyByCurrency: Record<string, number> = {};
    for (const p of (dailyPayments || []) as Array<{ amount?: number; currency?: string }>) {
      const cur = p.currency || 'USD';
      dailyByCurrency[cur] = (dailyByCurrency[cur] || 0) + (p.amount || 0);
    }
    let dailyTotal = 0;
    for (const [cur, sum] of Object.entries(dailyByCurrency)) {
      dailyTotal += await convertToUsd(sum, cur);
    }

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

    // Group by currency and convert each group to USD
    const monthlyByCurrency: Record<string, number> = {};
    for (const p of (monthlyPayments || []) as Array<{ amount?: number; currency?: string }>) {
      const cur = p.currency || 'USD';
      monthlyByCurrency[cur] = (monthlyByCurrency[cur] || 0) + (p.amount || 0);
    }
    let monthlyTotal = 0;
    for (const [cur, sum] of Object.entries(monthlyByCurrency)) {
      monthlyTotal += await convertToUsd(sum, cur);
    }

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
      }).catch(err => logger.error('Failed to log payment initiation event', { error: err instanceof Error ? err.message : String(err), action: 'payment.event_log' }));

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

        // Advance loan workflow: deposit received → ready for handover
        SQSQueues.processLoanUpdate({
          loanId: payment.loan_id,
          action: 'deposit_received',
          paymentId: payment.id,
        }).catch(err => logger.warn('Failed to queue loan status update', {
          action: 'payment.loanUpdate',
          meta: { paymentId, loanId: payment.loan_id, error: err instanceof Error ? err.message : 'Unknown' },
        }));

        // Non-blocking Fineract disbursement: transition loan from approved → disbursed
        try {
          const { data: depositLoan } = await db
            .from('loans')
            .select('fineract_loan_id')
            .eq('id', payment.loan_id)
            .single()
            .execute();

          if (depositLoan?.fineract_loan_id) {
            disburseLoanInFineract({
              loanId: payment.loan_id,
              fineractLoanId: depositLoan.fineract_loan_id,
              disbursementDate: new Date(payment.completed_at || new Date().toISOString()),
            }).catch(err => {
              logger.warn('Fineract disbursement sync failed after deposit (non-blocking)', {
                action: 'payment.fineract_disburse',
                meta: { loanId: payment.loan_id, error: err instanceof Error ? err.message : String(err) },
              });
            });
          }
        } catch (err) {
          logger.warn('Failed to fetch loan for Fineract disbursement after deposit', {
            action: 'payment.fineract_disburse',
            meta: { loanId: payment.loan_id, error: err instanceof Error ? err.message : String(err) },
          });
        }
      } else if (payment.payment_type === 'repayment') {
        // Check loan status and trigger device unlock evaluation
        const { data: updatedLoan } = await db
          .from('loans')
          .select('status, device_id')
          .eq('id', payment.loan_id)
          .single()
          .execute();

        // Trigger device unlock check on any repayment for loans with a device
        // The lock-service evaluates whether the loan is current or fully paid
        if (updatedLoan?.device_id) {
          SQSQueues.processDeviceLock({
            deviceId: updatedLoan.device_id,
            action: 'unlock',
            reason: updatedLoan.status === 'paid_off' ? 'loan_paid_off' : 'repayment_received',
            loanId: payment.loan_id,
          }).catch(err => logger.warn('Failed to queue device unlock evaluation', {
            action: 'payment.unlock',
            meta: { paymentId, loanId: payment.loan_id, error: err instanceof Error ? err.message : 'Unknown' },
          }));
        }
      } else if (payment.payment_type === 'disbursement') {
        // Disbursement completed: activate loan and notify customer
        try {
          await db
            .from('loans')
            .update({
              status: 'active',
              disbursement_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.loan_id)
            .execute();

          logger.info('Loan activated after disbursement', {
            action: 'payment.disbursement_completed',
            meta: { paymentId, loanId: payment.loan_id, amount: payment.amount },
          });
        } catch (err) {
          logger.error('Failed to activate loan after disbursement', {
            action: 'payment.disbursement_completed',
            meta: { paymentId, loanId: payment.loan_id, error: err instanceof Error ? err.message : 'Unknown' },
          });
        }

        // Non-blocking Fineract disbursement: transition loan from approved → disbursed
        try {
          const { data: disbursementLoan } = await db
            .from('loans')
            .select('fineract_loan_id')
            .eq('id', payment.loan_id)
            .single()
            .execute();

          if (disbursementLoan?.fineract_loan_id) {
            disburseLoanInFineract({
              loanId: payment.loan_id,
              fineractLoanId: disbursementLoan.fineract_loan_id,
              disbursementDate: new Date(payment.completed_at || new Date().toISOString()),
            }).catch(err => {
              logger.warn('Fineract disbursement sync failed after disbursement payment (non-blocking)', {
                action: 'payment.fineract_disburse',
                meta: { loanId: payment.loan_id, error: err instanceof Error ? err.message : String(err) },
              });
            });
          }
        } catch (err) {
          logger.warn('Failed to fetch loan for Fineract disbursement after disbursement payment', {
            action: 'payment.fineract_disburse',
            meta: { loanId: payment.loan_id, error: err instanceof Error ? err.message : String(err) },
          });
        }

        // Send WhatsApp disbursement confirmation
        SQSQueues.sendNotification({
          customerId: payment.customer_id,
          channel: 'whatsapp',
          templateName: 'disbursement_confirmed',
          templateParams: {
            amount: String(payment.amount),
            loan_id: payment.loan_id,
          },
        }).catch(err => logger.warn('Failed to send disbursement notification', {
          action: 'payment.notify',
          meta: { paymentId, error: err instanceof Error ? err.message : 'Unknown' },
        }));

        // Queue data warehouse sync for analytics/reporting
        SQSQueues.syncDataWarehouse({
          eventType: 'loan.disbursed',
          entityId: payment.loan_id,
          entityType: 'loan',
          metadata: { paymentId, amount: payment.amount, currency: payment.currency },
        }).catch(err => logger.warn('Failed to queue data warehouse disbursement sync', {
          action: 'payment.data_warehouse_sync',
          meta: { paymentId, loanId: payment.loan_id, error: err instanceof Error ? err.message : 'Unknown' },
        }));

      } else if (payment.payment_type === 'penalty') {
        logger.info('Penalty payment completed', {
          action: 'payment.penalty_paid',
          meta: { paymentId, loanId: payment.loan_id, amount: payment.amount },
        });
      } else {
        logger.warn('Unhandled payment type in processPaymentCompletion', {
          action: 'payment.completion.unhandled',
          meta: { paymentType: payment.payment_type, paymentId, loanId: payment.loan_id },
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

      // F4: Audit trail for deposit
      db.from('audit_log').insert({
        user_id: payment.customer_id || 'system',
        user_type: payment.customer_id ? 'customer' : 'system',
        action: 'loan.deposit_paid',
        entity_type: 'loan',
        entity_id: payment.loan_id,
        description: `Deposit of $${payment.amount} paid. Loan status: paid_deposit`,
        changes: JSON.stringify({ payment_id: payment.id, amount: payment.amount, new_status: 'paid_deposit' }),
        created_at: new Date().toISOString(),
      }).execute().catch(err => logger.error('Failed to create audit log for deposit payment', { error: err instanceof Error ? err.message : String(err), action: 'payment.audit_log' }));

    } else if (payment.payment_type === 'repayment' || payment.payment_type === 'early_payoff') {
      // Update loan balance
      const rawBalance = (loan.outstanding_balance || loan.principal_amount) - payment.amount;
      const previousStatus = loan.status;

      // F1: Handle overpayment — apply excess to next installment as credit
      const hasOverpayment = rawBalance < 0;
      const creditAmount = hasOverpayment ? Math.abs(rawBalance) : 0;
      const newBalance = hasOverpayment ? 0 : rawBalance;
      const newStatus = newBalance <= 0 ? 'paid_off' : 'active';

      const updateData: Record<string, unknown> = {
        outstanding_balance: newBalance,
        last_payment_date: payment.completed_at,
        last_payment_amount: payment.amount,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Store credit balance for next installment if overpaid
      if (hasOverpayment && newStatus !== 'paid_off') {
        updateData.credit_balance_usd = (loan.credit_balance_usd || 0) + creditAmount;
      }

      await db
        .from('loans')
        .update(updateData)
        .eq('id', payment.loan_id)
        .execute();

      logger.info(`Loan ${payment.loan_id} repayment: $${payment.amount}, new balance: $${newBalance}${hasOverpayment ? `, credit: $${creditAmount.toFixed(2)}` : ''}`, { action: 'payment.link_loan' });

      // F4: Audit trail for repayment and status transition
      db.from('audit_log').insert({
        user_id: payment.customer_id || 'system',
        user_type: payment.customer_id ? 'customer' : 'system',
        action: 'loan.repayment_applied',
        entity_type: 'loan',
        entity_id: payment.loan_id,
        description: `Repayment of $${payment.amount} applied. Balance: $${newBalance.toFixed(2)}${hasOverpayment ? `. Overpayment of $${creditAmount.toFixed(2)} credited.` : ''}`,
        changes: JSON.stringify({
          payment_id: payment.id,
          amount: payment.amount,
          previous_balance: loan.outstanding_balance || loan.principal_amount,
          new_balance: newBalance,
          credit_amount: creditAmount,
          previous_status: previousStatus,
          new_status: newStatus,
          payment_type: payment.payment_type,
        }),
        created_at: new Date().toISOString(),
      }).execute().catch(err => logger.error('Failed to create audit log for repayment', { error: err instanceof Error ? err.message : String(err), action: 'payment.audit_log' }));

    } else if (payment.payment_type === 'disbursement') {
      // Disbursement: mark loan as active with disbursement details
      await db
        .from('loans')
        .update({
          status: 'active',
          disbursement_date: payment.completed_at || new Date().toISOString(),
          disbursement_amount: payment.amount,
          outstanding_balance: payment.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.loan_id)
        .execute();

      logger.info(`Loan ${payment.loan_id} disbursed: $${payment.amount}`, { action: 'payment.link_loan' });

      // F4: Audit trail for disbursement
      db.from('audit_log').insert({
        user_id: 'system',
        user_type: 'system',
        action: 'loan.disbursed',
        entity_type: 'loan',
        entity_id: payment.loan_id,
        description: `Loan disbursed: $${payment.amount}. Status: active`,
        changes: JSON.stringify({ payment_id: payment.id, amount: payment.amount, new_status: 'active' }),
        created_at: new Date().toISOString(),
      }).execute().catch(err => logger.error('Failed to create audit log for disbursement', { error: err instanceof Error ? err.message : String(err), action: 'payment.audit_log' }));
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
   * Initiate push-to-wallet disbursement for digital loans.
   * Called after terms acceptance for digital credit products.
   */
  async initiateDisbursement(request: {
    loan_id: string;
    customer_id: string;
    amount: number;
    customer_phone: string;
    disbursement_method: string; // 'ecocash' | 'onemoney' | 'innbucks'
    currency?: string;
  }): Promise<{
    payment_id: string;
    transaction_id: string;
    gateway: PaymentGateway;
  }> {
    try {
      logger.info('Initiating digital loan disbursement', {
        action: 'payment.disburse',
        meta: { loanId: request.loan_id, amount: request.amount, method: request.disbursement_method },
      });

      // Validate loan status — only approved or terms_accepted loans can be disbursed
      const { data: loan } = await db
        .from('loans')
        .select('id, status')
        .eq('id', request.loan_id)
        .single()
        .execute();

      if (!loan) {
        throw new Error('Loan not found');
      }

      if (!['approved', 'terms_accepted'].includes(loan.status)) {
        throw new Error(`Loan status "${loan.status}" is not eligible for disbursement`);
      }

      // Map disbursement method to payment gateway
      const gateway = (request.disbursement_method || 'ecocash') as PaymentGateway;

      // Use the existing initiatePayment flow with payment_type 'disbursement'
      const result = await this.initiatePayment({
        loan_id: request.loan_id,
        customer_id: request.customer_id,
        amount: request.amount,
        currency: (request.currency || 'USD') as 'USD' | 'ZWL',
        customer_phone: request.customer_phone,
        gateway,
        payment_type: 'disbursement',
        description: `Digital loan disbursement to ${request.disbursement_method}`,
      });

      logger.info('Digital loan disbursement initiated', {
        action: 'payment.disburse',
        meta: { loanId: request.loan_id, paymentId: result.payment_id, gateway },
      });

      return {
        payment_id: result.payment_id,
        transaction_id: result.transaction_id,
        gateway: result.gateway,
      };

    } catch (error) {
      logger.error('Failed to initiate disbursement', {
        action: 'payment.disburse',
        meta: { loanId: request.loan_id, error: error instanceof Error ? error.message : 'Unknown' },
      });
      throw new Error(`Disbursement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
