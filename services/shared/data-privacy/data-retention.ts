/**
 * Data Retention & Breach Notification Module
 *
 * Breach notification workflow (72-hour SLA per POPIA),
 * breach tracking, and authority reporting.
 */

import { db } from '../clients/database';
import type { DataBreachRecord } from './consent-management';
import { logPrivacyAction } from './consent-management';

// ===================================================================
// BREACH NOTIFICATION
// ===================================================================

/**
 * Report a data breach (72-hour notification SLA per POPIA)
 */
export async function reportDataBreach(params: {
  severity: DataBreachRecord['severity'];
  description: string;
  affected_customers: number;
  data_types_affected: string[];
  containment_actions: string[];
  reported_by: string;
}): Promise<DataBreachRecord> {
  const { data, error } = await db
    .from('data_breaches')
    .insert({
      detected_at: new Date(),
      severity: params.severity,
      description: params.description,
      affected_customers: params.affected_customers,
      data_types_affected: params.data_types_affected,
      containment_actions: params.containment_actions,
      notification_sent: false,
      reported_to_authority: false,
      resolved: false,
      reported_by: params.reported_by,
    })
    .select()
    .single()
    .execute();

  if (error) throw new Error(`Failed to record breach: ${error.message}`);

  await logPrivacyAction({
    action: 'breach_reported',
    entity_type: 'data_breach',
    entity_id: data.id,
    accessed_by: params.reported_by,
    access_reason: `Data breach reported: ${params.severity} severity`,
    fields_accessed: params.data_types_affected,
  });

  return data as DataBreachRecord;
}

/**
 * Send breach notifications to affected customers
 */
export async function sendBreachNotification(
  breachId: string,
  notifiedBy: string
): Promise<void> {
  await db
    .from('data_breaches')
    .update({
      notification_sent: true,
      notification_sent_at: new Date(),
    })
    .eq('id', breachId)
    .execute();

  await logPrivacyAction({
    action: 'breach_notification_sent',
    entity_type: 'data_breach',
    entity_id: breachId,
    accessed_by: notifiedBy,
    access_reason: 'Breach notification sent to affected customers',
    fields_accessed: [],
  });
}

/**
 * Mark breach as reported to regulatory authority
 */
export async function reportBreachToAuthority(
  breachId: string,
  reportedBy: string
): Promise<void> {
  await db
    .from('data_breaches')
    .update({
      reported_to_authority: true,
      reported_at: new Date(),
    })
    .eq('id', breachId)
    .execute();

  await logPrivacyAction({
    action: 'breach_reported_to_authority',
    entity_type: 'data_breach',
    entity_id: breachId,
    accessed_by: reportedBy,
    access_reason: 'Breach reported to POTRAZ/RBZ',
    fields_accessed: [],
  });
}

/**
 * Get active/unresolved data breaches
 */
export async function getActiveBreaches(): Promise<DataBreachRecord[]> {
  const { data } = await db
    .from('data_breaches')
    .select('*')
    .eq('resolved', false)
    .order('detected_at', { ascending: false })
    .execute();

  return (data || []) as DataBreachRecord[];
}
