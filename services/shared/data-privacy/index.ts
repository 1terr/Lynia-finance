/**
 * Data Privacy Module - Barrel Re-exports
 */

export {
  type ConsentPurpose,
  type DeletionRequestStatus,
  type BreachSeverity,
  type ConsentRecord,
  type DeletionRequest,
  type PrivacyAuditEntry,
  type DataBreachRecord,
  type CustomerDataExport,
  grantConsent,
  withdrawConsent,
  hasConsent,
  getCustomerConsents,
  logPrivacyAction,
  getPrivacyAuditTrail,
} from './consent-management';

export {
  requestDataDeletion,
  approveDeletionRequest,
  executeDataAnonymization,
  rejectDeletionRequest,
  exportCustomerData,
  getPendingDeletionRequests,
} from './pii-masking';

export {
  reportDataBreach,
  sendBreachNotification,
  reportBreachToAuthority,
  getActiveBreaches,
} from './data-retention';
