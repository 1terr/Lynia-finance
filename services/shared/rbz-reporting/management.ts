/**
 * RBZ Report Management — Review, Submit, History
 */

import { db } from '../clients/database';
import type {
  RBZGeneratedReport,
  FineractRBZReportType,
  RBZReportStatus,
  RBZReportFrequency,
} from '../types/rbz-reports';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mark a report as reviewed by a compliance officer.
 */
export async function reviewReport(
  reportId: string,
  reviewedBy: string,
  approved: boolean,
  rejectionReason?: string
): Promise<void> {
  const status = approved ? 'reviewed' : 'rejected';

  await db.from('fineract_rbz_reports').update({
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date(),
    ...(rejectionReason && { rejection_reason: rejectionReason }),
  }).eq('id', reportId).execute();

  await db.from('audit_log').insert({
    action: `rbz_report_${status}`,
    entity_type: 'fineract_rbz_report',
    entity_id: reportId,
    performed_by: reviewedBy,
    details: { approved, rejectionReason },
    created_at: new Date(),
  }).execute();
}

/**
 * Mark a report as submitted to RBZ.
 */
export async function submitReportToRBZ(
  reportId: string,
  submittedBy: string
): Promise<void> {
  await db.from('fineract_rbz_reports').update({
    status: 'submitted',
    submitted_to_rbz_at: new Date(),
  }).eq('id', reportId).execute();

  await db.from('audit_log').insert({
    action: 'rbz_report_submitted',
    entity_type: 'fineract_rbz_report',
    entity_id: reportId,
    performed_by: submittedBy,
    details: { submittedAt: new Date().toISOString() },
    created_at: new Date(),
  }).execute();
}

/**
 * Get report history with filtering.
 */
export async function getRBZReportHistory(params?: {
  reportType?: FineractRBZReportType;
  status?: RBZReportStatus;
  frequency?: RBZReportFrequency;
  limit?: number;
}): Promise<RBZGeneratedReport[]> {
  let builder = db
    .from('fineract_rbz_reports')
    .select('*')
    .order('generated_at', { ascending: false });

  if (params?.reportType) builder = builder.eq('report_type', params.reportType);
  if (params?.status) builder = builder.eq('status', params.status);
  if (params?.frequency) builder = builder.eq('frequency', params.frequency);
  builder = builder.limit(params?.limit || 50);

  const { data } = await builder.execute();
  return (data || []) as RBZGeneratedReport[];
}
