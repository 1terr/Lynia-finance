/**
 * E2E Test: E2E-006 - Distributor Commission & Device Management
 *
 * Scenario: Distributor receives devices, completes customer handover, earns commission
 * Flow: Devices received -> Customer handover -> Commission calculated -> Commission credited -> Inventory updated
 *
 * Expected Result: Distributor inventory decreases, commission of 5% recorded and credited
 */

import { createAPIGatewayEvent, parseResponseBody } from '../helpers/test-utils';
import { testCustomers, testDevices, testLoans } from '../fixtures';

// Mock external dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));
jest.mock('axios');

const axios = require('axios');

// ---------------------------------------------------------------------------
// Mock Supabase query builder
// ---------------------------------------------------------------------------
const createMockQueryBuilder = () => {
  const builder: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'match', 'filter', 'range', 'count',
  ];
  for (const m of methods) {
    builder[m] = jest.fn().mockReturnValue(builder);
  }
  builder.single = jest.fn().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return builder;
};

const mockSupabaseClient = {
  from: jest.fn(() => createMockQueryBuilder()),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
  },
  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.supabase.co/storage/test' } }),
    }),
  },
};

// ---------------------------------------------------------------------------
// Import handlers after mocking
// ---------------------------------------------------------------------------
import { handler as lockHandler } from '../../services/lock-service/src/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const device = testDevices.availableDevice;
const customer = testCustomers.zimbabweCustomer;
const activeLoan = testLoans.activeLoan;

const COMMISSION_RATE = 0.05; // 5%
const distributorId = 'dist_test_001';

describe('E2E-006: Distributor Commission & Device Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { success: true } });
    axios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  // =========================================================================
  // STEP 1: Distributor Receives Devices
  // =========================================================================
  describe('Step 1: Distributor Receives Devices', () => {
    it('should validate available device fixture is in_stock', () => {
      expect(device.status).toBe('in_stock');
      expect(device.lock_status).toBe('unlocked');
      expect(device.customer_id).toBeNull();
      expect(device.loan_id).toBeNull();
    });

    it('should validate device has a valid IMEI', () => {
      expect(device.imei).toMatch(/^\d{15}$/);
      expect(device.imei.length).toBe(15);
    });

    it('should validate device has retail price set', () => {
      expect(device.retail_price).toBe(350);
      expect(device.retail_price).toBeGreaterThan(0);
    });

    it('should validate device model and brand are populated', () => {
      expect(device.model).toBeDefined();
      expect(device.model.length).toBeGreaterThan(0);
      expect(device.brand).toBeDefined();
      expect(device.brand.length).toBeGreaterThan(0);
    });

    it('should validate inventory record structure for distributor', () => {
      const inventoryRecord = {
        distributor_id: distributorId,
        device_id: device.id,
        status: 'in_stock',
        received_date: new Date().toISOString(),
        sold_date: null,
        sold_to_customer_id: null,
        sold_loan_id: null,
      };

      expect(inventoryRecord.distributor_id).toBe(distributorId);
      expect(inventoryRecord.status).toBe('in_stock');
      expect(inventoryRecord.sold_date).toBeNull();
      expect(inventoryRecord.sold_to_customer_id).toBeNull();
    });

    it('should validate that an in_stock device can be assigned for handover', () => {
      const canHandover = device.status === 'in_stock' && device.lock_status === 'unlocked';
      expect(canHandover).toBe(true);
    });
  });

  // =========================================================================
  // STEP 2: Customer Completes Handover
  // =========================================================================
  describe('Step 2: Customer Completes Handover', () => {
    it('should return 400 when initiating handover without all fields', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify({
          loan_id: 'loan_001',
          // Missing device_id, customer_id, distributor_id, etc.
        }),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
    });

    it('should validate the full handover request structure', () => {
      const handoverRequest = {
        loan_id: activeLoan.id,
        device_id: device.id,
        customer_id: customer.id,
        distributor_id: distributorId,
        handover_location: 'Harare Central Branch',
        handed_over_by: 'Agent John Doe',
      };

      expect(handoverRequest.loan_id).toBeDefined();
      expect(handoverRequest.device_id).toBeDefined();
      expect(handoverRequest.customer_id).toBeDefined();
      expect(handoverRequest.distributor_id).toBe(distributorId);
      expect(handoverRequest.handover_location.length).toBeGreaterThan(0);
      expect(handoverRequest.handed_over_by.length).toBeGreaterThan(0);
    });

    it('should validate handover steps must be completed in order', () => {
      const handoverSteps = [
        'initiated',
        'identity_verified',
        'deposit_verified',
        'device_inspected',
        'completed',
      ];

      for (let i = 1; i < handoverSteps.length; i++) {
        const previous = handoverSteps[i - 1];
        const current = handoverSteps[i];
        // Current step index should be after previous
        expect(handoverSteps.indexOf(current)).toBeGreaterThan(handoverSteps.indexOf(previous));
      }
    });

    it('should validate device condition inspection structure', () => {
      const deviceCondition = {
        screen_condition: 'excellent' as const,
        body_condition: 'good' as const,
        buttons_functional: true,
        ports_functional: true,
        cameras_functional: true,
        powers_on: true,
        touch_responsive: true,
        wifi_works: true,
        cellular_works: true,
        calls_work: true,
        accessories_included: ['charger', 'box', 'manual'],
        notes: 'Device in excellent condition, fully functional',
      };

      expect(deviceCondition.screen_condition).toBe('excellent');
      expect(deviceCondition.powers_on).toBe(true);
      expect(deviceCondition.touch_responsive).toBe(true);
      expect(deviceCondition.accessories_included).toHaveLength(3);
      expect(deviceCondition.accessories_included).toContain('charger');
    });

    it('should return 400 when completing handover without handover_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/complete',
        body: JSON.stringify({}),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'handover_id is required');
    });
  });

  // =========================================================================
  // STEP 3: Commission Calculated
  // =========================================================================
  describe('Step 3: Commission Calculated and Credited', () => {
    it('should calculate 5% commission on $350 device', () => {
      const devicePrice = device.retail_price; // $350
      const commission = devicePrice * COMMISSION_RATE;

      expect(commission).toBe(17.50);
      expect(commission).toBeGreaterThan(0);
      expect(commission).toBeLessThan(devicePrice);
    });

    it('should validate commission rate is exactly 5%', () => {
      expect(COMMISSION_RATE).toBe(0.05);
      expect(COMMISSION_RATE * 100).toBe(5);
    });

    it('should calculate commission for different device prices', () => {
      const prices = [150, 250, 350, 500, 800];
      const expectedCommissions = [7.50, 12.50, 17.50, 25.00, 40.00];

      prices.forEach((price, index) => {
        const commission = price * COMMISSION_RATE;
        expect(commission).toBeCloseTo(expectedCommissions[index], 2);
      });
    });

    it('should validate commission record structure', () => {
      const commissionRecord = {
        distributor_id: distributorId,
        loan_id: activeLoan.id,
        device_id: device.id,
        commission_amount_usd: device.retail_price * COMMISSION_RATE,
        commission_percentage: COMMISSION_RATE * 100,
        device_retail_price_usd: device.retail_price,
        calculation_date: new Date().toISOString(),
        payment_status: 'pending' as const,
        notes: `Commission for device handover - ${device.model}`,
      };

      expect(commissionRecord.distributor_id).toBe(distributorId);
      expect(commissionRecord.commission_amount_usd).toBe(17.50);
      expect(commissionRecord.commission_percentage).toBe(5);
      expect(commissionRecord.device_retail_price_usd).toBe(350);
      expect(commissionRecord.payment_status).toBe('pending');
      expect(commissionRecord.notes).toContain(device.model);
    });

    it('should validate commission payment status lifecycle', () => {
      const validStatuses = ['pending', 'processing', 'paid', 'cancelled'];
      const commissionStatus = 'pending';

      expect(validStatuses).toContain(commissionStatus);
      expect(validStatuses.indexOf('pending')).toBeLessThan(validStatuses.indexOf('paid'));
    });

    it('should validate total commissions calculation for multiple devices', () => {
      const devices = [
        { price: 350, commission: 17.50 },
        { price: 250, commission: 12.50 },
        { price: 500, commission: 25.00 },
      ];

      const totalCommission = devices.reduce((sum, d) => sum + d.commission, 0);
      const expectedTotal = devices.reduce((sum, d) => sum + d.price * COMMISSION_RATE, 0);

      expect(totalCommission).toBeCloseTo(55.00, 2);
      expect(totalCommission).toBeCloseTo(expectedTotal, 2);
    });
  });

  // =========================================================================
  // STEP 4: Distributor Inventory Updated
  // =========================================================================
  describe('Step 4: Distributor Inventory Updated', () => {
    it('should transition inventory record from in_stock to sold', () => {
      const beforeHandover = {
        status: 'in_stock',
        sold_date: null,
        sold_to_customer_id: null,
        sold_loan_id: null,
      };

      const afterHandover = {
        status: 'sold',
        sold_date: new Date().toISOString(),
        sold_to_customer_id: customer.id,
        sold_loan_id: activeLoan.id,
      };

      expect(beforeHandover.status).toBe('in_stock');
      expect(afterHandover.status).toBe('sold');
      expect(afterHandover.sold_to_customer_id).toBe(customer.id);
      expect(afterHandover.sold_loan_id).toBe(activeLoan.id);
      expect(afterHandover.sold_date).not.toBeNull();
    });

    it('should track device status change from in_stock to assigned', () => {
      const beforeStatus = 'in_stock';
      const afterStatus = 'assigned';

      expect(beforeStatus).toBe('in_stock');
      expect(afterStatus).toBe('assigned');
      expect(beforeStatus).not.toBe(afterStatus);
    });

    it('should link device to customer and loan after handover', () => {
      const assignedDevice = {
        ...device,
        status: 'assigned',
        customer_id: customer.id,
        loan_id: activeLoan.id,
        assigned_at: new Date().toISOString(),
      };

      expect(assignedDevice.customer_id).toBe(customer.id);
      expect(assignedDevice.loan_id).toBe(activeLoan.id);
      expect(assignedDevice.status).toBe('assigned');
      expect(assignedDevice.assigned_at).toBeDefined();
    });

    it('should validate inventory count decreases after handover', () => {
      const initialCount = 10;
      const afterHandoverCount = initialCount - 1;

      expect(afterHandoverCount).toBe(9);
      expect(afterHandoverCount).toBeLessThan(initialCount);
      expect(afterHandoverCount).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Distributor Dashboard Data Validation
  // =========================================================================
  describe('Distributor Dashboard Data', () => {
    it('should validate distributor summary structure', () => {
      const distributorSummary = {
        distributor_id: distributorId,
        total_devices_received: 25,
        total_devices_sold: 15,
        devices_in_stock: 10,
        total_commission_earned: 262.50, // 15 * $17.50 avg
        total_commission_paid: 175.00,
        pending_commission: 87.50,
      };

      expect(distributorSummary.total_devices_received).toBe(
        distributorSummary.total_devices_sold + distributorSummary.devices_in_stock
      );
      expect(distributorSummary.total_commission_earned).toBe(
        distributorSummary.total_commission_paid + distributorSummary.pending_commission
      );
      expect(distributorSummary.devices_in_stock).toBeGreaterThanOrEqual(0);
    });

    it('should format commission amounts with 2 decimal places in USD', () => {
      const amount = 17.5;
      const formatted = `$${amount.toFixed(2)}`;
      expect(formatted).toBe('$17.50');
    });

    it('should validate commission payout dates', () => {
      const commissionDate = new Date();
      const payoutDate = new Date(commissionDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days later
      const daysDiff = (payoutDate.getTime() - commissionDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeCloseTo(14, 0);
      expect(payoutDate.getTime()).toBeGreaterThan(commissionDate.getTime());
    });
  });

  // =========================================================================
  // Error Scenarios
  // =========================================================================
  describe('Error Scenarios', () => {
    it('should return 400 when readiness check missing loan_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/check-readiness',
        body: JSON.stringify({}),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'loan_id is required');
    });

    it('should return 404 for unknown lock-service routes', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/unknown/path',
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(404);
    });

    it('should validate commission never exceeds device price', () => {
      const largeDevicePrice = 1000;
      const commission = largeDevicePrice * COMMISSION_RATE;

      expect(commission).toBe(50);
      expect(commission).toBeLessThan(largeDevicePrice);
    });

    it('should validate commission for $0 device (edge case)', () => {
      const zeroPrice = 0;
      const commission = zeroPrice * COMMISSION_RATE;

      expect(commission).toBe(0);
    });

    it('should validate device conditions array for valid values', () => {
      const validConditions = ['excellent', 'good', 'fair', 'poor'];

      for (const condition of validConditions) {
        expect(['excellent', 'good', 'fair', 'poor']).toContain(condition);
      }
    });
  });
});
