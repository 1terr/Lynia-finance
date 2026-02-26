/**
 * Monthly Transaction Summary — RBZ Report
 */

import { query } from '../../clients/database';
import { logger } from '../../utils/logger';
import {
  filterSum,
  INSTITUTION_NAME,
  LICENSE_NUMBER,
  LARGE_TRANSACTION_THRESHOLD_USD,
} from '../helpers';
import type { RBZReportConfig, MonthlyTransactionSummary } from '../../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateMonthlyTransactionSummary(
  config: RBZReportConfig
): Promise<MonthlyTransactionSummary> {
  const periodStart = config.periodStart.toISOString();
  const periodEnd = config.periodEnd.toISOString();

  // All payments in period
  const { data: payments } = await query<{
    id: string;
    amount: number;
    payment_method: string;
    status: string;
    payment_type: string;
    created_at: string;
    customer_id: string;
  }>(
    `SELECT id, amount, payment_method, status, payment_type, created_at, customer_id
     FROM payments
     WHERE created_at >= $1 AND created_at <= $2`,
    [periodStart, periodEnd]
  );

  const completed = (payments || []).filter(p => p.status === 'completed');
  const failed = (payments || []).filter(p => p.status === 'failed');

  // Transaction types
  const byType = {
    disbursements: filterSum(completed, 'payment_type', 'disbursement'),
    repayments: filterSum(completed, 'payment_type', 'repayment'),
    fees: filterSum(completed, 'payment_type', 'fee'),
    penalties: filterSum(completed, 'payment_type', 'penalty'),
    writeOffs: filterSum(completed, 'payment_type', 'write_off'),
    recoveries: filterSum(completed, 'payment_type', 'recovery'),
    waivers: filterSum(completed, 'payment_type', 'waiver'),
  };

  // By payment channel
  const byChannel = {
    ecocash: filterSum(completed, 'payment_method', 'ecocash'),
    onemoney: filterSum(completed, 'payment_method', 'onemoney'),
    bankTransfer: filterSum(completed, 'payment_method', 'bank_transfer'),
    cash: filterSum(completed, 'payment_method', 'cash'),
    other: { count: 0, amount: 0 },
  };

  const knownChannels = ['ecocash', 'onemoney', 'bank_transfer', 'cash'];
  const otherChannels = completed.filter(p => !knownChannels.includes(p.payment_method));
  byChannel.other = {
    count: otherChannels.length,
    amount: otherChannels.reduce((s, p) => s + (p.amount || 0), 0),
  };

  // Daily volumes
  const dailyMap = new Map<string, { count: number; amount: number }>();
  for (const p of completed) {
    const day = p.created_at.substring(0, 10);
    const existing = dailyMap.get(day) || { count: 0, amount: 0 };
    existing.count++;
    existing.amount += p.amount || 0;
    dailyMap.set(day, existing);
  }
  const dailyVolumes = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, transactionCount: v.count, totalAmount: v.amount }));

  // Large transactions
  const largeTransactions = completed
    .filter(p => p.amount >= LARGE_TRANSACTION_THRESHOLD_USD)
    .map(p => ({
      date: p.created_at,
      amount: p.amount,
      type: p.payment_type || 'unknown',
      customerId: p.customer_id,
    }));

  // Failed transaction reasons
  const failedReasons = new Map<string, number>();
  for (const p of failed) {
    const reason = (p as Record<string, unknown>).failure_reason as string || 'unknown';
    failedReasons.set(reason, (failedReasons.get(reason) || 0) + 1);
  }
  const topReasons = Array.from(failedReasons.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  return {
    reportingPeriod: { start: periodStart, end: periodEnd },
    institutionName: INSTITUTION_NAME,
    licenseNumber: LICENSE_NUMBER,
    currency: config.currency,
    totalTransactions: completed.length,
    totalTransactionValue: completed.reduce((s, p) => s + (p.amount || 0), 0),
    transactionsByType: byType,
    transactionsByChannel: byChannel,
    dailyVolumes,
    largeTransactions,
    failedTransactions: {
      count: failed.length,
      totalAmount: failed.reduce((s, p) => s + (p.amount || 0), 0),
      topReasons,
    },
  };
}
