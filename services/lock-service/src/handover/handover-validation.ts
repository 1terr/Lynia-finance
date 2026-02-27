/**
 * Handover Validation Module
 *
 * Readiness checks, identity verification, and deposit verification
 * for the device handover workflow.
 */

import { db } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import type { DeviceCondition } from './handover-types';

/**
 * Check if loan is ready for handover
 */
export async function checkHandoverReadiness(loanId: string): Promise<{
  ready: boolean;
  blockers: string[];
}> {
  const blockers: string[] = [];

  try {
    // Fetch loan with related data
    const { data: loan, error: loanError } = await db
      .from('loans')
      .select(`
        *,
        customers(*),
        devices(*)
      `)
      .eq('id', loanId)
      .single()
      .execute();

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
    const { data: customer } = await db
      .from('customers')
      .select('kyc_status')
      .eq('id', loan.customer_id)
      .single()
      .execute();

    if (customer?.kyc_status !== 'verified') {
      blockers.push(`KYC not verified (status: ${customer?.kyc_status || 'unknown'})`);
    }

    // Check device availability
    if (!loan.device_id) {
      blockers.push('Device not assigned to loan');
    } else {
      const { data: device } = await db
        .from('devices')
        .select('status')
        .eq('id', loan.device_id)
        .single()
        .execute();

      if (device?.status !== 'in_stock') {
        blockers.push(`Device not available (status: ${device?.status || 'unknown'})`);
      }
    }

    return {
      ready: blockers.length === 0,
      blockers
    };

  } catch (error) {
    logger.error('Error checking handover readiness', { action: 'lock.handover.checkReadiness', loanId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    blockers.push('Error checking handover readiness');
    return { ready: false, blockers };
  }
}

/**
 * Verify customer identity at handover
 */
export async function verifyCustomerIdentity(
  handoverId: string,
  presentedIdNumber: string
): Promise<{ verified: boolean; reason?: string }> {
  try {
    // Get handover record
    const { data: handover } = await db
      .from('device_handovers')
      .select('*, customers(*)')
      .eq('id', handoverId)
      .single()
      .execute();

    if (!handover) {
      throw new Error('Handover not found');
    }

    // Get customer's KYC submission
    const { data: kycSubmission } = await db
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', handover.customer_id)
      .eq('status', 'verified')
      .order('verified_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

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
    await db
      .from('device_handovers')
      .update({
        identity_verified: true,
        status: 'identity_verified',
        updated_at: new Date().toISOString()
      })
      .eq('id', handoverId)
      .execute();

    logger.info('Identity verified', { action: 'lock.handover.verifyIdentity', handoverId });
    return { verified: true };

  } catch (error) {
    logger.error('Error verifying customer identity', { action: 'lock.handover.verifyIdentity', handoverId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Verify deposit payment (CRITICAL CHECKPOINT)
 */
export async function verifyDepositPayment(handoverId: string): Promise<{
  verified: boolean;
  payment_id?: string;
  amount?: number;
  reason?: string;
}> {
  try {
    logger.info('Verifying deposit payment', { action: 'lock.handover.verifyDeposit', handoverId });

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

    // Check if loan has deposit payment completed
    const { data: loan } = await db
      .from('loans')
      .select('deposit_paid, deposit_amount, deposit_paid_at')
      .eq('id', handover.loan_id)
      .single()
      .execute();

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
    const { data: payment } = await db
      .from('payments')
      .select('*')
      .eq('loan_id', handover.loan_id)
      .eq('payment_type', 'deposit')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    if (!payment) {
      return {
        verified: false,
        reason: 'No completed deposit payment found'
      };
    }

    // Update handover record
    await db
      .from('device_handovers')
      .update({
        deposit_verified: true,
        status: 'deposit_verified',
        updated_at: new Date().toISOString()
      })
      .eq('id', handoverId)
      .execute();

    logger.info('Deposit verified', { action: 'lock.handover.verifyDeposit', handoverId, paymentId: payment.id });

    return {
      verified: true,
      payment_id: payment.id,
      amount: payment.amount
    };

  } catch (error) {
    logger.error('Error verifying deposit payment', { action: 'lock.handover.verifyDeposit', handoverId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Record device condition inspection
 */
export async function recordDeviceCondition(
  handoverId: string,
  deviceCondition: DeviceCondition
): Promise<void> {
  try {
    await db
      .from('device_handovers')
      .update({
        device_condition: deviceCondition,
        device_condition_verified: true,
        status: 'device_inspected',
        updated_at: new Date().toISOString()
      })
      .eq('id', handoverId)
      .execute();

    logger.info('Device condition recorded', { action: 'lock.handover.recordDeviceCondition', handoverId });
  } catch (error) {
    logger.error('Error recording device condition', { action: 'lock.handover.recordDeviceCondition', handoverId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}
