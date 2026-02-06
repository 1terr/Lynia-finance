import type { AdminRole, Permission } from '@/types/auth';
import { ROLE_PERMISSIONS } from '@/types/auth';
import type {
  AdminUserWithMeta,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
  NotificationTemplate,
  SystemConfig,
  AuditLogEntry,
} from '@/types/settings';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Mock Admin Users ---
const mockAdminUsers: AdminUserWithMeta[] = [
  {
    id: 'usr_001', email: 'admin@lynia.co.zw', first_name: 'Tatenda', last_name: 'Moyo',
    role: 'super_admin', is_active: true, department: 'Executive', phone: '+263771000001',
    mfa_enabled: true, last_login_at: '2026-02-06T08:30:00Z', created_at: '2025-10-01T00:00:00Z', updated_at: '2026-02-06T08:30:00Z',
  },
  {
    id: 'usr_002', email: 'ops@lynia.co.zw', first_name: 'Chipo', last_name: 'Ndlovu',
    role: 'operations_manager', is_active: true, department: 'Operations', phone: '+263771000002',
    mfa_enabled: true, last_login_at: '2026-02-05T14:20:00Z', created_at: '2025-11-15T00:00:00Z', updated_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'usr_003', email: 'kyc@lynia.co.zw', first_name: 'Blessing', last_name: 'Sithole',
    role: 'kyc_reviewer', is_active: true, department: 'Compliance', phone: '+263771000003',
    mfa_enabled: false, last_login_at: '2026-02-06T09:15:00Z', created_at: '2025-12-01T00:00:00Z', updated_at: '2025-12-01T00:00:00Z',
  },
  {
    id: 'usr_004', email: 'finance@lynia.co.zw', first_name: 'Tendai', last_name: 'Mhaka',
    role: 'finance_team', is_active: true, department: 'Finance', phone: '+263771000004',
    mfa_enabled: true, last_login_at: '2026-02-04T16:45:00Z', created_at: '2025-12-10T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr_005', email: 'inventory@lynia.co.zw', first_name: 'Tafadzwa', last_name: 'Chirwa',
    role: 'inventory_manager', is_active: true, department: 'Logistics', phone: null,
    mfa_enabled: false, last_login_at: '2026-02-03T11:00:00Z', created_at: '2026-01-05T00:00:00Z', updated_at: '2026-01-05T00:00:00Z',
  },
  {
    id: 'usr_006', email: 'support@lynia.co.zw', first_name: 'Rumbidzai', last_name: 'Gumbo',
    role: 'customer_support', is_active: false, department: 'Support', phone: '+263771000006',
    mfa_enabled: false, last_login_at: '2026-01-28T10:00:00Z', created_at: '2025-11-20T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
  },
];

// --- Mock Notification Templates ---
const mockTemplates: NotificationTemplate[] = [
  {
    id: 'tpl_001', name: 'Welcome Message', channel: 'whatsapp', event: 'customer.registered',
    subject: null, body: 'Hello {{customer_name}}! Welcome to Lynia Finance. You can apply for device financing right here on WhatsApp. Type APPLY to get started.',
    variables: ['customer_name'], is_active: true, updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'tpl_002', name: 'KYC Approved', channel: 'whatsapp', event: 'kyc.approved',
    subject: null, body: 'Great news {{customer_name}}! Your identity verification is complete. You are now eligible for a loan of up to ${{max_loan_amount}}. Type APPLY to proceed.',
    variables: ['customer_name', 'max_loan_amount'], is_active: true, updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'tpl_003', name: 'KYC Rejected', channel: 'whatsapp', event: 'kyc.rejected',
    subject: null, body: 'Hi {{customer_name}}, unfortunately your verification was not successful. Reason: {{rejection_reason}}. You can re-submit by typing KYC.',
    variables: ['customer_name', 'rejection_reason'], is_active: true, updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'tpl_004', name: 'Loan Approved', channel: 'whatsapp', event: 'loan.approved',
    subject: null, body: 'Hi {{customer_name}}, your loan of ${{loan_amount}} has been approved! Your weekly payment is ${{weekly_payment}} for {{term_weeks}} weeks. Device pickup details will follow.',
    variables: ['customer_name', 'loan_amount', 'weekly_payment', 'term_weeks'], is_active: true, updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'tpl_005', name: 'Payment Reminder', channel: 'whatsapp', event: 'payment.reminder',
    subject: null, body: 'Hi {{customer_name}}, your payment of ${{payment_amount}} is due on {{due_date}}. Pay via EcoCash to {{paybill_number}}. Reference: {{loan_ref}}.',
    variables: ['customer_name', 'payment_amount', 'due_date', 'paybill_number', 'loan_ref'], is_active: true, updated_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'tpl_006', name: 'Payment Received', channel: 'sms', event: 'payment.received',
    subject: null, body: 'Lynia Finance: Payment of ${{amount}} received for loan {{loan_ref}}. Balance: ${{remaining_balance}}. Thank you!',
    variables: ['amount', 'loan_ref', 'remaining_balance'], is_active: true, updated_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'tpl_007', name: 'Device Lock Warning', channel: 'whatsapp', event: 'device.lock_warning',
    subject: null, body: 'Hi {{customer_name}}, your payment is overdue by {{days_overdue}} days. Your device will be locked in {{lock_in_hours}} hours if payment is not received.',
    variables: ['customer_name', 'days_overdue', 'lock_in_hours'], is_active: true, updated_at: '2026-01-25T00:00:00Z',
  },
  {
    id: 'tpl_008', name: 'Overdue Notice', channel: 'email', event: 'payment.overdue',
    subject: 'Lynia Finance - Payment Overdue Notice', body: 'Dear {{customer_name}},\n\nYour payment of ${{payment_amount}} for loan {{loan_ref}} was due on {{due_date}} and is now {{days_overdue}} days overdue.\n\nPlease make payment immediately to avoid device restrictions.\n\nBest regards,\nLynia Finance Team',
    variables: ['customer_name', 'payment_amount', 'loan_ref', 'due_date', 'days_overdue'], is_active: true, updated_at: '2026-01-25T00:00:00Z',
  },
];

// --- Mock System Config ---
const mockSystemConfig: SystemConfig = {
  loan_tier1_amount: 200,
  loan_tier1_term_weeks: 24,
  loan_tier2_amount: 350,
  loan_tier2_term_weeks: 36,
  loan_tier3_amount: 500,
  loan_tier3_term_weeks: 48,
  interest_rate_pct: 15,
  late_fee_pct: 5,
  grace_period_days: 3,
  lock_delay_hours: 48,
  auto_lock_after_days_overdue: 7,
  unlock_after_payment: true,
  kyc_max_retry_attempts: 3,
  kyc_sla_hours: 24,
  kyc_auto_approve_threshold: 85,
  currency: 'USD',
  timezone: 'Africa/Harare',
  maintenance_mode: false,
};

// --- Mock Audit Log ---
const mockAuditLog: AuditLogEntry[] = [
  { id: 'aud_001', admin_id: 'usr_001', admin_email: 'admin@lynia.co.zw', action: 'update', resource: 'system_config', resource_id: null, details: 'Updated interest rate from 12% to 15%', ip_address: '196.43.1.100', created_at: '2026-02-06T08:45:00Z' },
  { id: 'aud_002', admin_id: 'usr_001', admin_email: 'admin@lynia.co.zw', action: 'deactivate', resource: 'admin_user', resource_id: 'usr_006', details: 'Deactivated user support@lynia.co.zw', ip_address: '196.43.1.100', created_at: '2026-02-01T10:30:00Z' },
  { id: 'aud_003', admin_id: 'usr_002', admin_email: 'ops@lynia.co.zw', action: 'approve', resource: 'loan', resource_id: 'loan_089', details: 'Approved loan $350 for customer Farai Mupfumi', ip_address: '196.43.2.50', created_at: '2026-01-31T14:20:00Z' },
  { id: 'aud_004', admin_id: 'usr_001', admin_email: 'admin@lynia.co.zw', action: 'create', resource: 'admin_user', resource_id: 'usr_005', details: 'Created admin user inventory@lynia.co.zw with role inventory_manager', ip_address: '196.43.1.100', created_at: '2026-01-05T09:00:00Z' },
  { id: 'aud_005', admin_id: 'usr_001', admin_email: 'admin@lynia.co.zw', action: 'update', resource: 'notification_template', resource_id: 'tpl_005', details: 'Updated Payment Reminder template body', ip_address: '196.43.1.100', created_at: '2026-01-20T11:15:00Z' },
  { id: 'aud_006', admin_id: 'usr_003', admin_email: 'kyc@lynia.co.zw', action: 'approve', resource: 'kyc', resource_id: 'kyc_142', details: 'Approved KYC for Tinashe Dhliwayo', ip_address: '196.43.3.20', created_at: '2026-02-06T09:20:00Z' },
  { id: 'aud_007', admin_id: 'usr_001', admin_email: 'admin@lynia.co.zw', action: 'update', resource: 'system_config', resource_id: null, details: 'Changed auto_lock_after_days_overdue from 5 to 7', ip_address: '196.43.1.100', created_at: '2026-01-28T16:00:00Z' },
  { id: 'aud_008', admin_id: 'usr_004', admin_email: 'finance@lynia.co.zw', action: 'reconcile', resource: 'payment', resource_id: 'pay_291', details: 'Reconciled EcoCash payment $12.50 for loan loan_067', ip_address: '196.43.4.15', created_at: '2026-02-04T16:50:00Z' },
];

// --- API Functions ---

export async function fetchAdminUsers(): Promise<AdminUserWithMeta[]> {
  await delay(500);
  return [...mockAdminUsers];
}

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUserWithMeta> {
  await delay(500);
  const newUser: AdminUserWithMeta = {
    id: `usr_${String(mockAdminUsers.length + 1).padStart(3, '0')}`,
    ...payload,
    is_active: true,
    mfa_enabled: false,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockAdminUsers.push(newUser);
  return newUser;
}

export async function updateAdminUser(id: string, payload: UpdateAdminUserPayload): Promise<AdminUserWithMeta> {
  await delay(500);
  const idx = mockAdminUsers.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('User not found');
  mockAdminUsers[idx] = { ...mockAdminUsers[idx], ...payload, updated_at: new Date().toISOString() };
  return mockAdminUsers[idx];
}

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  await delay(500);
  return [...mockTemplates];
}

export async function updateNotificationTemplate(id: string, body: string, is_active: boolean): Promise<NotificationTemplate> {
  await delay(500);
  const idx = mockTemplates.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Template not found');
  mockTemplates[idx] = { ...mockTemplates[idx], body, is_active, updated_at: new Date().toISOString() };
  return mockTemplates[idx];
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
  await delay(500);
  return { ...mockSystemConfig };
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  await delay(500);
  Object.assign(mockSystemConfig, config);
  return { ...mockSystemConfig };
}

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  await delay(500);
  return [...mockAuditLog];
}

export function getRolePermissions(role: AdminRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function getAllPermissions(): Permission[] {
  return [
    'dashboard:view',
    'customers:read', 'customers:write', 'customers:delete',
    'loans:read', 'loans:approve', 'loans:reject', 'loans:write',
    'kyc:read', 'kyc:approve', 'kyc:reject',
    'devices:read', 'devices:write', 'devices:delete', 'devices:lock', 'devices:unlock',
    'payments:read', 'payments:reconcile', 'payments:refund',
    'reports:read', 'reports:export',
    'settings:read', 'settings:write',
    'notifications:send',
  ];
}
