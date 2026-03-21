import type { ApprovedLoan, CompletedHandover, HandoverResult, DeviceCondition } from '@/types/distributor';
import { fetchAPI } from '@lynia/api-client';
import { delay, shouldUseMock } from '@/test/mocks/utils';
import { mockApprovedLoans, mockCompletedHandovers } from '@/test/mocks/handovers';

/**
 * Search for approved loans by customer name, national ID, or loan ID.
 * Any distributor can search — results are not scoped to a specific distributor.
 */
export async function searchApprovedLoans(query: string): Promise<ApprovedLoan[]> {
  if (shouldUseMock()) {
    await delay(500);
    const q = query.toLowerCase();
    return mockApprovedLoans.filter(
      (l) =>
        l.customer_name.toLowerCase().includes(q) ||
        l.loan_id.toLowerCase().includes(q),
    );
  }
  return fetchAPI<ApprovedLoan[]>(`/api/v1/distributor/handovers/search?q=${encodeURIComponent(query)}`);
}

/**
 * Fetch completed handovers for this distributor.
 */
export async function fetchCompletedHandovers(): Promise<CompletedHandover[]> {
  if (shouldUseMock()) {
    await delay(400);
    return [...mockCompletedHandovers];
  }
  return fetchAPI<CompletedHandover[]>('/api/v1/distributor/handovers?status=completed');
}

/**
 * Verify customer national ID against the loan application record.
 */
export async function verifyCustomerIdentity(
  loanId: string,
  nationalId: string,
): Promise<{ verified: boolean; message: string }> {
  if (shouldUseMock()) {
    await delay(800);
    const valid = /^\d{2}-\d{6,7}[A-Z]\d{2}$/.test(nationalId);
    return {
      verified: valid,
      message: valid ? 'Identity verified successfully' : 'Invalid National ID format',
    };
  }
  return fetchAPI<{ verified: boolean; message: string }>(
    `/api/v1/distributor/handovers/verify-identity`,
    { method: 'POST', body: JSON.stringify({ loan_id: loanId, national_id: nationalId }) },
  );
}

/**
 * Verify the selected device IMEI matches and is eligible for this loan.
 */
export async function verifyDeviceSelection(
  loanId: string,
  deviceId: string,
  imei: string,
): Promise<{ verified: boolean; message: string }> {
  if (shouldUseMock()) {
    await delay(600);
    const valid = imei.length === 15 && /^\d{15}$/.test(imei);
    return {
      verified: valid,
      message: valid ? 'Device verified — eligible for this loan' : 'IMEI must be exactly 15 digits',
    };
  }
  return fetchAPI<{ verified: boolean; message: string }>(
    `/api/v1/distributor/handovers/verify-device`,
    { method: 'POST', body: JSON.stringify({ loan_id: loanId, device_id: deviceId, imei }) },
  );
}

/**
 * Verify deposit payment for a loan.
 */
export async function verifyDepositPayment(
  loanId: string,
  paymentMethod: string,
  transactionRef: string,
): Promise<{ verified: boolean; amount: number; message: string }> {
  if (shouldUseMock()) {
    await delay(1000);
    if (!transactionRef || transactionRef.length < 4) {
      return { verified: false, amount: 0, message: 'Invalid transaction reference' };
    }
    const loan = mockApprovedLoans.find((l) => l.loan_id === loanId);
    const amount = loan?.deposit_amount ?? 40;
    return {
      verified: true,
      amount,
      message: `Deposit of $${amount.toFixed(2)} verified via ${paymentMethod}`,
    };
  }
  return fetchAPI<{ verified: boolean; amount: number; message: string }>(
    `/api/v1/distributor/handovers/verify-deposit`,
    { method: 'POST', body: JSON.stringify({ loan_id: loanId, payment_method: paymentMethod, transaction_ref: transactionRef }) },
  );
}

/**
 * Submit a completed handover — creates the handover record, links device to loan,
 * triggers Fineract disbursement, and calculates commission.
 */
export async function submitHandover(data: {
  loan_id: string;
  customer_id: string;
  device_id: string;
  customer_national_id: string;
  device_imei: string;
  device_condition: DeviceCondition;
  device_photos: string[];
  signature_data_url: string;
  deposit_payment_method: string;
  deposit_transaction_ref: string;
}): Promise<HandoverResult> {
  if (shouldUseMock()) {
    await delay(1200);
    const loan = mockApprovedLoans.find((l) => l.loan_id === data.loan_id);
    if (!loan) throw new Error('Loan not found');
    const commission = loan.loan_amount * 0.05;
    return {
      success: true,
      handover_id: `ho_${Date.now()}`,
      loan_id: data.loan_id,
      commission_amount: commission,
      next_payment_date: loan.first_payment_date,
      message: `Device handed over to ${loan.customer_name}. Loan ${loan.loan_id} is now active.`,
    };
  }
  return fetchAPI<HandoverResult>('/api/v1/distributor/handovers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
