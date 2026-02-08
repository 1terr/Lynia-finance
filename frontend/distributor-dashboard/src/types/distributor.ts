export type DistributorStatus = 'active' | 'suspended' | 'inactive';
export type KycStatus = 'pending' | 'approved' | 'rejected';

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
  kyc_status: KycStatus;
  kyc_verified_at: string | null;
  onboarded_at: string;
  created_at: string;
}

export interface PendingHandover {
  id: string;
  loan_id: string;
  customer_name: string;
  customer_phone: string;
  device_model: string;
  device_imei: string;
  loan_amount: number;
  deposit_amount: number;
  deposit_paid: boolean;
  scheduled_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface InventoryDevice {
  id: string;
  brand: string;
  model: string;
  imei: string;
  retail_price: number;
  status: 'available' | 'reserved' | 'assigned' | 'sold' | 'damaged';
  condition: 'new' | 'refurbished' | 'used';
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
  pending_handovers: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  pending_commissions: number;
  average_rating: number;
  monthly_handovers: number;
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
  handover_id: string;
  // Step 1: Selected handover
  selected_handover: PendingHandover | null;
  // Step 2: Identity verification
  customer_national_id: string;
  identity_verified: boolean;
  identity_photo_url: string | null;
  // Step 3: IMEI verification
  scanned_imei: string;
  imei_verified: boolean;
  // Step 4: Device condition
  device_condition: DeviceCondition;
  // Step 5: Device photos
  device_photos: string[];
  // Step 6: Signature
  signature_data_url: string | null;
  // Step 7: Confirmation
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
  { id: 1, title: 'Select Handover', shortTitle: 'Select' },
  { id: 2, title: 'Verify Identity', shortTitle: 'Identity' },
  { id: 3, title: 'Scan IMEI', shortTitle: 'IMEI' },
  { id: 4, title: 'Device Check', shortTitle: 'Check' },
  { id: 5, title: 'Device Photos', shortTitle: 'Photos' },
  { id: 6, title: 'Signature', shortTitle: 'Sign' },
  { id: 7, title: 'Confirm', shortTitle: 'Done' },
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
