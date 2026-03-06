/**
 * Commission Calculator Module
 *
 * Calculates distributor commissions based on loan amounts
 * and distributor-specific commission rates.
 */

import { db } from '../../../shared/clients/database';

/**
 * Calculate distributor commission (default 5% of loan amount)
 */
export async function calculateDistributorCommission(
  loanId: string,
  deviceId: string,
  distributorId: string
): Promise<{
  amount: number;
  percentage: number;
  loan_amount: number;
  device_price: number;
  device_model: string;
}> {
  // Get loan details for commission base
  const { data: loan } = await db
    .from('loans')
    .select('principal')
    .eq('id', loanId)
    .single()
    .execute();

  if (!loan) {
    throw new Error('Loan not found');
  }

  // Get device details for record-keeping
  const { data: device } = await db
    .from('devices')
    .select('retail_price, model')
    .eq('id', deviceId)
    .single()
    .execute();

  if (!device) {
    throw new Error('Device not found');
  }

  // Get distributor's commission rate (default 5%)
  const { data: distributor } = await db
    .from('distributors')
    .select('commission_rate')
    .eq('id', distributorId)
    .single()
    .execute();

  const percentageRate = distributor?.commission_rate ?? 5;
  const commissionAmount = Math.round(loan.principal * percentageRate) / 100;

  return {
    amount: commissionAmount,
    percentage: percentageRate,
    loan_amount: loan.principal,
    device_price: device.retail_price,
    device_model: device.model
  };
}
