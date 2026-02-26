/**
 * Enhanced Suspicious Transaction Report (STR) — RBZ Report (On-demand, Fineract-enriched)
 */

import { db, query } from '../../clients/database';
import {
  round2,
  INSTITUTION_NAME,
  LICENSE_NUMBER,
  LARGE_TRANSACTION_THRESHOLD_USD,
} from '../helpers';
import type { SuspiciousTransactionReportEnhanced } from '../../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateEnhancedSTR(params: {
  customerId: string;
  suspiciousActivityType: string;
  description: string;
  riskIndicators: string[];
  reportedBy: string;
  priority?: 'normal' | 'urgent' | 'critical';
}): Promise<SuspiciousTransactionReportEnhanced> {
  // Customer details
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name, last_name, kyc_status, created_at, risk_level')
    .eq('id', params.customerId)
    .single()
    .execute();

  // Recent transactions from Lynia DB
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: transactions } = await query<{
    id: string;
    amount: number;
    payment_method: string;
    payment_type: string;
    created_at: string;
    fineract_transaction_id: number | null;
  }>(
    `SELECT id, amount, payment_method, payment_type, created_at, fineract_transaction_id
     FROM payments
     WHERE customer_id = $1 AND created_at >= $2
     ORDER BY created_at DESC`,
    [params.customerId, ninetyDaysAgo]
  );

  const txns = transactions || [];
  const totalAmount = txns.reduce((s, t) => s + (t.amount || 0), 0);
  const avgSize = txns.length > 0 ? totalAmount / txns.length : 0;
  const largest = txns.reduce((max, t) => Math.max(max, t.amount || 0), 0);

  // Fineract transactions
  const fineractTxns = txns
    .filter(t => t.fineract_transaction_id)
    .map(t => ({
      fineractId: t.fineract_transaction_id!,
      date: t.created_at,
      type: t.payment_type || 'unknown',
      amount: t.amount,
    }));

  // Detect unusual patterns
  const patterns: string[] = [];
  if (txns.length > 20) patterns.push('High transaction frequency (>20 in 90 days)');
  if (largest > LARGE_TRANSACTION_THRESHOLD_USD) patterns.push(`Large transaction ($${largest.toFixed(2)}) exceeds threshold`);
  if (avgSize > 500) patterns.push(`High average transaction size ($${avgSize.toFixed(2)})`);

  const refNumber = `STR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const filingDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const report: SuspiciousTransactionReportEnhanced = {
    reportDate: new Date().toISOString(),
    referenceNumber: refNumber,
    filingDeadline,
    priority: params.priority || 'normal',
    institution: {
      name: INSTITUTION_NAME,
      licenseNumber: LICENSE_NUMBER,
      reportingOfficer: params.reportedBy,
      contactPhone: '+263-XXX-XXXX',
    },
    subject: {
      customerId: params.customerId,
      fullName: customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown',
      nationalIdMasked: '***-masked-***',
      accountType: 'Device Finance',
      customerSince: customer?.created_at || 'unknown',
      kycStatus: customer?.kyc_status || 'unknown',
      riskRating: customer?.risk_level || 'medium',
    },
    suspiciousActivity: {
      type: params.suspiciousActivityType,
      description: params.description,
      detectedDate: new Date().toISOString(),
      detectionMethod: 'automated',
      activityPeriod: {
        start: ninetyDaysAgo,
        end: new Date().toISOString(),
      },
    },
    transactionAnalysis: {
      totalTransactions: txns.length,
      totalAmount,
      averageTransactionSize: round2(avgSize),
      largestTransaction: largest,
      unusualPatterns: patterns,
      fineractTransactions: fineractTxns,
    },
    riskIndicators: params.riskIndicators,
    actionTaken: 'Account flagged for enhanced monitoring, STR filed with RBZ FIU',
    recommendedActions: [
      'Enhanced transaction monitoring for 90 days',
      'Request source of funds documentation',
      'Escalate to compliance officer',
    ],
    reportedBy: params.reportedBy,
  };

  // Save to database
  await db.from('fineract_rbz_reports').insert({
    report_type: 'suspicious_transaction_report',
    frequency: 'on_demand',
    period_start: new Date(),
    period_end: new Date(),
    currency: 'USD',
    generated_by: params.reportedBy,
    generated_at: new Date(),
    data: report as unknown as Record<string, unknown>,
    status: 'generated',
    fineract_sourced: fineractTxns.length > 0,
  }).execute();

  // Audit log
  await db.from('audit_log').insert({
    action: 'str_filed_rbz',
    entity_type: 'customer',
    entity_id: params.customerId,
    performed_by: params.reportedBy,
    details: {
      referenceNumber: refNumber,
      priority: params.priority || 'normal',
      suspiciousActivityType: params.suspiciousActivityType,
    },
    created_at: new Date(),
  }).execute();

  return report;
}
