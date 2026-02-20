/**
 * Lynia Finance - Unified Enum Definitions
 *
 * Single source of truth for all status enums used across:
 *   - Admin portal frontend
 *   - Distributor dashboard frontend
 *   - Backend Lambda services
 *   - Database schema
 *
 * Import from this file to ensure consistency.
 */

// ── Device Status ──
// Matches admin portal + database schema
export type DeviceStatus = 'in_stock' | 'allocated' | 'active' | 'locked' | 'returned' | 'damaged';

export const DEVICE_STATUSES: DeviceStatus[] = [
  'in_stock', 'allocated', 'active', 'locked', 'returned', 'damaged',
];

// ── Device Condition ──
// Matches admin portal grading system
export type DeviceCondition = 'new' | 'grade_a' | 'grade_b' | 'grade_c';

export const DEVICE_CONDITIONS: DeviceCondition[] = [
  'new', 'grade_a', 'grade_b', 'grade_c',
];

export const DEVICE_CONDITION_LABELS: Record<DeviceCondition, string> = {
  new: 'New',
  grade_a: 'Grade A',
  grade_b: 'Grade B',
  grade_c: 'Grade C',
};

// ── Lock Status ──
export type LockStatus = 'unlocked' | 'locked' | 'pending';

// ── KYC Status ──
// Superset from database schema — most complete enum
export type KYCStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';

export const KYC_STATUSES: KYCStatus[] = [
  'pending', 'in_review', 'approved', 'rejected', 'expired',
];

// ── Payment Status ──
// Unified: uses 'confirmed' (database) instead of 'completed' (admin portal)
export type PaymentStatus = 'pending' | 'processing' | 'confirmed' | 'failed' | 'refunded';

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending', 'processing', 'confirmed', 'failed', 'refunded',
];

// ── Payment Method ──
export type PaymentMethod = 'ecocash' | 'onemoney' | 'cash' | 'bank_transfer';

// ── Payment Type ──
export type PaymentType = 'deposit' | 'installment' | 'late_fee' | 'early_payoff';

// ── Loan Status ──
export type LoanStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'active'
  | 'paid'
  | 'defaulted'
  | 'written_off';

export const LOAN_STATUSES: LoanStatus[] = [
  'draft', 'submitted', 'pending_approval', 'approved', 'rejected',
  'disbursed', 'active', 'paid', 'defaulted', 'written_off',
];

// ── Handover Status ──
// Unified across distributor dashboard, admin portal, and backend
export type HandoverStatus =
  | 'initiated'
  | 'identity_verified'
  | 'deposit_verified'
  | 'device_inspected'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const HANDOVER_STATUSES: HandoverStatus[] = [
  'initiated', 'identity_verified', 'deposit_verified',
  'device_inspected', 'completed', 'failed', 'cancelled',
];

// ── Distributor Status ──
export type DistributorStatus = 'active' | 'suspended' | 'inactive';

export const DISTRIBUTOR_STATUSES: DistributorStatus[] = [
  'active', 'suspended', 'inactive',
];

// ── Customer Status ──
export type CustomerStatus = 'active' | 'inactive' | 'blocked';

// ── Employment Status ──
export type EmploymentStatus = 'employed' | 'self_employed' | 'unemployed' | 'student';
