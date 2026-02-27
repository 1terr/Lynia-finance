/**
 * Handover Workflow Module
 *
 * Initiate, complete, and status tracking for the device handover process.
 */

import { db } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import type { InitiateHandoverRequest, HandoverRecord } from './handover-types';
import { checkHandoverReadiness } from './handover-validation';
import { calculateDistributorCommission } from './commission-calculator';

/**
 * Initiate device handover workflow
 */
export async function initiateHandover(request: InitiateHandoverRequest): Promise<HandoverRecord> {
  try {
    logger.info('Initiating handover', { action: 'lock.handover.initiate', loanId: request.loan_id, deviceId: request.device_id });

    // Check if handover is ready
    const readiness = await checkHandoverReadiness(request.loan_id);
    if (!readiness.ready) {
      throw new Error(`Handover not ready: ${readiness.blockers.join(', ')}`);
    }

    // Create handover record
    const { data: handover, error: handoverError } = await db
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
      .single()
      .execute();

    if (handoverError || !handover) {
      logger.error('Error creating handover record', { action: 'lock.handover.initiate', loanId: request.loan_id, errorMessage: handoverError instanceof Error ? handoverError.message : 'Unknown error' });
      throw new Error('Failed to create handover record');
    }

    logger.info('Handover initiated', { action: 'lock.handover.initiate', handoverId: handover.id, loanId: request.loan_id });
    return handover as HandoverRecord;

  } catch (error) {
    logger.error('Error initiating handover', { action: 'lock.handover.initiate', loanId: request.loan_id, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Complete handover and activate loan
 */
export async function completeHandover(handoverId: string): Promise<{
  success: boolean;
  loan_id: string;
  commission: {
    amount: number;
    percentage: number;
  };
}> {
  try {
    logger.info('Completing handover', { action: 'lock.handover.complete', handoverId });

    // Get handover record
    const { data: handover } = await db
      .from('device_handovers')
      .select('*')
      .eq('id', handoverId)
      .single()
      .execute();

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
    await db
      .from('loans')
      .update({
        status: 'active',
        disbursed_at: handoverDate.toISOString(),
        next_payment_date: firstPaymentDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', handover.loan_id)
      .execute();

    // Update device status to 'assigned'
    await db
      .from('devices')
      .update({
        status: 'assigned',
        customer_id: handover.customer_id,
        loan_id: handover.loan_id,
        assigned_at: handoverDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', handover.device_id)
      .execute();

    // Update agent inventory record
    await db
      .from('agent_inventory')
      .update({
        status: 'sold',
        sold_date: handoverDate.toISOString(),
        sold_to_customer_id: handover.customer_id,
        sold_loan_id: handover.loan_id,
        updated_at: new Date().toISOString()
      })
      .eq('device_id', handover.device_id)
      .execute();

    // Calculate distributor commission
    const commission = await calculateDistributorCommission(
      handover.loan_id,
      handover.device_id,
      handover.distributor_id
    );

    // Record distributor commission (based on loan amount)
    await db
      .from('distributor_commissions')
      .insert({
        distributor_id: handover.distributor_id,
        loan_id: handover.loan_id,
        device_id: handover.device_id,
        commission_amount_usd: commission.amount,
        commission_percentage: commission.percentage,
        loan_amount_usd: commission.loan_amount,
        device_retail_price_usd: commission.device_price,
        calculation_date: handoverDate.toISOString(),
        payment_status: 'pending',
        notes: `Commission for device handover - ${commission.device_model}`,
        created_at: handoverDate.toISOString()
      })
      .execute();

    // Update handover record
    await db
      .from('device_handovers')
      .update({
        status: 'completed',
        handed_over_at: handoverDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', handoverId)
      .execute();

    logger.info('Handover completed successfully', { action: 'lock.handover.complete', handoverId, loanId: handover.loan_id, commissionAmount: commission.amount, commissionPercentage: commission.percentage });

    return {
      success: true,
      loan_id: handover.loan_id,
      commission: {
        amount: commission.amount,
        percentage: commission.percentage
      }
    };

  } catch (error) {
    logger.error('Error completing handover', { action: 'lock.handover.complete', handoverId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });

    // Mark handover as failed
    await db
      .from('device_handovers')
      .update({
        status: 'failed',
        failure_reason: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', handoverId)
      .execute();

    throw error;
  }
}

/**
 * Get handover status
 */
export async function getHandoverStatus(handoverId: string): Promise<HandoverRecord> {
  try {
    const { data: handover, error } = await db
      .from('device_handovers')
      .select('*')
      .eq('id', handoverId)
      .single()
      .execute();

    if (error || !handover) {
      throw new Error('Handover not found');
    }

    return handover as HandoverRecord;

  } catch (error) {
    logger.error('Error getting handover status', { action: 'lock.handover.getStatus', handoverId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Generate handover confirmation message for WhatsApp
 */
export function generateHandoverConfirmation(
  customerName: string,
  deviceModel: string,
  loanAmount: number,
  monthlyPayment: number,
  firstPaymentDate: Date
): string {
  return `
\uD83C\uDF89 *Device Handover Complete!*

You've received your ${deviceModel}

*Loan Details*:
Amount Financed: $${loanAmount.toFixed(2)}
Monthly Payment: $${monthlyPayment.toFixed(2)}
First Payment Due: ${firstPaymentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

*Payment Instructions*:
You'll receive payment reminders 3 days before your due date.

*Need Help?*
Reply HELP or contact +263 771 234 567

Welcome to Lynia Finance! \uD83D\uDC9A
  `.trim();
}
