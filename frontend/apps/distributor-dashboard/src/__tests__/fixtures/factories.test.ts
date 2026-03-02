import {
  createDistributor,
  createApprovedLoan,
  createApprovedLoans,
  createCompletedHandover,
  createCompletedHandovers,
  createInventoryDevice,
  createInventoryDevices,
  createDeviceCondition,
  createHandoverData,
  createCompletedHandoverData,
  createHandoverAtStep,
  createHandoverResult,
  createCommission,
  createCommissions,
  createPaidCommission,
  createDashboardStats,
  resetFactoryCounters,
} from './factories';

describe('Factory Functions', () => {
  beforeEach(() => {
    resetFactoryCounters();
  });

  describe('createDistributor', () => {
    it('generates default distributor with auto-incrementing ID', () => {
      const dist1 = createDistributor();
      const dist2 = createDistributor();

      expect(dist1.id).toBe('dist_1');
      expect(dist2.id).toBe('dist_2');
      expect(dist1.status).toBe('active');
      expect(dist1.kyc_status).toBe('approved');
    });

    it('supports overrides', () => {
      const distributor = createDistributor({
        name: 'John Doe',
        status: 'suspended',
        commission_rate: 0.1,
      });

      expect(distributor.name).toBe('John Doe');
      expect(distributor.status).toBe('suspended');
      expect(distributor.commission_rate).toBe(0.1);
    });

    it('generates valid phone numbers and emails', () => {
      const distributor = createDistributor();

      expect(distributor.phone_number).toMatch(/^\+263/);
      expect(distributor.email).toContain('@lynia.co.zw');
    });
  });

  describe('createApprovedLoan', () => {
    it('generates default approved loan', () => {
      const loan = createApprovedLoan();

      expect(loan.loan_id).toMatch(/^LYN-2026-/);
      expect(loan.deposit_paid).toBe(false);
      expect(loan.loan_amount).toBeGreaterThan(0);
    });

    it('supports overrides', () => {
      const loan = createApprovedLoan({
        customer_name: 'Jane Smith',
        loan_amount: 500,
        deposit_paid: true,
      });

      expect(loan.customer_name).toBe('Jane Smith');
      expect(loan.loan_amount).toBe(500);
      expect(loan.deposit_paid).toBe(true);
    });

    it('auto-increments loan IDs', () => {
      const l1 = createApprovedLoan();
      const l2 = createApprovedLoan();
      const l3 = createApprovedLoan();

      expect(l1.loan_id).toBe('LYN-2026-001');
      expect(l2.loan_id).toBe('LYN-2026-002');
      expect(l3.loan_id).toBe('LYN-2026-003');
    });
  });

  describe('createApprovedLoans', () => {
    it('creates multiple loans', () => {
      const loans = createApprovedLoans(5);

      expect(loans).toHaveLength(5);
      expect(loans[0].loan_id).toBe('LYN-2026-001');
      expect(loans[4].loan_id).toBe('LYN-2026-005');
    });

    it('creates empty array for count=0', () => {
      const loans = createApprovedLoans(0);
      expect(loans).toHaveLength(0);
    });
  });

  describe('createCompletedHandover', () => {
    it('creates a completed handover record', () => {
      const handover = createCompletedHandover();

      expect(handover.id).toMatch(/^ho_/);
      expect(handover.commission_earned).toBeGreaterThan(0);
      expect(handover.completed_at).toBeTruthy();
    });
  });

  describe('createCompletedHandovers', () => {
    it('creates multiple completed handovers', () => {
      const handovers = createCompletedHandovers(3);

      expect(handovers).toHaveLength(3);
      expect(handovers[0].id).toBe('ho_1');
      expect(handovers[2].id).toBe('ho_3');
    });
  });

  describe('createInventoryDevice', () => {
    it('generates default device', () => {
      const device = createInventoryDevice();

      expect(device.id).toBe('device_1');
      expect(device.status).toBe('available');
      expect(device.condition).toBe('new');
    });

    it('supports overrides', () => {
      const device = createInventoryDevice({
        brand: 'Apple',
        model: 'iPhone 13',
        status: 'reserved',
      });

      expect(device.brand).toBe('Apple');
      expect(device.model).toBe('iPhone 13');
      expect(device.status).toBe('reserved');
    });
  });

  describe('createInventoryDevices', () => {
    it('creates multiple devices', () => {
      const devices = createInventoryDevices(3);

      expect(devices).toHaveLength(3);
      expect(devices[0].id).toBe('device_1');
      expect(devices[2].id).toBe('device_3');
    });
  });

  describe('createDeviceCondition', () => {
    it('generates excellent condition by default', () => {
      const condition = createDeviceCondition();

      expect(condition.screen_condition).toBe('excellent');
      expect(condition.body_condition).toBe('excellent');
      expect(condition.buttons_functional).toBe(true);
      expect(condition.powers_on).toBe(true);
    });

    it('accepts condition rating parameter', () => {
      const condition = createDeviceCondition('poor');

      expect(condition.screen_condition).toBe('poor');
      expect(condition.body_condition).toBe('poor');
    });

    it('supports overrides', () => {
      const condition = createDeviceCondition('good', {
        buttons_functional: false,
        notes: 'Volume button stuck',
      });

      expect(condition.screen_condition).toBe('good');
      expect(condition.buttons_functional).toBe(false);
      expect(condition.notes).toBe('Volume button stuck');
    });
  });

  describe('createHandoverData', () => {
    it('generates initial handover data', () => {
      const data = createHandoverData();

      expect(data.selected_loan).toBeNull();
      expect(data.selected_device).toBeNull();
      expect(data.identity_verified).toBe(false);
      expect(data.device_imei_confirmed).toBe(false);
      expect(data.deposit_verified).toBe(false);
    });

    it('supports overrides', () => {
      const data = createHandoverData({
        customer_national_id: '63-999999A99',
        identity_verified: true,
      });

      expect(data.customer_national_id).toBe('63-999999A99');
      expect(data.identity_verified).toBe(true);
    });
  });

  describe('createCompletedHandoverData', () => {
    it('generates fully completed handover data', () => {
      const data = createCompletedHandoverData();

      expect(data.selected_loan).toBeTruthy();
      expect(data.selected_device).toBeTruthy();
      expect(data.identity_verified).toBe(true);
      expect(data.device_imei_confirmed).toBe(true);
      expect(data.deposit_verified).toBe(true);
      expect(data.device_photos).toHaveLength(2);
      expect(data.signature_data_url).toBeTruthy();
    });
  });

  describe('createHandoverAtStep', () => {
    it('creates handover data at step 1 (loan selected)', () => {
      const data = createHandoverAtStep(1);
      expect(data.selected_loan).toBeTruthy();
      expect(data.identity_verified).toBe(false);
    });

    it('creates handover data at step 2 (identity verified)', () => {
      const data = createHandoverAtStep(2);
      expect(data.selected_loan).toBeTruthy();
      expect(data.identity_verified).toBe(true);
      expect(data.customer_national_id).toBeTruthy();
      expect(data.device_imei_confirmed).toBe(false);
    });

    it('creates handover data at step 3 (device confirmed)', () => {
      const data = createHandoverAtStep(3);
      expect(data.selected_device).toBeTruthy();
      expect(data.device_imei_confirmed).toBe(true);
      expect(data.app_installed).toBe(false);
    });

    it('creates handover data at step 7 (fully complete)', () => {
      const data = createHandoverAtStep(7);
      expect(data.identity_verified).toBe(true);
      expect(data.device_imei_confirmed).toBe(true);
      expect(data.deposit_verified).toBe(true);
    });
  });

  describe('createHandoverResult', () => {
    it('generates successful result by default', () => {
      const result = createHandoverResult();

      expect(result.success).toBe(true);
      expect(result.message).toContain('success');
      expect(result.commission_amount).toBeGreaterThan(0);
    });

    it('generates failed result when success=false', () => {
      const result = createHandoverResult(false);

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });

    it('supports overrides', () => {
      const result = createHandoverResult(true, {
        commission_amount: 25.0,
        message: 'Custom success message',
      });

      expect(result.commission_amount).toBe(25.0);
      expect(result.message).toBe('Custom success message');
    });
  });

  describe('createCommission', () => {
    it('generates default commission', () => {
      const commission = createCommission();

      expect(commission.id).toBe('commission_1');
      expect(commission.payment_status).toBe('pending');
      expect(commission.paid_at).toBeNull();
    });

    it('auto-increments IDs', () => {
      const c1 = createCommission();
      const c2 = createCommission();

      expect(c1.id).toBe('commission_1');
      expect(c2.id).toBe('commission_2');
    });
  });

  describe('createCommissions', () => {
    it('creates multiple commissions', () => {
      const commissions = createCommissions(4);

      expect(commissions).toHaveLength(4);
      expect(commissions[0].id).toBe('commission_1');
      expect(commissions[3].id).toBe('commission_4');
    });
  });

  describe('createPaidCommission', () => {
    it('creates commission with paid status', () => {
      const commission = createPaidCommission();

      expect(commission.payment_status).toBe('paid');
      expect(commission.paid_at).toBeTruthy();
    });
  });

  describe('createDashboardStats', () => {
    it('generates default stats', () => {
      const stats = createDashboardStats();

      expect(stats.total_devices_distributed).toBeGreaterThan(0);
      expect(stats.current_inventory).toBeGreaterThan(0);
      expect(stats.average_rating).toBeGreaterThan(0);
      expect(stats.last_month_handovers).toBeDefined();
    });

    it('supports overrides', () => {
      const stats = createDashboardStats({
        total_devices_distributed: 100,
        monthly_handovers: 20,
      });

      expect(stats.total_devices_distributed).toBe(100);
      expect(stats.monthly_handovers).toBe(20);
    });
  });

  describe('resetFactoryCounters', () => {
    it('resets all counters to 1', () => {
      createDistributor();
      createApprovedLoan();
      createInventoryDevice();
      createCommission();

      resetFactoryCounters();

      const dist = createDistributor();
      const loan = createApprovedLoan();
      const device = createInventoryDevice();
      const commission = createCommission();

      expect(dist.id).toBe('dist_1');
      expect(loan.loan_id).toBe('LYN-2026-001');
      expect(device.id).toBe('device_1');
      expect(commission.id).toBe('commission_1');
    });
  });
});
