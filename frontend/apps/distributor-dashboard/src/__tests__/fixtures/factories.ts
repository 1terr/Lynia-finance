import type {
  Distributor,
  ApprovedLoan,
  CompletedHandover,
  InventoryDevice,
  CommissionEntry,
  DashboardStats,
  DeviceCondition,
  HandoverData,
  HandoverResult,
  ConditionRating,
} from '@/types/distributor';

// Auto-incrementing counters for unique IDs
let distributorCounter = 1;
let handoverCounter = 1;
let deviceCounter = 1;
let commissionCounter = 1;
let loanCounter = 1;

/**
 * Reset all factory counters - call this in beforeEach() for test isolation
 */
export function resetFactoryCounters(): void {
  distributorCounter = 1;
  handoverCounter = 1;
  deviceCounter = 1;
  commissionCounter = 1;
  loanCounter = 1;
}

// ── Distributor Factories ──

export function createDistributor(
  overrides?: Partial<Distributor>
): Distributor {
  const id = distributorCounter++;
  const now = new Date().toISOString();

  return {
    id: `dist_${id}`,
    user_id: `user_${id}`,
    name: `Distributor ${id}`,
    phone_number: `+26377${String(id).padStart(7, '0')}`,
    email: `distributor${id}@lynia.co.zw`,
    national_id: `63-${String(id).padStart(6, '0')}A${String(id % 100).padStart(2, '0')}`,
    business_name: `${overrides?.name || `Distributor ${id}`} Electronics`,
    province: 'Harare',
    city: 'Harare',
    address: `${id} Main Street, Harare`,
    latitude: -17.8252 + Math.random() * 0.1,
    longitude: 31.0335 + Math.random() * 0.1,
    bank_name: 'CBZ Bank',
    account_number: `62${String(id).padStart(8, '0')}`,
    mobile_money_number: `+26377${String(id).padStart(7, '0')}`,
    commission_rate: 0.05,
    total_commissions_earned: 1250.0,
    total_commissions_paid: 850.0,
    pending_commissions: 400.0,
    total_loans_disbursed: 42,
    total_devices_distributed: 42,
    current_inventory_count: 15,
    average_rating: 4.5,
    status: 'active',
    kyc_status: 'approved',
    kyc_verified_at: now,
    onboarded_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

// ── Approved Loan Factories ──

export function createApprovedLoan(
  overrides?: Partial<ApprovedLoan>
): ApprovedLoan {
  const id = loanCounter++;

  return {
    loan_id: `LYN-2026-${String(id).padStart(3, '0')}`,
    customer_id: `cust_${id}`,
    customer_name: `Customer ${id}`,
    loan_amount: 300.0,
    deposit_amount: 30.0,
    deposit_paid: false,
    approved_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    device_category: 'Up to $300',
    loan_term_months: 12,
    monthly_payment: 28.5,
    interest_rate: 14,
    first_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

export function createApprovedLoans(count: number): ApprovedLoan[] {
  return Array.from({ length: count }, () => createApprovedLoan());
}

// ── Completed Handover Factories ──

export function createCompletedHandover(
  overrides?: Partial<CompletedHandover>
): CompletedHandover {
  const id = handoverCounter++;
  const loanId = loanCounter++;

  return {
    id: `ho_${id}`,
    loan_id: `LYN-2026-${String(loanId).padStart(3, '0')}`,
    customer_name: `Customer ${id}`,
    device_model: 'Samsung Galaxy A15',
    device_imei: `35${String(id).padStart(13, '0')}`,
    loan_amount: 300.0,
    commission_earned: 15.0,
    completed_at: new Date(Date.now() - id * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

export function createCompletedHandovers(count: number): CompletedHandover[] {
  return Array.from({ length: count }, () => createCompletedHandover());
}

// ── Device Factories ──

export function createInventoryDevice(
  overrides?: Partial<InventoryDevice>
): InventoryDevice {
  const id = deviceCounter++;

  return {
    id: `device_${id}`,
    brand: 'Samsung',
    model: 'Galaxy A15',
    imei: `35${String(id).padStart(13, '0')}`,
    retail_price: 300.0,
    status: 'available',
    condition: 'new',
    storage_gb: 64,
    color: 'Black',
    received_at: new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString(),
    ...overrides,
  };
}

export function createInventoryDevices(count: number): InventoryDevice[] {
  return Array.from({ length: count }, () => createInventoryDevice());
}

export function createDeviceCondition(
  rating: ConditionRating = 'excellent',
  overrides?: Partial<DeviceCondition>
): DeviceCondition {
  return {
    screen_condition: rating,
    body_condition: rating,
    buttons_functional: true,
    ports_functional: true,
    cameras_functional: true,
    powers_on: true,
    touch_responsive: true,
    wifi_works: true,
    cellular_works: true,
    calls_work: true,
    accessories_included: ['charger', 'usb_cable'],
    notes: '',
    ...overrides,
  };
}

// ── Handover Data Factories ──

export function createHandoverData(
  overrides?: Partial<HandoverData>
): HandoverData {
  return {
    selected_loan: null,
    customer_national_id: '',
    identity_verified: false,
    identity_photo_url: null,
    selected_device: null,
    device_imei_confirmed: false,
    device_condition: createDeviceCondition(),
    app_installed: false,
    app_configured: false,
    lock_test_passed: false,
    device_photos: [],
    signature_data_url: null,
    deposit_payment_method: '',
    deposit_transaction_ref: '',
    deposit_verified: false,
    ...overrides,
  };
}

export function createCompletedHandoverData(
  overrides?: Partial<HandoverData>
): HandoverData {
  const loan = createApprovedLoan();
  const device = createInventoryDevice();

  return createHandoverData({
    selected_loan: loan,
    customer_national_id: '63-123456A78',
    identity_verified: true,
    identity_photo_url: 'data:image/png;base64,mock-identity-photo',
    selected_device: device,
    device_imei_confirmed: true,
    device_condition: createDeviceCondition('excellent'),
    app_installed: true,
    app_configured: true,
    lock_test_passed: true,
    device_photos: [
      'data:image/png;base64,mock-photo-1',
      'data:image/png;base64,mock-photo-2',
    ],
    signature_data_url: 'data:image/png;base64,mock-signature',
    deposit_payment_method: 'ecocash',
    deposit_transaction_ref: 'EC12345678',
    deposit_verified: true,
    ...overrides,
  });
}

// Helper: Create handover data at a specific step completion
export function createHandoverAtStep(step: number): HandoverData {
  const base = createHandoverData();
  const loan = createApprovedLoan();
  const device = createInventoryDevice();

  if (step >= 1) {
    base.selected_loan = loan;
  }
  if (step >= 2) {
    base.customer_national_id = '63-123456A78';
    base.identity_verified = true;
    base.identity_photo_url = 'data:image/png;base64,mock-identity-photo';
  }
  if (step >= 3) {
    base.selected_device = device;
    base.device_imei_confirmed = true;
  }
  if (step >= 4) {
    base.device_condition = createDeviceCondition('excellent');
    base.app_installed = true;
    base.app_configured = true;
    base.lock_test_passed = true;
  }
  if (step >= 5) {
    base.device_photos = [
      'data:image/png;base64,mock-photo-1',
      'data:image/png;base64,mock-photo-2',
    ];
  }
  if (step >= 6) {
    base.signature_data_url = 'data:image/png;base64,mock-signature';
  }
  if (step >= 7) {
    base.deposit_payment_method = 'ecocash';
    base.deposit_transaction_ref = 'EC12345678';
    base.deposit_verified = true;
  }

  return base;
}

// ── Result Factories ──

export function createHandoverResult(
  success: boolean = true,
  overrides?: Partial<HandoverResult>
): HandoverResult {
  const handoverId = handoverCounter++;
  const loanId = loanCounter++;

  return {
    success,
    handover_id: `ho_${handoverId}`,
    loan_id: `LYN-2026-${String(loanId).padStart(3, '0')}`,
    commission_amount: 15.0,
    next_payment_date: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString(),
    message: success
      ? 'Handover completed successfully'
      : 'Handover failed',
    ...overrides,
  };
}

// ── Commission Factories ──

export function createCommission(
  overrides?: Partial<CommissionEntry>
): CommissionEntry {
  const id = commissionCounter++;
  const loanId = loanCounter++;

  return {
    id: `commission_${id}`,
    loan_id: `LYN-2026-${String(loanId).padStart(3, '0')}`,
    device_model: 'Samsung Galaxy A15',
    customer_name: `Customer ${id}`,
    device_retail_price: 300.0,
    commission_percentage: 5.0,
    commission_amount: 15.0,
    payment_status: 'pending',
    calculation_date: new Date().toISOString(),
    paid_at: null,
    ...overrides,
  };
}

export function createCommissions(count: number): CommissionEntry[] {
  return Array.from({ length: count }, () => createCommission());
}

export function createPaidCommission(
  overrides?: Partial<CommissionEntry>
): CommissionEntry {
  return createCommission({
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    ...overrides,
  });
}

// ── Stats Factories ──

export function createDashboardStats(
  overrides?: Partial<DashboardStats>
): DashboardStats {
  return {
    total_devices_distributed: 42,
    current_inventory: 15,
    total_commissions_earned: 1250.0,
    total_commissions_paid: 850.0,
    pending_commissions: 400.0,
    average_rating: 4.5,
    monthly_handovers: 12,
    last_month_handovers: 9,
    ...overrides,
  };
}
