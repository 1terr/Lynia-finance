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
