import {
  createDistributor,
  createPendingHandover,
  createPendingHandovers,
  createCompletedHandover,
  createInProgressHandover,
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

  describe('createPendingHandover', () => {
    it('generates default pending handover', () => {
      const handover = createPendingHandover();

      expect(handover.id).toBe('handover_1');
      expect(handover.status).toBe('pending');
      expect(handover.deposit_paid).toBe(false);
    });

    it('supports overrides', () => {
      const handover = createPendingHandover({
        customer_name: 'Jane Smith',
        device_model: 'iPhone 13',
        loan_amount: 500,
      });

      expect(handover.customer_name).toBe('Jane Smith');
      expect(handover.device_model).toBe('iPhone 13');
      expect(handover.loan_amount).toBe(500);
    });

    it('auto-increments IDs', () => {
      const h1 = createPendingHandover();
      const h2 = createPendingHandover();
      const h3 = createPendingHandover();

      expect(h1.id).toBe('handover_1');
      expect(h2.id).toBe('handover_2');
      expect(h3.id).toBe('handover_3');
    });
  });

  describe('createPendingHandovers', () => {
    it('creates multiple handovers', () => {
      const handovers = createPendingHandovers(5);

      expect(handovers).toHaveLength(5);
      expect(handovers[0].id).toBe('handover_1');
      expect(handovers[4].id).toBe('handover_5');
    });

    it('creates empty array for count=0', () => {
      const handovers = createPendingHandovers(0);
      expect(handovers).toHaveLength(0);
    });
  });

  describe('createCompletedHandover', () => {
    it('creates handover with completed status', () => {
      const handover = createCompletedHandover();

      expect(handover.status).toBe('completed');
      expect(handover.deposit_paid).toBe(true);
    });
  });

  describe('createInProgressHandover', () => {
    it('creates handover with in_progress status', () => {
      const handover = createInProgressHandover();
      expect(handover.status).toBe('in_progress');
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

      expect(data.handover_id).toBeTruthy();
      expect(data.selected_handover).toBeTruthy();
      expect(data.identity_verified).toBe(false);
      expect(data.imei_verified).toBe(false);
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

      expect(data.identity_verified).toBe(true);
      expect(data.imei_verified).toBe(true);
      expect(data.deposit_verified).toBe(true);
      expect(data.device_photos).toHaveLength(2);
      expect(data.signature_data_url).toBeTruthy();
    });
  });

  describe('createHandoverAtStep', () => {
    it('creates handover data at step 1 (handover selected)', () => {
      const data = createHandoverAtStep(1);
      expect(data.selected_handover).toBeTruthy();
      expect(data.identity_verified).toBe(false);
    });

    it('creates handover data at step 2 (identity verified)', () => {
      const data = createHandoverAtStep(2);
      expect(data.selected_handover).toBeTruthy();
      expect(data.identity_verified).toBe(true);
      expect(data.customer_national_id).toBeTruthy();
      expect(data.imei_verified).toBe(false);
    });

    it('creates handover data at step 3 (IMEI verified)', () => {
      const data = createHandoverAtStep(3);
      expect(data.imei_verified).toBe(true);
      expect(data.scanned_imei).toBeTruthy();
      expect(data.app_installed).toBe(false);
    });

    it('creates handover data at step 7 (fully complete)', () => {
      const data = createHandoverAtStep(7);
      expect(data.identity_verified).toBe(true);
      expect(data.imei_verified).toBe(true);
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
    });

    it('supports overrides', () => {
      const stats = createDashboardStats({
        total_devices_distributed: 100,
        pending_handovers: 20,
      });

      expect(stats.total_devices_distributed).toBe(100);
      expect(stats.pending_handovers).toBe(20);
    });
  });

  describe('resetFactoryCounters', () => {
    it('resets all counters to 1', () => {
      createDistributor();
      createPendingHandover();
      createInventoryDevice();
      createCommission();

      resetFactoryCounters();

      const dist = createDistributor();
      const handover = createPendingHandover();
      const device = createInventoryDevice();
      const commission = createCommission();

      expect(dist.id).toBe('dist_1');
      expect(handover.id).toBe('handover_1');
      expect(device.id).toBe('device_1');
      expect(commission.id).toBe('commission_1');
    });
  });
});
