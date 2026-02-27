/**
 * PII Masking & Data Anonymization Module
 *
 * Right to erasure (data anonymization), data portability (customer data export),
 * and related privacy audit logging.
 */

import { db } from '../clients/database';
import type {
  DeletionRequest,
  CustomerDataExport,
  ConsentRecord,
} from './consent-management';
import { getCustomerConsents, logPrivacyAction } from './consent-management';

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
  const { count: activeLoans } = await db
    .from('loans')
    .select('*')
    .eq('customer_id', params.customer_id)
    .in('loan_status', ['active', 'delinquent'])
    .count()
    .execute();

  if ((activeLoans || 0) > 0) {
    throw new Error(
      'Cannot process deletion request while customer has active or delinquent loans. ' +
      'Please settle all outstanding loans first.'
    );
  }

  const { data, error } = await db
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
    .single()
    .execute();

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
  await db
    .from('deletion_requests')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date(),
    })
    .eq('id', requestId)
    .execute();

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
  const { data: request } = await db
    .from('deletion_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'approved')
    .single()
    .execute();

  if (!request) throw new Error('Deletion request not found or not approved');

  const customerId = request.customer_id;
  const deletedCategories: string[] = [];

  // Mark as processing
  await db
    .from('deletion_requests')
    .update({ status: 'processing' })
    .eq('id', requestId)
    .execute();

  // 1. Anonymize customer PII
  await db
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
    .eq('id', customerId)
    .execute();
  deletedCategories.push('personal_information');

  // 2. Remove KYC documents (images)
  await db
    .from('kyc_submissions')
    .update({
      document_url: null,
      selfie_url: null,
      verification_data: null,
    })
    .eq('customer_id', customerId)
    .execute();
  deletedCategories.push('kyc_documents');

  // 3. Anonymize WhatsApp messages
  await db
    .from('whatsapp_messages')
    .update({ message_body: 'ANONYMIZED' })
    .eq('customer_id', customerId)
    .execute();
  deletedCategories.push('communication_history');

  // 4. Remove device fingerprint data
  await db
    .from('devices')
    .update({
      device_fingerprint: null,
    })
    .eq('customer_id', customerId)
    .execute();
  deletedCategories.push('device_data');

  // 5. Withdraw all consents
  await db
    .from('customer_consents')
    .update({
      granted: false,
      withdrawn_at: new Date(),
      updated_at: new Date(),
    })
    .eq('customer_id', customerId)
    .execute();
  deletedCategories.push('consent_records');

  // 6. Remove from feature store
  await db
    .from('customer_features')
    .delete()
    .eq('customer_id', customerId)
    .execute();
  deletedCategories.push('analytics_data');

  // Note: We DO NOT delete:
  // - Loan records (RBZ 7-year retention requirement)
  // - Payment records (financial audit trail)
  // - Fraud alerts (security requirement)
  // - Audit logs (compliance requirement)
  // These are retained with anonymized customer references.

  // Mark as completed
  await db
    .from('deletion_requests')
    .update({
      status: 'completed',
      completed_at: new Date(),
      data_categories_deleted: deletedCategories,
    })
    .eq('id', requestId)
    .execute();

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
  await db
    .from('deletion_requests')
    .update({
      status: 'rejected',
      approved_by: rejectedBy,
      rejected_reason: reason,
    })
    .eq('id', requestId)
    .execute();

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
  const { data: customer } = await db
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()
    .execute();

  // Get loans
  const { data: loans } = await db
    .from('loans')
    .select('*')
    .eq('customer_id', customerId)
    .execute();

  // Get payments
  const { data: payments } = await db
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .execute();

  // Get KYC submissions (without document URLs for security)
  const { data: kyc } = await db
    .from('kyc_submissions')
    .select('id, submission_type, status, created_at, completed_at')
    .eq('customer_id', customerId)
    .execute();

  // Get credit scores
  const { data: scores } = await db
    .from('credit_scores')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .execute();

  // Get consents
  const consents = await getCustomerConsents(customerId);

  // Get devices
  const { data: devices } = await db
    .from('devices')
    .select('id, brand, model, imei, status, assigned_at')
    .eq('customer_id', customerId)
    .execute();

  // Get notifications
  const { data: notifications } = await db
    .from('notifications')
    .select('id, type, channel, status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100)
    .execute();

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

/**
 * Get pending deletion requests (for admin review)
 */
export async function getPendingDeletionRequests(): Promise<DeletionRequest[]> {
  const { data } = await db
    .from('deletion_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .execute();

  return (data || []) as DeletionRequest[];
}
