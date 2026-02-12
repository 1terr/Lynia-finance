/**
 * Data Privacy Service (P3-T029)
 *
 * POPIA/GDPR-compliant data privacy features:
 *  - Right to erasure (data anonymization)
 *  - Data portability (customer data export)
 *  - Consent management (granular consent tracking)
 *  - Privacy audit logs (who accessed what data)
 *  - Breach notification workflow
 *
 * Note: We anonymize rather than hard-delete to maintain
 * audit trail integrity per RBZ 7-year retention requirements.
 */

import { db } from './clients/database';

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
// RIGHT TO ERASURE (DATA ANONYMIZATION)
// ===================================================================

/**
 * Request data deletion (right to be forgotten)
 */
export async function requestDataDeletion(params: {
  customer_id: string;
  requested_via: DeletionRequest['requested_via'];
  reason?: string;
}): Promise<DeletionRequest> {
  // Check for active loans - cannot delete during active loan
  const { count: activeLoans } = await supabase
    .from('loans')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', params.customer_id)
    .in('loan_status', ['active', 'delinquent']);

  if ((activeLoans || 0) > 0) {
    throw new Error(
      'Cannot process deletion request while customer has active or delinquent loans. ' +
      'Please settle all outstanding loans first.'
    );
  }

  const { data, error } = await supabase
    .from('deletion_requests')
    .insert({
      customer_id: params.customer_id,
      requested_at: new Date(),
      requested_via: params.requested_via,
      reason: params.reason,
      status: 'pending',
      data_categories_deleted: [],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create deletion request: ${error.message}`);

  await logPrivacyAction({
    action: 'deletion_requested',
    entity_type: 'customer',
    entity_id: params.customer_id,
    accessed_by: params.customer_id,
    access_reason: 'Customer requested data deletion',
    fields_accessed: [],
  });

  return data as DeletionRequest;
}

/**
 * Approve a deletion request (admin action)
 */
export async function approveDeletionRequest(
  requestId: string,
  approvedBy: string
): Promise<void> {
  await supabase
    .from('deletion_requests')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date(),
    })
    .eq('id', requestId);

  await logPrivacyAction({
    action: 'deletion_approved',
    entity_type: 'deletion_request',
    entity_id: requestId,
    accessed_by: approvedBy,
    access_reason: 'Admin approved data deletion request',
    fields_accessed: [],
  });
}

/**
 * Execute data anonymization for an approved deletion request
 */
export async function executeDataAnonymization(requestId: string): Promise<void> {
  // Get the request
  const { data: request } = await supabase
    .from('deletion_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'approved')
    .single();

  if (!request) throw new Error('Deletion request not found or not approved');

  const customerId = request.customer_id;
  const deletedCategories: string[] = [];

  // Mark as processing
  await supabase
    .from('deletion_requests')
    .update({ status: 'processing' })
    .eq('id', requestId);

  // 1. Anonymize customer PII
  await supabase
    .from('customers')
    .update({
      first_name: 'ANONYMIZED',
      last_name: 'ANONYMIZED',
      phone_number: `ANON-${customerId.substring(0, 8)}`,
      email: null,
      national_id: 'ANONYMIZED',
      date_of_birth: null,
      address: 'ANONYMIZED',
      city: 'ANONYMIZED',
      province: null,
      employer_name: null,
      employer_phone: null,
      next_of_kin_name: null,
      next_of_kin_phone: null,
      anonymized: true,
      anonymized_at: new Date(),
    })
    .eq('id', customerId);
  deletedCategories.push('personal_information');

  // 2. Remove KYC documents (images)
  await supabase
    .from('kyc_submissions')
    .update({
      document_url: null,
      selfie_url: null,
      verification_data: null,
    })
    .eq('customer_id', customerId);
  deletedCategories.push('kyc_documents');

  // 3. Anonymize WhatsApp messages
  await supabase
    .from('whatsapp_messages')
    .update({ message_body: 'ANONYMIZED' })
    .eq('customer_id', customerId);
  deletedCategories.push('communication_history');

  // 4. Remove device fingerprint data
  await supabase
    .from('devices')
    .update({
      device_fingerprint: null,
    })
    .eq('customer_id', customerId);
  deletedCategories.push('device_data');

  // 5. Withdraw all consents
  await supabase
    .from('customer_consents')
    .update({
      granted: false,
      withdrawn_at: new Date(),
      updated_at: new Date(),
    })
    .eq('customer_id', customerId);
  deletedCategories.push('consent_records');

  // 6. Remove from feature store
  await supabase
    .from('customer_features')
    .delete()
    .eq('customer_id', customerId);
  deletedCategories.push('analytics_data');

  // Note: We DO NOT delete:
  // - Loan records (RBZ 7-year retention requirement)
  // - Payment records (financial audit trail)
  // - Fraud alerts (security requirement)
  // - Audit logs (compliance requirement)
  // These are retained with anonymized customer references.

  // Mark as completed
  await supabase
    .from('deletion_requests')
    .update({
      status: 'completed',
      completed_at: new Date(),
      data_categories_deleted: deletedCategories,
    })
    .eq('id', requestId);

  await logPrivacyAction({
    action: 'data_anonymized',
    entity_type: 'customer',
    entity_id: customerId,
    accessed_by: 'system',
    access_reason: `Data anonymization completed for deletion request ${requestId}`,
    fields_accessed: deletedCategories,
  });
}

/**
 * Reject a deletion request
 */
export async function rejectDeletionRequest(
  requestId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  await supabase
    .from('deletion_requests')
    .update({
      status: 'rejected',
      approved_by: rejectedBy,
      rejected_reason: reason,
    })
    .eq('id', requestId);

  await logPrivacyAction({
    action: 'deletion_rejected',
    entity_type: 'deletion_request',
    entity_id: requestId,
    accessed_by: rejectedBy,
    access_reason: `Deletion request rejected: ${reason}`,
    fields_accessed: [],
  });
}

// ===================================================================
// DATA PORTABILITY (CUSTOMER DATA EXPORT)
// ===================================================================

/**
 * Export all customer data in machine-readable format
 */
export async function exportCustomerData(
  customerId: string,
  requestedBy: string
): Promise<CustomerDataExport> {
  // Get customer profile
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  // Get loans
  const { data: loans } = await supabase
    .from('loans')
    .select('*')
    .eq('customer_id', customerId);

  // Get payments
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  // Get KYC submissions (without document URLs for security)
  const { data: kyc } = await supabase
    .from('kyc_submissions')
    .select('id, submission_type, status, created_at, completed_at')
    .eq('customer_id', customerId);

  // Get credit scores
  const { data: scores } = await supabase
    .from('credit_scores')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  // Get consents
  const consents = await getCustomerConsents(customerId);

  // Get devices
  const { data: devices } = await supabase
    .from('devices')
    .select('id, brand, model, imei, status, assigned_at')
    .eq('customer_id', customerId);

  // Get notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, channel, status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100);

  const exportData: CustomerDataExport = {
    customer: (customer || {}) as Record<string, unknown>,
    loans: (loans || []) as Record<string, unknown>[],
    payments: (payments || []) as Record<string, unknown>[],
    kyc_submissions: (kyc || []) as Record<string, unknown>[],
    credit_scores: (scores || []) as Record<string, unknown>[],
    consents,
    devices: (devices || []) as Record<string, unknown>[],
    notifications: (notifications || []) as Record<string, unknown>[],
    exported_at: new Date().toISOString(),
  };

  await logPrivacyAction({
    action: 'data_exported',
    entity_type: 'customer',
    entity_id: customerId,
    accessed_by: requestedBy,
    access_reason: 'Customer data export (data portability)',
    fields_accessed: ['all_customer_data'],
  });

  return exportData;
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
  await supabase.from('privacy_audit_log').insert({
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    accessed_by: params.accessed_by,
    access_reason: params.access_reason,
    fields_accessed: params.fields_accessed,
    ip_address: params.ip_address,
    created_at: new Date(),
  });
}

/**
 * Get privacy audit trail for a customer
 */
export async function getPrivacyAuditTrail(
  customerId: string,
  limit: number = 100
): Promise<PrivacyAuditEntry[]> {
  const { data } = await supabase
    .from('privacy_audit_log')
    .select('*')
    .eq('entity_id', customerId)
    .eq('entity_type', 'customer')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []) as PrivacyAuditEntry[];
}

// ===================================================================
// BREACH NOTIFICATION
// ===================================================================

/**
 * Report a data breach (72-hour notification SLA per POPIA)
 */
export async function reportDataBreach(params: {
  severity: BreachSeverity;
  description: string;
  affected_customers: number;
  data_types_affected: string[];
  containment_actions: string[];
  reported_by: string;
}): Promise<DataBreachRecord> {
  const { data, error } = await supabase
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
    .single();

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
  await supabase
    .from('data_breaches')
    .update({
      notification_sent: true,
      notification_sent_at: new Date(),
    })
    .eq('id', breachId);

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
  await supabase
    .from('data_breaches')
    .update({
      reported_to_authority: true,
      reported_at: new Date(),
    })
    .eq('id', breachId);

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
 * Get pending deletion requests (for admin review)
 */
export async function getPendingDeletionRequests(): Promise<DeletionRequest[]> {
  const { data } = await supabase
    .from('deletion_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });

  return (data || []) as DeletionRequest[];
}

/**
 * Get active/unresolved data breaches
 */
export async function getActiveBreaches(): Promise<DataBreachRecord[]> {
  const { data } = await supabase
    .from('data_breaches')
    .select('*')
    .eq('resolved', false)
    .order('detected_at', { ascending: false });

  return (data || []) as DataBreachRecord[];
}
