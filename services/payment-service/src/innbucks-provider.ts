/**
 * InnBucks Payment Provider Integration (P3-T020)
 *
 * Adds InnBucks as a third mobile money payment method
 * alongside EcoCash and OneMoney.
 *
 * Features:
 *  - Payment initiation via InnBucks API
 *  - Payment status polling
 *  - Callback/webhook handling
 *  - Transaction reference validation
 *  - Idempotent payment processing
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INNBUCKS_API_URL = process.env.INNBUCKS_API_URL || 'https://sandbox.innbucks.co.zw/api/v1';
const INNBUCKS_API_KEY = process.env.INNBUCKS_API_KEY || '';
const INNBUCKS_MERCHANT_ID = process.env.INNBUCKS_MERCHANT_ID || '';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export interface InnBucksPaymentRequest {
  amount: number;
  currency: 'USD' | 'ZWL';
  phone_number: string;
  reference: string;
  description: string;
  callback_url?: string;
}

export interface InnBucksPaymentResponse {
  transaction_id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  reference: string;
  created_at: string;
}

export type PaymentProvider = 'ecocash' | 'onemoney' | 'innbucks' | 'bank_transfer' | 'cash';

// ===================================================================
// INNBUCKS PAYMENT PROVIDER
// ===================================================================

/**
 * Initiate InnBucks payment
 */
export async function initiateInnBucksPayment(
  request: InnBucksPaymentRequest
): Promise<InnBucksPaymentResponse> {
  // Idempotency check
  const { data: existing } = await supabase
    .from('payments')
    .select('id, external_transaction_id, status')
    .eq('reference', request.reference)
    .eq('payment_method', 'innbucks')
    .single();

  if (existing && existing.status !== 'failed') {
    return {
      transaction_id: existing.external_transaction_id,
      status: existing.status,
      amount: request.amount,
      currency: request.currency,
      reference: request.reference,
      created_at: new Date().toISOString(),
    };
  }

  try {
    const response = await axios.post(
      `${INNBUCKS_API_URL}/payments/initiate`,
      {
        merchant_id: INNBUCKS_MERCHANT_ID,
        amount: request.amount,
        currency: request.currency,
        msisdn: request.phone_number.replace('+', ''),
        reference: request.reference,
        narrative: request.description,
        callback_url: request.callback_url,
      },
      {
        headers: {
          'Authorization': `Bearer ${INNBUCKS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return {
      transaction_id: response.data.transaction_id,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      reference: request.reference,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('InnBucks payment initiation failed:', error);
    throw new Error('PAY_PROV_001: InnBucks payment initiation failed');
  }
}

/**
 * Check InnBucks payment status
 */
export async function checkInnBucksStatus(transactionId: string): Promise<InnBucksPaymentResponse> {
  try {
    const response = await axios.get(
      `${INNBUCKS_API_URL}/payments/${transactionId}/status`,
      {
        headers: { 'Authorization': `Bearer ${INNBUCKS_API_KEY}` },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (error) {
    console.error('InnBucks status check failed:', error);
    throw new Error('PAY_PROV_001: InnBucks status check failed');
  }
}

/**
 * Handle InnBucks webhook callback
 */
export async function handleInnBucksCallback(payload: {
  transaction_id: string;
  status: string;
  reference: string;
  amount: number;
}): Promise<void> {
  const newStatus = payload.status === 'SUCCESS' ? 'completed'
    : payload.status === 'FAILED' ? 'failed' : 'pending';

  await supabase
    .from('payments')
    .update({
      status: newStatus,
      external_transaction_id: payload.transaction_id,
      completed_at: newStatus === 'completed' ? new Date() : null,
    })
    .eq('reference', payload.reference)
    .eq('payment_method', 'innbucks');

  if (newStatus === 'completed') {
    console.log(`InnBucks payment completed: ${payload.reference} - $${payload.amount}`);
  }
}

/**
 * Get all supported payment providers
 */
export function getSupportedProviders(): Array<{
  id: PaymentProvider;
  name: string;
  available: boolean;
  icon: string;
}> {
  return [
    { id: 'ecocash', name: 'EcoCash', available: true, icon: '💚' },
    { id: 'onemoney', name: 'OneMoney', available: true, icon: '🔵' },
    { id: 'innbucks', name: 'InnBucks', available: true, icon: '🟡' },
    { id: 'bank_transfer', name: 'Bank Transfer', available: true, icon: '🏦' },
    { id: 'cash', name: 'Cash (at distributor)', available: true, icon: '💵' },
  ];
}
