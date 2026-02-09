import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Device Handover Request
 */
export interface InitiateHandoverRequest {
  loan_id: string;
  device_id: string;
  customer_id: string;
  distributor_id: string;
  handover_location: string;
  handed_over_by: string;
}

/**
 * Handover Record
 */
export interface HandoverRecord {
  id: string;
  loan_id: string;
  device_id: string;
  customer_id: string;
  distributor_id: string;
  handover_location: string;
  handed_over_by: string;
  handed_over_at?: Date;
  status: 'initiated' | 'identity_verified' | 'deposit_verified' | 'device_inspected' | 'completed' | 'failed';
  identity_verified: boolean;
  deposit_verified: boolean;
  device_condition_verified: boolean;
  app_installed: boolean;
  app_configured: boolean;
  lock_test_passed: boolean;
  device_condition?: any;
  customer_signature_url?: string;
  loan_agreement_url?: string;
  device_condition_form_url?: string;
  failure_reason?: string;
  created_at: Date;
}

/**
 * Device Handover Service
 * Manages the complete device handover workflow
 */
export class HandoverService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('HandoverService initialized');
  }

  /**
   * Check if loan is ready for handover
   */
  async checkHandoverReadiness(loanId: string): Promise<{
    ready: boolean;
    blockers: string[];
  }> {
    const blockers: string[] = [];

    try {
      // Fetch loan with related data
      const { data: loan, error: loanError } = await this.supabase
        .from('loans')
        .select(`
          *,
          customers(*),
          devices(*)
        `)
        .eq('id', loanId)
        .single();

      if (loanError || !loan) {
        blockers.push('Loan not found');
        return { ready: false, blockers };
      }

      // Check loan status
      if (loan.status !== 'paid_deposit') {
        blockers.push(`Loan status must be 'paid_deposit', currently: ${loan.status}`);
      }

      // Check deposit payment
      if (!loan.deposit_paid) {
        blockers.push('Deposit not paid');
      }

      // Check KYC verification
      const { data: customer } = await this.supabase
        .from('customers')
        .select('kyc_status')
        .eq('id', loan.customer_id)
        .single();

      if (customer?.kyc_status !== 'verified') {
        blockers.push(`KYC not verified (status: ${customer?.kyc_status || 'unknown'})`);
      }

      // Check device availability
      if (!loan.device_id) {
        blockers.push('Device not assigned to loan');
      } else {
        const { data: device } = await this.supabase
          .from('devices')
          .select('status')
          .eq('id', loan.device_id)
          .single();

        if (device?.status !== 'in_stock') {
          blockers.push(`Device not available (status: ${device?.status || 'unknown'})`);
        }
      }

      return {
        ready: blockers.length === 0,
        blockers
      };

    } catch (error) {
      console.error('Error checking handover readiness:', error);
      blockers.push('Error checking handover readiness');
      return { ready: false, blockers };
    }
  }

  /**
   * Initiate device handover workflow
   */
  async initiateHandover(request: InitiateHandoverRequest): Promise<HandoverRecord> {
    try {
      console.log(`Initiating handover for loan ${request.loan_id}`);

      // Check if handover is ready
      const readiness = await this.checkHandoverReadiness(request.loan_id);
      if (!readiness.ready) {
        throw new Error(`Handover not ready: ${readiness.blockers.join(', ')}`);
      }

      // Create handover record
      const { data: handover, error: handoverError } = await this.supabase
        .from('device_handovers')
        .insert({
          loan_id: request.loan_id,
          device_id: request.device_id,
          customer_id: request.customer_id,
          distributor_id: request.distributor_id,
          handover_location: request.handover_location,
          handed_over_by: request.handed_over_by,
          status: 'initiated',
          identity_verified: false,
          deposit_verified: false,
          device_condition_verified: false,
          app_installed: false,
          app_configured: false,
          lock_test_passed: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (handoverError || !handover) {
        console.error('Error creating handover record:', handoverError);
        throw new Error('Failed to create handover record');
      }

      console.log(`Handover ${handover.id} initiated`);
      return handover as HandoverRecord;

    } catch (error) {
      console.error('Error initiating handover:', error);
      throw error;
    }
  }

  /**
   * Verify customer identity at handover
   */
  async verifyCustomerIdentity(
    handoverId: string,
    presentedIdNumber: string
  ): Promise<{ verified: boolean; reason?: string }> {
    try {
      // Get handover record
      const { data: handover } = await this.supabase
        .from('device_handovers')
        .select('*, customers(*)')
        .eq('id', handoverId)
        .single();

      if (!handover) {
        throw new Error('Handover not found');
      }

      // Get customer's KYC submission
      const { data: kycSubmission } = await this.supabase
        .from('kyc_submissions')
        .select('*')
        .eq('customer_id', handover.customer_id)
        .eq('status', 'verified')
        .order('verified_at', { ascending: false })
        .limit(1)
        .single();

      if (!kycSubmission) {
        return {
          verified: false,
          reason: 'No verified KYC record found'
        };
      }

      // Verify ID number matches KYC record
      if (kycSubmission.id_number !== presentedIdNumber.toUpperCase()) {
        return {
          verified: false,
          reason: 'ID number does not match KYC record'
        };
      }

      // Update handover record
      await this.supabase
        .from('device_handovers')
        .update({
          identity_verified: true,
          status: 'identity_verified',
          updated_at: new Date().toISOString()
        })
        .eq('id', handoverId);

      console.log(`Identity verified for handover ${handoverId}`);
      return { verified: true };

    } catch (error) {
      console.error('Error verifying customer identity:', error);
      throw error;
    }
  }

  /**
   * Verify deposit payment (CRITICAL CHECKPOINT)
   */
  async verifyDepositPayment(handoverId: string): Promise<{
    verified: boolean;
    payment_id?: string;
    amount?: number;
    reason?: string;
  }> {
    try {
      console.log(`Verifying deposit payment for handover ${handoverId}`);

      // Get handover record
      const { data: handover } = await this.supabase
        .from('device_handovers')
        .select('*')
        .eq('id', handoverId)
        .single();

      if (!handover) {
        throw new Error('Handover not found');
      }

      // Check if loan has deposit payment completed
      const { data: loan } = await this.supabase
        .from('loans')
        .select('deposit_paid, deposit_amount, deposit_paid_at')
        .eq('id', handover.loan_id)
        .single();

      if (!loan) {
        return {
          verified: false,
          reason: 'Loan not found'
        };
      }

      if (!loan.deposit_paid) {
        return {
          verified: false,
          reason: 'Deposit not paid'
        };
      }

      // Get deposit payment record
      const { data: payment } = await this.supabase
        .from('payments')
        .select('*')
        .eq('loan_id', handover.loan_id)
        .eq('payment_type', 'deposit')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (!payment) {
        return {
          verified: false,
          reason: 'No completed deposit payment found'
        };
      }

      // Update handover record
      await this.supabase
        .from('device_handovers')
        .update({
          deposit_verified: true,
          status: 'deposit_verified',
          updated_at: new Date().toISOString()
        })
        .eq('id', handoverId);

      console.log(`Deposit verified for handover ${handoverId}: $${payment.amount}`);

      return {
        verified: true,
        payment_id: payment.id,
        amount: payment.amount
      };

    } catch (error) {
      console.error('Error verifying deposit payment:', error);
      throw error;
    }
  }

  /**
   * Record device condition inspection
   */
  async recordDeviceCondition(
    handoverId: string,
    deviceCondition: {
      screen_condition: 'excellent' | 'good' | 'fair' | 'poor';
      body_condition: 'excellent' | 'good' | 'fair' | 'poor';
      buttons_functional: boolean;
      ports_functional: boolean;
      cameras_functional: boolean;
      powers_on: boolean;
      touch_responsive: boolean;
      wifi_works: boolean;
      cellular_works: boolean;
      calls_work: boolean;
      accessories_included: string[];
      notes?: string;
    }
  ): Promise<void> {
    try {
      await this.supabase
        .from('device_handovers')
        .update({
          device_condition: deviceCondition,
          device_condition_verified: true,
          status: 'device_inspected',
          updated_at: new Date().toISOString()
        })
        .eq('id', handoverId);

      console.log(`Device condition recorded for handover ${handoverId}`);
    } catch (error) {
      console.error('Error recording device condition:', error);
      throw error;
    }
  }

  /**
   * Complete handover and activate loan
   */
  async completeHandover(handoverId: string): Promise<{
    success: boolean;
    loan_id: string;
    commission: {
      amount: number;
      percentage: number;
    };
  }> {
    try {
      console.log(`Completing handover ${handoverId}`);

      // Get handover record
      const { data: handover } = await this.supabase
        .from('device_handovers')
        .select('*')
        .eq('id', handoverId)
        .single();

      if (!handover) {
        throw new Error('Handover not found');
      }

      // Verify all required steps completed
      if (!handover.identity_verified) {
        throw new Error('Identity not verified');
      }

      if (!handover.deposit_verified) {
        throw new Error('Deposit not verified - HANDOVER CANNOT PROCEED');
      }

      if (!handover.device_condition_verified) {
        throw new Error('Device condition not verified');
      }

      // Calculate first payment date (30 days from now)
      const handoverDate = new Date();
      const firstPaymentDate = new Date(handoverDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Update loan status to 'active'
      await this.supabase
        .from('loans')
        .update({
          status: 'active',
          disbursed_at: handoverDate.toISOString(),
          next_payment_date: firstPaymentDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', handover.loan_id);

      // Update device status to 'assigned'
      await this.supabase
        .from('devices')
        .update({
          status: 'assigned',
          customer_id: handover.customer_id,
          loan_id: handover.loan_id,
          assigned_at: handoverDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', handover.device_id);

      // Update agent inventory record
      await this.supabase
        .from('agent_inventory')
        .update({
          status: 'sold',
          sold_date: handoverDate.toISOString(),
          sold_to_customer_id: handover.customer_id,
          sold_loan_id: handover.loan_id,
          updated_at: new Date().toISOString()
        })
        .eq('device_id', handover.device_id);

      // Calculate distributor commission
      const commission = await this.calculateDistributorCommission(
        handover.loan_id,
        handover.device_id,
        handover.distributor_id
      );

      // Record distributor commission
      await this.supabase
        .from('distributor_commissions')
        .insert({
          distributor_id: handover.distributor_id,
          loan_id: handover.loan_id,
          device_id: handover.device_id,
          commission_amount_usd: commission.amount,
          commission_percentage: commission.percentage,
          device_retail_price_usd: commission.device_price,
          calculation_date: handoverDate.toISOString(),
          payment_status: 'pending',
          notes: `Commission for device handover - ${commission.device_model}`,
          created_at: handoverDate.toISOString()
        });

      // Update handover record
      await this.supabase
        .from('device_handovers')
        .update({
          status: 'completed',
          handed_over_at: handoverDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', handoverId);

      console.log(`Handover ${handoverId} completed successfully`);
      console.log(`Loan ${handover.loan_id} activated`);
      console.log(`Distributor commission: $${commission.amount}`);

      return {
        success: true,
        loan_id: handover.loan_id,
        commission: {
          amount: commission.amount,
          percentage: commission.percentage
        }
      };

    } catch (error) {
      console.error('Error completing handover:', error);

      // Mark handover as failed
      await this.supabase
        .from('device_handovers')
        .update({
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', handoverId);

      throw error;
    }
  }

  /**
   * Calculate distributor commission (5% of device retail price)
   */
  private async calculateDistributorCommission(
    loanId: string,
    deviceId: string,
    _distributorId: string
  ): Promise<{
    amount: number;
    percentage: number;
    device_price: number;
    device_model: string;
  }> {
    // Get device details
    const { data: device } = await this.supabase
      .from('devices')
      .select('retail_price_usd, model')
      .eq('id', deviceId)
      .single();

    if (!device) {
      throw new Error('Device not found');
    }

    // Commission rate: 5% of device retail price
    const COMMISSION_RATE = 0.05;
    const commissionAmount = device.retail_price_usd * COMMISSION_RATE;

    return {
      amount: commissionAmount,
      percentage: COMMISSION_RATE * 100,
      device_price: device.retail_price_usd,
      device_model: device.model
    };
  }

  /**
   * Get handover status
   */
  async getHandoverStatus(handoverId: string): Promise<HandoverRecord> {
    try {
      const { data: handover, error } = await this.supabase
        .from('device_handovers')
        .select('*')
        .eq('id', handoverId)
        .single();

      if (error || !handover) {
        throw new Error('Handover not found');
      }

      return handover as HandoverRecord;

    } catch (error) {
      console.error('Error getting handover status:', error);
      throw error;
    }
  }

  /**
   * Generate handover confirmation message for WhatsApp
   */
  generateHandoverConfirmation(
    customerName: string,
    deviceModel: string,
    loanAmount: number,
    monthlyPayment: number,
    firstPaymentDate: Date
  ): string {
    return `
🎉 *Device Handover Complete!*

You've received your ${deviceModel}

*Loan Details*:
Amount Financed: $${loanAmount.toFixed(2)}
Monthly Payment: $${monthlyPayment.toFixed(2)}
First Payment Due: ${firstPaymentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

*Payment Instructions*:
You'll receive payment reminders 3 days before your due date.

*Need Help?*
Reply HELP or contact +263 771 234 567

Welcome to Lynia Finance! 💚
    `.trim();
  }
}
