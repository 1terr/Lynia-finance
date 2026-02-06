import type { AdminRole, AdminUser, Permission } from './auth';

// --- Admin User Management ---
export interface AdminUserWithMeta extends AdminUser {
  mfa_enabled: boolean;
  phone: string | null;
  updated_at: string;
}

export interface CreateAdminUserPayload {
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
  department: string | null;
  phone: string | null;
}

export interface UpdateAdminUserPayload {
  first_name?: string;
  last_name?: string;
  role?: AdminRole;
  department?: string | null;
  phone?: string | null;
  is_active?: boolean;
}

// --- Notification Templates ---
export interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email';
  event: string;
  subject: string | null;
  body: string;
  variables: string[];
  is_active: boolean;
  updated_at: string;
}

// --- System Configuration ---
export interface SystemConfig {
  // Loan settings
  loan_tier1_amount: number;
  loan_tier1_term_weeks: number;
  loan_tier2_amount: number;
  loan_tier2_term_weeks: number;
  loan_tier3_amount: number;
  loan_tier3_term_weeks: number;
  interest_rate_pct: number;
  late_fee_pct: number;
  grace_period_days: number;
  // Device lock settings
  lock_delay_hours: number;
  auto_lock_after_days_overdue: number;
  unlock_after_payment: boolean;
  // KYC settings
  kyc_max_retry_attempts: number;
  kyc_sla_hours: number;
  kyc_auto_approve_threshold: number;
  // General
  currency: string;
  timezone: string;
  maintenance_mode: boolean;
}

// --- Audit Log ---
export interface AuditLogEntry {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  resource: string;
  resource_id: string | null;
  details: string;
  ip_address: string;
  created_at: string;
}

// --- Settings Tab ---
export type SettingsTab = 'users' | 'roles' | 'notifications' | 'system' | 'audit';
