export type DistributorStatus = 'active' | 'suspended' | 'inactive';
export type KYCStatus = 'pending' | 'verified' | 'approved' | 'rejected';

export interface Distributor {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  email: string;
  national_id: string;
  business_name: string;
  province: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  bank_name: string | null;
  account_number: string | null;
  mobile_money_number: string | null;
  commission_rate: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  pending_commissions: number;
  total_loans_disbursed: number;
  total_devices_distributed: number;
  current_inventory_count: number;
  average_rating: number;
  status: DistributorStatus;
  kyc_status: KYCStatus;
  kyc_verified_at: string | null;
  onboarded_at: string;
  created_at: string;
}

// ── Approved Loan (search result for handover Step 1) ──

export interface ApprovedLoan {
  loan_id: string;
  customer_id: string;
  customer_name: string;
  loan_amount: number;
  deposit_amount: number;
  deposit_paid: boolean;
  approved_date: string;
  device_category: string;
  loan_term_months: number;
  monthly_payment: number;
  interest_rate: number;
  first_payment_date: string;
}

// ── Completed Handover (history item) ──

export interface CompletedHandover {
  id: string;
  loan_id: string;
  customer_name: string;
  device_model: string;
  device_imei: string;
  loan_amount: number;
  commission_earned: number;
  completed_at: string;
}

export interface InventoryDevice {
  id: string;
  brand: string;
  model: string;
  imei: string;
  retail_price: number;
  status: 'available' | 'reserved' | 'damaged';
  condition: 'new' | 'grade_a' | 'grade_b' | 'grade_c';
  storage_gb: number | null;
  color: string | null;
  received_at: string;
}

export interface CommissionEntry {
  id: string;
  loan_id: string;
  device_model: string;
  customer_name: string;
  device_retail_price: number;
  commission_percentage: number;
  commission_amount: number;
  payment_status: 'pending' | 'paid';
  calculation_date: string;
  paid_at: string | null;
}

export interface DashboardStats {
  total_devices_distributed: number;
  current_inventory: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  pending_commissions: number;
  average_rating: number;
  monthly_handovers: number;
  last_month_handovers: number;
}

// ── Handover Workflow Types ──

export type HandoverStatus =
  | 'pending'
  | 'identity_verified'
  | 'deposit_verified'
  | 'device_inspected'
  | 'completed'
  | 'failed';

export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor';

export interface DeviceCondition {
  screen_condition: ConditionRating;
  body_condition: ConditionRating;
  buttons_functional: boolean;
  ports_functional: boolean;
  cameras_functional: boolean;
  powers_on: boolean;
  touch_responsive: boolean;
  wifi_works: boolean;
  cellular_works: boolean;
  calls_work: boolean;
  accessories_included: string[];
  notes: string;
}

export interface HandoverData {
  // Step 1: Found approved loan via search
  selected_loan: ApprovedLoan | null;
  // Step 2: Identity verification
  customer_national_id: string;
  identity_verified: boolean;
  identity_photo_url: string | null;
  // Step 3: Device selection from inventory
  selected_device: InventoryDevice | null;
  device_imei_confirmed: boolean;
  // Step 4: Device condition + app/lock setup
  device_condition: DeviceCondition;
  app_installed: boolean;
  app_configured: boolean;
  lock_test_passed: boolean;
  // Step 5: Device photos
  device_photos: string[];
  // Step 6: Signature
  signature_data_url: string | null;
  // Step 7: Confirmation & Deposit
  deposit_payment_method: string;
  deposit_transaction_ref: string;
  deposit_verified: boolean;
}

export interface HandoverResult {
  success: boolean;
  handover_id: string;
  loan_id: string;
  commission_amount: number;
  next_payment_date: string;
  message: string;
}

export const HANDOVER_STEPS = [
  { id: 1, title: 'Find Customer', shortTitle: 'Customer' },
  { id: 2, title: 'Verify Identity', shortTitle: 'Identity' },
  { id: 3, title: 'Select Device', shortTitle: 'Device' },
  { id: 4, title: 'Device Check', shortTitle: 'Check' },
  { id: 5, title: 'Device Photos', shortTitle: 'Photos' },
  { id: 6, title: 'Signature', shortTitle: 'Sign' },
  { id: 7, title: 'Confirm & Deposit', shortTitle: 'Done' },
] as const;

export const INITIAL_DEVICE_CONDITION: DeviceCondition = {
  screen_condition: 'excellent',
  body_condition: 'excellent',
  buttons_functional: true,
  ports_functional: true,
  cameras_functional: true,
  powers_on: true,
  touch_responsive: true,
  wifi_works: true,
  cellular_works: true,
  calls_work: true,
  accessories_included: [],
  notes: '',
};

export const ACCESSORY_OPTIONS = [
  'charger',
  'usb_cable',
  'earphones',
  'protective_case',
  'screen_protector',
  'sim_ejector',
  'manual',
] as const;

// ── Transfer Types ──

export type TransferStatus = 'requested' | 'approved' | 'in_transit' | 'pending_receipt'
  | 'received' | 'disputed' | 'cancelled' | 'return_requested' | 'return_approved';
export type TransferType = 'outbound' | 'return';

export interface TransferListItem {
  id: string;
  transfer_type: TransferType;
  status: TransferStatus;
  device_imei: string;
  device_manufacturer: string;
  device_model: string;
  from_distributor_name: string | null;
  to_distributor_name: string | null;
  from_location: string | null;
  to_location: string | null;
  initiated_by_type: 'admin' | 'distributor';
  rejection_reason: string | null;
  force_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpotCheckItem {
  id: string;
  device_id: string;
  device_imei: string;
  device_model: string;
  imei_verified: boolean;
  condition_rating: string | null;
}

export interface SpotCheckInput {
  device_id: string;
  imei_verified: boolean;
  condition_rating: 'new' | 'good' | 'damaged';
}
