import type { PendingHandover, HandoverResult, DeviceCondition } from '@/types/distributor';
import { fetchAPI } from '@lynia/api-client';
import { delay, useMock } from '@/test/mocks/utils';
import { mockPendingHandovers } from '@/test/mocks/handovers';

/**
 * Fetch pending handovers for the distributor
 */
export async function fetchPendingHandovers(): Promise<PendingHandover[]> {
  if (useMock()) {
    await delay(400);
    return [...mockPendingHandovers];
  }
  return fetchAPI<PendingHandover[]>('/api/v1/distributor/handovers?status=initiated');
}

/**
 * Verify customer national ID during handover process
 */
export async function verifyCustomerIdentity(
  handoverId: string,
  nationalId: string,
): Promise<{ verified: boolean; message: string }> {
  if (useMock()) {
    await delay(800);
    const handover = mockPendingHandovers.find((h) => h.id === handoverId);
    if (!handover) return { verified: false, message: 'Handover not found' };
    const valid = /^\d{2}-\d{6,7}[A-Z]\d{2}$/.test(nationalId);
    return {
      verified: valid,
      message: valid ? 'Identity verified successfully' : 'Invalid National ID format',
    };
  }
  return fetchAPI<{ verified: boolean; message: string }>(
    `/api/v1/distributor/handovers/${handoverId}/verify-identity`,
    { method: 'POST', body: JSON.stringify({ national_id: nationalId }) },
  );
}

/**
 * Verify device IMEI matches expected IMEI for handover
 */
export async function verifyImei(
  handoverId: string,
  imei: string,
  expectedImei: string,
): Promise<{ verified: boolean; message: string }> {
  if (useMock()) {
    await delay(600);
    const valid = imei.length === 15 && /^\d{15}$/.test(imei);
    if (!valid) return { verified: false, message: 'IMEI must be exactly 15 digits' };
    const matches = imei === expectedImei;
    return {
      verified: matches,
      message: matches ? 'IMEI verified — matches device record' : 'IMEI does not match the assigned device',
    };
  }
  return fetchAPI<{ verified: boolean; message: string }>(
    `/api/v1/distributor/handovers/${handoverId}/verify-imei`,
    { method: 'POST', body: JSON.stringify({ imei, expected_imei: expectedImei }) },
  );
}

/**
 * Verify deposit payment for handover
 */
export async function verifyDepositPayment(
  handoverId: string,
  paymentMethod: string,
  transactionRef: string,
): Promise<{ verified: boolean; amount: number; message: string }> {
  if (useMock()) {
    await delay(1000);
    if (!transactionRef || transactionRef.length < 4) {
      return { verified: false, amount: 0, message: 'Invalid transaction reference' };
    }
    return {
      verified: true,
      amount: 40,
      message: `Deposit of $40.00 verified via ${paymentMethod}`,
    };
  }
  return fetchAPI<{ verified: boolean; amount: number; message: string }>(
    `/api/v1/distributor/handovers/${handoverId}/verify-deposit`,
    { method: 'POST', body: JSON.stringify({ payment_method: paymentMethod, transaction_ref: transactionRef }) },
  );
}

/**
 * Submit completed handover with all verification data
 */
export async function submitHandover(data: {
  handover_id: string;
  customer_national_id: string;
  scanned_imei: string;
  device_condition: DeviceCondition;
  device_photos: string[];
  signature_data_url: string;
  deposit_payment_method: string;
  deposit_transaction_ref: string;
}): Promise<HandoverResult> {
  if (useMock()) {
    await delay(1200);
    const handover = mockPendingHandovers.find((h) => h.id === data.handover_id);
    if (!handover) throw new Error('Handover not found');
    const commission = handover.loan_amount * 0.05;
    const nextPayment = new Date();
    nextPayment.setDate(nextPayment.getDate() + 30);
    return {
      success: true,
      handover_id: data.handover_id,
      loan_id: handover.loan_id,
      commission_amount: commission,
      next_payment_date: nextPayment.toISOString(),
      message: `Device handed over to ${handover.customer_name}. Loan ${handover.loan_id} is now active.`,
    };
  }
  return fetchAPI<HandoverResult>('/api/v1/distributor/handovers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
