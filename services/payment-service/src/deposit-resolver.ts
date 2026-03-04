/**
 * Deposit Resolver
 *
 * Resolves deposit payments where the customer uses their national ID
 * as the payment reference instead of a pre-initiated payment ID.
 *
 * Flow:
 * 1. Webhook arrives with merchant_reference (could be payment_id or national_id)
 * 2. If it matches an existing payment record → normal flow (pre-initiated)
 * 3. If not → check if it's a national ID format → find customer → find approved loan
 * 4. Create payment record linked to the loan → trigger deposit completion
 */

import { db, query } from '../../shared/clients/database';
import logger from '../../shared/utils/logger';

/** Zimbabwe national ID format: XX-XXXXXXX-X-XX (with dashes) */
const NATIONAL_ID_REGEX = /^\d{2}-\d{7}-[A-Za-z]-\d{2}$/;

/** Normalize national ID: handle common variations (spaces, no dashes) */
function normalizeNationalId(ref: string): string | null {
  const cleaned = ref.trim().replace(/\s+/g, '');

  // Already in correct format
  if (NATIONAL_ID_REGEX.test(cleaned)) return cleaned.toUpperCase();

  // Try without dashes: 12 chars like 632345678B08
  const noDash = cleaned.replace(/-/g, '');
  if (/^\d{2}\d{7}[A-Za-z]\d{2}$/.test(noDash)) {
    return `${noDash.slice(0, 2)}-${noDash.slice(2, 9)}-${noDash.slice(9, 10).toUpperCase()}-${noDash.slice(10, 12)}`;
  }

  return null;
}

export interface DepositResolution {
  /** Whether this was resolved as a national ID deposit */
  resolved: boolean;
  /** The payment ID (existing or newly created) */
  paymentId: string | null;
  /** The loan ID that the deposit is for */
  loanId: string | null;
}

/**
 * Try to resolve a merchant_reference as a national ID deposit payment.
 * Returns null if the reference is not a national ID or no matching loan found.
 */
export async function resolveDepositByNationalId(
  merchantReference: string,
  amount: number,
  currency: string,
  providerTransactionId: string,
  gateway: string
): Promise<DepositResolution | null> {
  const nationalId = normalizeNationalId(merchantReference);
  if (!nationalId) return null;

  logger.info('Attempting deposit resolution by national ID', {
    action: 'deposit.resolve',
    meta: { nationalIdMasked: `${nationalId.slice(0, 2)}*****${nationalId.slice(-2)}`, gateway },
  });

  // Find customer by national ID with an approved loan awaiting deposit
  const { data: matches } = await query<{
    loan_id: string;
    customer_id: string;
    deposit_amount_usd: number;
    customer_phone: string;
  }>(
    `SELECT l.id AS loan_id, l.customer_id, l.deposit_amount_usd,
            c.phone_number AS customer_phone
     FROM loans l
     JOIN customers c ON c.id = l.customer_id
     WHERE c.national_id = $1
       AND l.status = 'approved'
       AND l.deposit_paid = false
     ORDER BY l.created_at DESC
     LIMIT 1`,
    [nationalId]
  );

  if (!matches || matches.length === 0) {
    logger.warn('No approved loan found for national ID deposit', {
      action: 'deposit.resolve',
      meta: { nationalIdMasked: `${nationalId.slice(0, 2)}*****${nationalId.slice(-2)}` },
    });
    return null;
  }

  const match = matches[0];

  // Validate deposit amount (allow small tolerance for currency conversion)
  const expectedDeposit = Number(match.deposit_amount_usd);
  const tolerance = expectedDeposit * 0.05; // 5% tolerance
  if (Math.abs(amount - expectedDeposit) > tolerance) {
    logger.warn('Deposit amount mismatch', {
      action: 'deposit.resolve',
      meta: {
        expected: expectedDeposit,
        received: amount,
        loanId: match.loan_id,
      },
    });
    // Still proceed — partial/over deposits are handled by linkPaymentToLoan
  }

  // Create payment record for this deposit
  const { data: payment, error: paymentError } = await db
    .from('payments')
    .insert({
      loan_id: match.loan_id,
      customer_id: match.customer_id,
      amount,
      currency,
      status: 'completed',
      gateway,
      gateway_transaction_id: providerTransactionId,
      payment_type: 'deposit',
      description: `Deposit via ${gateway} (national ID reference)`,
      reference: nationalId,
      initiated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()
    .execute();

  if (paymentError || !payment) {
    logger.error('Failed to create deposit payment record', {
      action: 'deposit.resolve',
      meta: { loanId: match.loan_id, error: String(paymentError) },
    });
    return null;
  }

  logger.info('Deposit resolved by national ID', {
    action: 'deposit.resolved',
    meta: { paymentId: payment.id, loanId: match.loan_id, gateway },
  });

  return {
    resolved: true,
    paymentId: payment.id,
    loanId: match.loan_id,
  };
}
