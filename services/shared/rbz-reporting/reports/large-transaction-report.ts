/**
 * Large Transaction Report — RBZ Report (On-demand)
 */

import { db, query } from '../../clients/database';
import { LARGE_TRANSACTION_THRESHOLD_USD } from '../helpers';
import type { RBZReportConfig, LargeTransactionReport, Currency } from '../../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateLargeTransactionReport(
  config: RBZReportConfig
): Promise<LargeTransactionReport> {
  const periodStart = config.periodStart.toISOString();
  const periodEnd = config.periodEnd.toISOString();

  const { data: largeTxns } = await query<{
    id: string;
    amount: number;
    currency: string;
    payment_method: string;
    payment_type: string;
    created_at: string;
    customer_id: string;
    fineract_transaction_id: number | null;
  }>(
    `SELECT p.id, p.amount, p.currency, p.payment_method, p.payment_type,
            p.created_at, p.customer_id, p.fineract_transaction_id
     FROM payments p
     WHERE p.status = 'completed'
       AND p.amount >= $1
       AND p.created_at >= $2 AND p.created_at <= $3
     ORDER BY p.amount DESC`,
    [LARGE_TRANSACTION_THRESHOLD_USD, periodStart, periodEnd]
  );

  // Get customer names
  const customerIds = [...new Set((largeTxns || []).map(t => t.customer_id))];
  const customerMap = new Map<string, string>();

  if (customerIds.length > 0) {
    const { data: customers } = await query<{ id: string; first_name: string; last_name: string }>(
      `SELECT id, first_name, last_name FROM customers WHERE id = ANY($1)`,
      [customerIds]
    );
    for (const c of customers || []) {
      customerMap.set(c.id, `${c.first_name} ${c.last_name}`);
    }
  }

  // Check for new customers (< 30 days old)
  const { data: newCustomers } = await query<{ id: string }>(
    `SELECT id FROM customers WHERE created_at >= NOW() - INTERVAL '30 days'`,
    []
  );
  const newCustomerIds = new Set((newCustomers || []).map(c => c.id));

  const refNumber = `LTR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const transactions = (largeTxns || []).map(t => ({
    transactionId: t.id,
    fineractTransactionId: t.fineract_transaction_id ?? undefined,
    date: t.created_at,
    type: t.payment_type || 'unknown',
    amount: t.amount,
    currency: (t.currency || 'USD') as Currency,
    customerId: t.customer_id,
    customerName: customerMap.get(t.customer_id) || 'Unknown',
    paymentChannel: t.payment_method || 'unknown',
    riskFlag: newCustomerIds.has(t.customer_id),
  }));

  // Record alerts
  for (const txn of transactions) {
    await db.from('large_transaction_alerts').insert({
      payment_id: txn.transactionId,
      customer_id: txn.customerId,
      transaction_date: txn.date,
      amount: txn.amount,
      currency: txn.currency,
      payment_channel: txn.paymentChannel,
      threshold_amount: LARGE_TRANSACTION_THRESHOLD_USD,
      fineract_transaction_id: txn.fineractTransactionId,
    }).execute();
  }

  return {
    reportDate: new Date().toISOString(),
    referenceNumber: refNumber,
    reportingThreshold: LARGE_TRANSACTION_THRESHOLD_USD,
    currency: config.currency,
    transactions,
    summary: {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((s, t) => s + t.amount, 0),
      flaggedCount: transactions.filter(t => t.riskFlag).length,
      newCustomerTransactions: transactions.filter(t => newCustomerIds.has(t.customerId)).length,
    },
  };
}
