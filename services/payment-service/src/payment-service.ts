import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EcoCashProvider, PaymentRequest, PaymentResponse, PaymentStatusResponse } from './ecocash-provider';
import { OneMoneyProvider } from './onemoney-provider';

/**
 * Payment Gateway Type
 */
export type PaymentGateway = 'ecocash' | 'onemoney';

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
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  gateway: PaymentGateway;
  gateway_transaction_id?: string;
  gateway_reference?: string;
  payment_type: string;
  description?: string;
  initiated_at: Date;
  completed_at?: Date;
  failed_at?: Date;
}

/**
 * Unified Payment Service
 * Handles all payment operations across multiple gateways
 */
export class PaymentService {
  private supabase: SupabaseClient;
  private ecocashProvider: EcoCashProvider;
  private onemoneyProvider: OneMoneyProvider;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.ecocashProvider = new EcoCashProvider();
    this.onemoneyProvider = new OneMoneyProvider();

    console.log('PaymentService initialized');
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
      // Select payment gateway
      const gateway = request.gateway || await this.selectGateway(request.customer_id);

      console.log(`Initiating payment via ${gateway} for loan ${request.loan_id}`);

      // Generate payment reference
      const paymentReference = this.generatePaymentReference();

      // Create payment record in database
      const { data: payment, error: paymentError } = await this.supabase
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
        .single();

      if (paymentError || !payment) {
        console.error('Error creating payment record:', paymentError);
        throw new Error('Failed to create payment record');
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
      let response: PaymentResponse;
      let instructions: string;

      if (gateway === 'ecocash') {
        response = await this.ecocashProvider.initiatePayment(paymentReq);
        instructions = this.ecocashProvider.generatePaymentInstructions(request.amount, paymentReference);
      } else {
        response = await this.onemoneyProvider.initiatePayment(paymentReq);
        instructions = this.onemoneyProvider.generatePaymentInstructions(request.amount, paymentReference);
      }

      // Update payment record with gateway transaction ID
      await this.supabase
        .from('payments')
        .update({
          gateway_transaction_id: response.transaction_id,
          status: response.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      console.log(`Payment ${payment.id} initiated via ${gateway}: ${response.transaction_id}`);

      return {
        payment_id: payment.id,
        transaction_id: response.transaction_id,
        gateway: gateway,
        ussd_code: response.ussd_code,
        payment_url: response.payment_url,
        instructions: instructions
      };

    } catch (error) {
      console.error('Error initiating payment:', error);
      throw new Error(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(paymentId: string): Promise<Payment> {
    try {
      // Fetch payment from database
      const { data: payment, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error || !payment) {
        throw new Error('Payment not found');
      }

      // If payment is already completed/failed, return cached status
      if (['completed', 'failed', 'cancelled'].includes(payment.status)) {
        return payment;
      }

      // Check status with gateway if pending/processing
      if (payment.gateway_transaction_id) {
        let statusResponse: PaymentStatusResponse;

        if (payment.gateway === 'ecocash') {
          statusResponse = await this.ecocashProvider.checkPaymentStatus(payment.gateway_transaction_id);
        } else {
          statusResponse = await this.onemoneyProvider.checkPaymentStatus(payment.gateway_transaction_id);
        }

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
      console.error('Error checking payment status:', error);
      throw new Error(`Failed to check payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process payment completion (called by webhook or status check)
   */
  async processPaymentCompletion(paymentId: string): Promise<void> {
    try {
      console.log(`Processing payment completion for ${paymentId}`);

      // Fetch payment
      const { data: payment, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error || !payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        console.log(`Payment ${paymentId} is not completed (status: ${payment.status})`);
        return;
      }

      // Update loan with payment
      await this.linkPaymentToLoan(payment);

      // TODO: Trigger next step based on payment type
      // - If deposit: Move loan to 'paid_deposit' status
      // - If repayment: Update loan balance, check if fully paid
      // - If penalty: Update penalty records

      console.log(`Payment ${paymentId} processed successfully`);

    } catch (error) {
      console.error('Error processing payment completion:', error);
      throw error;
    }
  }

  /**
   * Link payment to loan and update loan status
   */
  private async linkPaymentToLoan(payment: Payment): Promise<void> {
    const { data: loan, error: loanError } = await this.supabase
      .from('loans')
      .select('*')
      .eq('id', payment.loan_id)
      .single();

    if (loanError || !loan) {
      console.error('Loan not found:', payment.loan_id);
      return;
    }

    if (payment.payment_type === 'deposit') {
      // Update loan status to paid_deposit
      await this.supabase
        .from('loans')
        .update({
          deposit_paid: true,
          deposit_amount: payment.amount,
          deposit_paid_at: payment.completed_at,
          status: 'paid_deposit',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.loan_id);

      console.log(`Loan ${payment.loan_id} deposit paid: $${payment.amount}`);

    } else if (payment.payment_type === 'repayment') {
      // Update loan balance
      const newBalance = (loan.outstanding_balance || loan.principal_amount) - payment.amount;

      await this.supabase
        .from('loans')
        .update({
          outstanding_balance: newBalance,
          last_payment_date: payment.completed_at,
          last_payment_amount: payment.amount,
          status: newBalance <= 0 ? 'paid_off' : 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.loan_id);

      console.log(`Loan ${payment.loan_id} repayment: $${payment.amount}, new balance: $${newBalance}`);
    }
  }

  /**
   * Update payment status in database
   */
  private async updatePaymentStatus(
    paymentId: string,
    statusResponse: PaymentStatusResponse
  ): Promise<void> {
    const updateData: any = {
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

    await this.supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId);

    console.log(`Payment ${paymentId} status updated to ${statusResponse.status}`);
  }

  /**
   * Select payment gateway based on customer preference or availability
   */
  private async selectGateway(customerId: string): Promise<PaymentGateway> {
    // Check customer preference
    const { data: customer } = await this.supabase
      .from('customers')
      .select('preferred_payment_gateway')
      .eq('id', customerId)
      .single();

    if (customer?.preferred_payment_gateway) {
      return customer.preferred_payment_gateway as PaymentGateway;
    }

    // Default to EcoCash (70% market share)
    return 'ecocash';
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
  }> {
    try {
      console.log(`Starting payment reconciliation (max age: ${maxAge} hours)`);

      const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);

      // Fetch all pending/processing payments
      const { data: payments, error } = await this.supabase
        .from('payments')
        .select('*')
        .in('status', ['pending', 'processing'])
        .gte('initiated_at', cutoffTime.toISOString());

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
          console.error(`Error reconciling payment ${payment.id}:`, error);
        }
      }

      console.log(`Reconciliation complete: ${checked} checked, ${updated} updated, ${completed} completed, ${failed} failed`);

      return { checked, updated, completed, failed };

    } catch (error) {
      console.error('Error during payment reconciliation:', error);
      throw error;
    }
  }
}
