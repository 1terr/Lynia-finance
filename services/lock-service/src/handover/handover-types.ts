/**
 * Handover Type Definitions
 *
 * All type/interface definitions for the device handover service.
 */

/**
 * Device Handover Request
 */
export interface InitiateHandoverRequest {
  loan_id: string;
  device_id: string;
  customer_id: string;
  distributor_id: string;
  handover_location: string;
  handed_over_by: string;
}

/**
 * Handover Record
 */
export interface HandoverRecord {
  id: string;
  loan_id: string;
  device_id: string;
  customer_id: string;
  distributor_id: string;
  handover_location: string;
  handed_over_by: string;
  handed_over_at?: Date;
  status: 'initiated' | 'identity_verified' | 'deposit_verified' | 'device_inspected' | 'completed' | 'failed';
  identity_verified: boolean;
  deposit_verified: boolean;
  device_condition_verified: boolean;
  app_installed: boolean;
  app_configured: boolean;
  lock_test_passed: boolean;
  device_condition?: Record<string, unknown>;
  customer_signature_url?: string;
  loan_agreement_url?: string;
  device_condition_form_url?: string;
  failure_reason?: string;
  created_at: Date;
}

/**
 * Device condition inspection data
 */
export interface DeviceCondition {
  screen_condition: 'excellent' | 'good' | 'fair' | 'poor';
  body_condition: 'excellent' | 'good' | 'fair' | 'poor';
  buttons_functional: boolean;
  ports_functional: boolean;
  cameras_functional: boolean;
  powers_on: boolean;
  touch_responsive: boolean;
  wifi_works: boolean;
  cellular_works: boolean;
  calls_work: boolean;
  accessories_included: string[];
  notes?: string;
}
