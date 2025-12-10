/**
 * Test Fixtures: Devices
 * Sample device data for testing
 */

export const testDevices = {
  // Available device in stock
  availableDevice: {
    id: 'device_test_001',
    imei: '123456789012345',
    serial_number: 'SN123456',
    brand: 'Samsung',
    model: 'Galaxy A14',
    storage: '128GB',
    color: 'Black',
    condition: 'new',
    retail_price: 350,
    status: 'in_stock',
    distributor_id: 'dist_test_001',
    customer_id: null,
    loan_id: null,
    lock_status: 'unlocked',
    assigned_at: null,
    created_at: new Date().toISOString()
  },

  // Device assigned to customer
  assignedDevice: {
    id: 'device_test_002',
    imei: '123456789012346',
    serial_number: 'SN123457',
    brand: 'Samsung',
    model: 'Galaxy A24',
    storage: '128GB',
    color: 'Blue',
    condition: 'new',
    retail_price: 400,
    status: 'assigned',
    distributor_id: 'dist_test_001',
    customer_id: 'cust_test_003',
    loan_id: 'loan_test_002',
    lock_status: 'unlocked',
    assigned_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  },

  // Locked device (overdue payment)
  lockedDevice: {
    id: 'device_test_003',
    imei: '123456789012347',
    serial_number: 'SN123458',
    brand: 'Xiaomi',
    model: 'Redmi Note 12',
    storage: '128GB',
    color: 'Gray',
    condition: 'new',
    retail_price: 300,
    status: 'assigned',
    distributor_id: 'dist_test_001',
    customer_id: 'cust_test_007',
    loan_id: 'loan_test_007',
    lock_status: 'locked',
    locked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    assigned_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  }
};

export const testHandovers = {
  initiated: {
    id: 'handover_test_001',
    loan_id: 'loan_test_004',
    customer_id: 'cust_test_004',
    device_id: 'device_test_001',
    distributor_id: 'dist_test_001',
    status: 'initiated',
    identity_verified: false,
    deposit_verified: false,
    device_inspected: false,
    completed_at: null,
    created_at: new Date().toISOString()
  },

  depositVerified: {
    id: 'handover_test_002',
    loan_id: 'loan_test_004',
    customer_id: 'cust_test_004',
    device_id: 'device_test_001',
    distributor_id: 'dist_test_001',
    status: 'deposit_verified',
    identity_verified: true,
    deposit_verified: true,
    device_inspected: false,
    completed_at: null,
    created_at: new Date().toISOString()
  },

  completed: {
    id: 'handover_test_003',
    loan_id: 'loan_test_001',
    customer_id: 'cust_test_001',
    device_id: 'device_test_001',
    distributor_id: 'dist_test_001',
    status: 'completed',
    identity_verified: true,
    deposit_verified: true,
    device_inspected: true,
    completed_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString()
  }
};

export const testLockHistory = {
  autoLock: {
    device_id: 'device_test_003',
    loan_id: 'loan_test_007',
    action: 'lock',
    reason: 'Payment overdue 7+ days',
    trigger_type: 'automated',
    triggered_by: 'system',
    trustonic_status: 'success',
    performed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },

  autoUnlock: {
    device_id: 'device_test_002',
    loan_id: 'loan_test_002',
    action: 'unlock',
    reason: 'Payment received - outstanding balance cleared',
    trigger_type: 'payment',
    triggered_by: 'system',
    trustonic_status: 'success',
    performed_at: new Date().toISOString()
  },

  manualUnlock: {
    device_id: 'device_test_003',
    loan_id: 'loan_test_007',
    action: 'unlock',
    reason: 'Payment dispute resolved - manual override by admin',
    trigger_type: 'manual',
    triggered_by: 'admin_001',
    trustonic_status: 'success',
    performed_at: new Date().toISOString()
  }
};
