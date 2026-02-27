/**
 * Consent Management Module
 *
 * Consent tracking/management, privacy audit logging,
 * and all shared type definitions for the data-privacy module.
 */

import { db } from '../clients/database';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type ConsentPurpose =
  | 'kyc_verification'
  | 'credit_scoring'
  | 'mobile_money_analysis'
  | 'location_data'
  | 'marketing_communications'
  | 'data_sharing_third_party'
  | 'device_monitoring'
  | 'referral_program';

export type DeletionRequestStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected';

export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ConsentRecord {
  id?: string;
  customer_id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  granted_at?: Date;
  withdrawn_at?: Date;
  consent_method: 'whatsapp' | 'web' | 'verbal' | 'document';
  ip_address?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DeletionRequest {
  id?: string;
  customer_id: string;
  requested_at: Date;
  requested_via: 'whatsapp' | 'email' | 'admin';
  reason?: string;
  status: DeletionRequestStatus;
  approved_by?: string;
  approved_at?: Date;
  completed_at?: Date;
  rejected_reason?: string;
  data_categories_deleted: string[];
}

export interface PrivacyAuditEntry {
  id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  accessed_by: string;
  access_reason: string;
  fields_accessed: string[];
  ip_address?: string;
  created_at: Date;
}

export interface DataBreachRecord {
  id?: string;
  detected_at: Date;
  severity: BreachSeverity;
  description: string;
  affected_customers: number;
  data_types_affected: string[];
  containment_actions: string[];
  notification_sent: boolean;
  notification_sent_at?: Date;
  reported_to_authority: boolean;
  reported_at?: Date;
  resolved: boolean;
  resolved_at?: Date;
  reported_by: string;
}

export interface CustomerDataExport {
  customer: Record<string, unknown>;
  loans: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  kyc_submissions: Record<string, unknown>[];
  credit_scores: Record<string, unknown>[];
  consents: ConsentRecord[];
  devices: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  exported_at: string;
}

// ===================================================================
// CONSENT MANAGEMENT
// ===================================================================

/**
 * Record customer consent for a specific purpose
 */
export async function grantConsent(params: {
  customer_id: string;
  purpose: ConsentPurpose;
  consent_method: ConsentRecord['consent_method'];
  ip_address?: string;
}): Promise<ConsentRecord> {
  const now = new Date();

  // Upsert consent record
  const { data, error } = await db
    .from('customer_consents')
    .upsert(
      {
        customer_id: params.customer_id,
        purpose: params.purpose,
        granted: true,
        granted_at: now,
        withdrawn_at: null,
        consent_method: params.consent_method,
        ip_address: params.ip_address,
        updated_at: now,
      },
      { onConflict: 'customer_id,purpose' }
    )
    .select()
    .single()
    .execute();

  if (error) throw new Error(`Failed to record consent: ${error.message}`);

  await logPrivacyAction({
    action: 'consent_granted',
    entity_type: 'customer',
    entity_id: params.customer_id,
    accessed_by: params.customer_id,
    access_reason: `Customer granted consent for ${params.purpose}`,
    fields_accessed: ['consent'],
  });

  return data as ConsentRecord;
}

/**
 * Withdraw customer consent for a specific purpose
 */
export async function withdrawConsent(params: {
  customer_id: string;
  purpose: ConsentPurpose;
}): Promise<void> {
  const now = new Date();

  await db
    .from('customer_consents')
    .update({
      granted: false,
      withdrawn_at: now,
      updated_at: now,
    })
    .eq('customer_id', params.customer_id)
    .eq('purpose', params.purpose)
    .execute();

  await logPrivacyAction({
    action: 'consent_withdrawn',
    entity_type: 'customer',
    entity_id: params.customer_id,
    accessed_by: params.customer_id,
    access_reason: `Customer withdrew consent for ${params.purpose}`,
    fields_accessed: ['consent'],
  });
}

/**
 * Check if customer has granted consent for a purpose
 */
export async function hasConsent(
  customerId: string,
  purpose: ConsentPurpose
): Promise<boolean> {
  const { data } = await db
    .from('customer_consents')
    .select('granted')
    .eq('customer_id', customerId)
    .eq('purpose', purpose)
    .single()
    .execute();

  return data?.granted === true;
}

/**
 * Get all consents for a customer
 */
export async function getCustomerConsents(
  customerId: string
): Promise<ConsentRecord[]> {
  const { data } = await db
    .from('customer_consents')
    .select('*')
    .eq('customer_id', customerId)
    .order('purpose')
    .execute();

  return (data || []) as ConsentRecord[];
}

// ===================================================================
// PRIVACY AUDIT LOG
// ===================================================================

/**
 * Log a privacy-relevant action
 */
export async function logPrivacyAction(params: {
  action: string;
  entity_type: string;
  entity_id: string;
  accessed_by: string;
  access_reason: string;
  fields_accessed: string[];
  ip_address?: string;
}): Promise<void> {
  await db.from('privacy_audit_log').insert({
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    accessed_by: params.accessed_by,
    access_reason: params.access_reason,
    fields_accessed: params.fields_accessed,
    ip_address: params.ip_address,
    created_at: new Date(),
  }).execute();
}

/**
 * Get privacy audit trail for a customer
 */
export async function getPrivacyAuditTrail(
  customerId: string,
  limit: number = 100
): Promise<PrivacyAuditEntry[]> {
  const { data } = await db
    .from('privacy_audit_log')
    .select('*')
    .eq('entity_id', customerId)
    .eq('entity_type', 'customer')
    .order('created_at', { ascending: false })
    .limit(limit)
    .execute();

  return (data || []) as PrivacyAuditEntry[];
}
