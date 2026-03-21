/**
 * Characterization tests for services/lock-service/src/handover-service.ts
 *
 * Device handover workflow -- checks readiness, initiates handover, verifies
 * identity/deposit, records device condition, completes handover with
 * distributor commission calculation.
 */

// Mock all external dependencies before importing
jest.mock('../../../services/shared/clients/database', () => {
  const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or', 'order', 'limit', 'single', 'maybeSingle'];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: { from: jest.fn().mockImplementation(() => createChain()) },
    withTransaction: jest.fn().mockImplementation(async (fn: Function) => {
      const tx = jest.fn().mockResolvedValue({ data: [], error: null });
      return fn(tx);
    }),
    __mockExecute: mockExecute,
  };
});

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn(), startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }) },
}));

import { HandoverService } from '../../../services/lock-service/src/handover-service';
const { db, __mockExecute } = require('../../../services/shared/clients/database');

describe('HandoverService', () => {
  let service: HandoverService;

  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
    service = new HandoverService();
  });

  // ─── checkHandoverReadiness ────────────────────────────────
  describe('checkHandoverReadiness', () => {
    it('should return not ready when loan is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const result = await service.checkHandoverReadiness('loan-missing');

      expect(result.ready).toBe(false);
      expect(result.blockers).toContain('Loan not found');
    });

    it('should return blocker when loan status is not paid_deposit', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'pending',
            deposit_paid: true,
            customer_id: 'cust-001',
            device_id: 'dev-001',
          },
          error: null,
        }) // loan
        .mockResolvedValueOnce({
          data: { kyc_status: 'verified' },
          error: null,
        }) // customer
        .mockResolvedValueOnce({
          data: { status: 'in_stock' },
          error: null,
        }); // device

      const result = await service.checkHandoverReadiness('loan-001');

      expect(result.ready).toBe(false);
      expect(result.blockers[0]).toContain('paid_deposit');
    });

    it('should return blocker when deposit is not paid', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'paid_deposit',
            deposit_paid: false,
            customer_id: 'cust-001',
            device_id: 'dev-001',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { kyc_status: 'verified' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { status: 'in_stock' },
          error: null,
        });

      const result = await service.checkHandoverReadiness('loan-001');

      expect(result.ready).toBe(false);
      expect(result.blockers).toContain('Deposit not paid');
    });

    it('should return blocker when KYC is not verified', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'paid_deposit',
            deposit_paid: true,
            customer_id: 'cust-001',
            device_id: 'dev-001',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { kyc_status: 'pending' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { status: 'in_stock' },
          error: null,
        });

      const result = await service.checkHandoverReadiness('loan-001');

      expect(result.ready).toBe(false);
      expect(result.blockers[0]).toContain('KYC not verified');
    });

    it('should return blocker when device is not assigned to loan', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'paid_deposit',
            deposit_paid: true,
            customer_id: 'cust-001',
            device_id: null,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { kyc_status: 'verified' },
          error: null,
        });

      const result = await service.checkHandoverReadiness('loan-001');

      expect(result.ready).toBe(false);
      expect(result.blockers).toContain('Device not assigned to loan');
    });

    it('should return blocker when device is not in_stock', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'paid_deposit',
            deposit_paid: true,
            customer_id: 'cust-001',
            device_id: 'dev-001',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { kyc_status: 'verified' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { status: 'assigned' },
          error: null,
        });

      const result = await service.checkHandoverReadiness('loan-001');

      expect(result.ready).toBe(false);
      expect(result.blockers[0]).toContain('Device not available');
    });

    it('should return ready when all conditions are met', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'paid_deposit',
            deposit_paid: true,
            customer_id: 'cust-001',
            device_id: 'dev-001',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { kyc_status: 'verified' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { status: 'in_stock' },
          error: null,
        });

      const result = await service.checkHandoverReadiness('loan-001');

      expect(result.ready).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should return multiple blockers when multiple conditions fail', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'pending',
            deposit_paid: false,
            customer_id: 'cust-001',
            device_id: null,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { kyc_status: 'pending' },
          error: null,
        });

      const result = await service.checkHandoverReadiness('loan-001');

      expect(result.ready).toBe(false);
      expect(result.blockers.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── initiateHandover ──────────────────────────────────────
  describe('initiateHandover', () => {
    const validRequest = {
      loan_id: 'loan-001',
      device_id: 'dev-001',
      customer_id: 'cust-001',
      distributor_id: 'dist-001',
      handover_location: 'Harare Office',
      handed_over_by: 'agent-001',
    };

    it('should throw when readiness check fails', async () => {
      // checkHandoverReadiness fails (loan not found)
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.initiateHandover(validRequest)).rejects.toThrow('Handover not ready');
    });

    it('should create handover record when all checks pass', async () => {
      // checkHandoverReadiness passes
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'paid_deposit',
            deposit_paid: true,
            customer_id: 'cust-001',
            device_id: 'dev-001',
          },
          error: null,
        }) // loan
        .mockResolvedValueOnce({
          data: { kyc_status: 'verified' },
          error: null,
        }) // customer
        .mockResolvedValueOnce({
          data: { status: 'in_stock' },
          error: null,
        }) // device
        .mockResolvedValueOnce({
          data: {
            id: 'handover-001',
            loan_id: 'loan-001',
            device_id: 'dev-001',
            customer_id: 'cust-001',
            status: 'initiated',
            identity_verified: false,
            deposit_verified: false,
            device_condition_verified: false,
          },
          error: null,
        }); // insert handover

      const result = await service.initiateHandover(validRequest);

      expect(result.id).toBe('handover-001');
      expect(result.status).toBe('initiated');
      expect(db.from).toHaveBeenCalledWith('device_handovers');
    });

    it('should throw when handover record creation fails', async () => {
      // readiness passes
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            status: 'paid_deposit',
            deposit_paid: true,
            customer_id: 'cust-001',
            device_id: 'dev-001',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: { kyc_status: 'verified' }, error: null })
        .mockResolvedValueOnce({ data: { status: 'in_stock' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } }); // handover insert fails

      await expect(service.initiateHandover(validRequest)).rejects.toThrow('Failed to create handover record');
    });
  });

  // ─── verifyCustomerIdentity ────────────────────────────────
  describe('verifyCustomerIdentity', () => {
    it('should throw when handover is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.verifyCustomerIdentity('handover-missing', '12345678A90')).rejects.toThrow('Handover not found');
    });

    it('should return not verified when no KYC record exists', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', customer_id: 'cust-001' },
          error: null,
        }) // handover
        .mockResolvedValueOnce({ data: null, error: null }); // no KYC submission

      const result = await service.verifyCustomerIdentity('handover-001', '12345678A90');

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('No verified KYC record');
    });

    it('should return not verified when ID number does not match', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', customer_id: 'cust-001' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id_number: '12345678A90', status: 'verified' },
          error: null,
        });

      const result = await service.verifyCustomerIdentity('handover-001', '99999999Z99');

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('does not match');
    });

    it('should return verified when ID matches (case insensitive)', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', customer_id: 'cust-001' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id_number: '12345678A90', status: 'verified' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // update handover

      const result = await service.verifyCustomerIdentity('handover-001', '12345678a90');

      expect(result.verified).toBe(true);
    });

    it('should update handover record on successful verification', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', customer_id: 'cust-001' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id_number: 'ABCDEFGH123', status: 'verified' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // update handover

      await service.verifyCustomerIdentity('handover-001', 'ABCDEFGH123');

      expect(db.from).toHaveBeenCalledWith('device_handovers');
    });
  });

  // ─── verifyDepositPayment ──────────────────────────────────
  describe('verifyDepositPayment', () => {
    it('should throw when handover is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.verifyDepositPayment('handover-missing')).rejects.toThrow('Handover not found');
    });

    it('should return not verified when loan not found', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', loan_id: 'loan-001' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // loan not found

      const result = await service.verifyDepositPayment('handover-001');

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Loan not found');
    });

    it('should return not verified when deposit is not paid', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', loan_id: 'loan-001' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { deposit_paid: false, deposit_amount: 100 },
          error: null,
        });

      const result = await service.verifyDepositPayment('handover-001');

      expect(result.verified).toBe(false);
      expect(result.reason).toBe('Deposit not paid');
    });

    it('should return not verified when no completed deposit payment record exists', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', loan_id: 'loan-001' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { deposit_paid: true, deposit_amount: 100 },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // no payment record

      const result = await service.verifyDepositPayment('handover-001');

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('No completed deposit payment');
    });

    it('should return verified with payment details on success', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', loan_id: 'loan-001' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { deposit_paid: true, deposit_amount: 100 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'pay-001', amount: 100 },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // update handover

      const result = await service.verifyDepositPayment('handover-001');

      expect(result.verified).toBe(true);
      expect(result.payment_id).toBe('pay-001');
      expect(result.amount).toBe(100);
    });
  });

  // ─── recordDeviceCondition ─────────────────────────────────
  describe('recordDeviceCondition', () => {
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
      accessories_included: ['charger', 'box'],
      notes: 'Minor scratch on back',
    };

    it('should update handover record with device condition', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await service.recordDeviceCondition('handover-001', deviceCondition);

      expect(db.from).toHaveBeenCalledWith('device_handovers');
    });

    it('should throw when database update fails', async () => {
      __mockExecute.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.recordDeviceCondition('handover-001', deviceCondition)
      ).rejects.toThrow('DB error');
    });
  });

  // ─── completeHandover ──────────────────────────────────────
  describe('completeHandover', () => {
    it('should throw when handover is not found', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: null }) // handover not found
        .mockResolvedValueOnce({ data: null, error: null }); // mark as failed

      await expect(service.completeHandover('handover-missing')).rejects.toThrow('Handover not found');
    });

    it('should throw when identity is not verified', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'handover-001',
            identity_verified: false,
            deposit_verified: true,
            device_condition_verified: true,
            loan_id: 'loan-001',
            device_id: 'dev-001',
            customer_id: 'cust-001',
            distributor_id: 'dist-001',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // mark as failed

      await expect(service.completeHandover('handover-001')).rejects.toThrow('Identity not verified');
    });

    it('should throw when deposit is not verified', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'handover-001',
            identity_verified: true,
            deposit_verified: false,
            device_condition_verified: true,
            loan_id: 'loan-001',
            device_id: 'dev-001',
            customer_id: 'cust-001',
            distributor_id: 'dist-001',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // mark as failed

      await expect(service.completeHandover('handover-001')).rejects.toThrow('Deposit not verified');
    });

    it('should throw when device condition is not verified', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'handover-001',
            identity_verified: true,
            deposit_verified: true,
            device_condition_verified: false,
            loan_id: 'loan-001',
            device_id: 'dev-001',
            customer_id: 'cust-001',
            distributor_id: 'dist-001',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // mark as failed

      await expect(service.completeHandover('handover-001')).rejects.toThrow('Device condition not verified');
    });

    it('should complete handover with commission when all verified', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'handover-001',
            identity_verified: true,
            deposit_verified: true,
            device_condition_verified: true,
            loan_id: 'loan-001',
            device_id: 'dev-001',
            customer_id: 'cust-001',
            distributor_id: 'dist-001',
          },
          error: null,
        }) // handover read via db.from
        // calculateDistributorCommission sub-calls (via db.from):
        .mockResolvedValueOnce({ data: { loan_amount_usd: 1000 }, error: null }) // loan
        .mockResolvedValueOnce({ data: { retail_price_usd: 500, model: 'Samsung A15' }, error: null }) // device
        .mockResolvedValueOnce({ data: { commission_rate: 5 }, error: null }) // distributor
        // withTransaction handles mutations (loan update, device update, commission insert, handover update, lock insert, cancel returns)
        .mockResolvedValue({ data: null, error: null }); // any remaining db.from calls

      const result = await service.completeHandover('handover-001');

      expect(result.success).toBe(true);
      expect(result.loan_id).toBe('loan-001');
      expect(result.commission.amount).toBe(50); // 1000 * 5%
      expect(result.commission.percentage).toBe(5);
    });

    it('should use default 5% commission rate when distributor has none', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'handover-002',
            identity_verified: true,
            deposit_verified: true,
            device_condition_verified: true,
            loan_id: 'loan-002',
            device_id: 'dev-002',
            customer_id: 'cust-002',
            distributor_id: 'dist-002',
          },
          error: null,
        }) // handover read
        // calculateDistributorCommission sub-calls (via db.from):
        .mockResolvedValueOnce({ data: { loan_amount_usd: 2000 }, error: null }) // loan
        .mockResolvedValueOnce({ data: { retail_price_usd: 800, model: 'Samsung A25' }, error: null }) // device
        .mockResolvedValueOnce({ data: null, error: null }) // distributor not found (null)
        // withTransaction handles mutations
        .mockResolvedValue({ data: null, error: null });

      const result = await service.completeHandover('handover-002');

      expect(result.commission.amount).toBe(100); // 2000 * 5% default
      expect(result.commission.percentage).toBe(5);
    });

    it('should mark handover as failed on transaction error', async () => {
      const { withTransaction: mockTx } = require('../../../services/shared/clients/database');

      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'handover-003',
            identity_verified: true,
            deposit_verified: true,
            device_condition_verified: true,
            loan_id: 'loan-003',
            device_id: 'dev-003',
            customer_id: 'cust-003',
            distributor_id: 'dist-003',
          },
          error: null,
        }) // handover read
        // calculateDistributorCommission sub-calls:
        .mockResolvedValueOnce({ data: { loan_amount_usd: 1000 }, error: null })
        .mockResolvedValueOnce({ data: { retail_price_usd: 500, model: 'Samsung A15' }, error: null })
        .mockResolvedValueOnce({ data: { commission_rate: 5 }, error: null })
        .mockResolvedValue({ data: null, error: null }); // mark as failed via db.from

      // Make withTransaction reject to simulate DB failure
      mockTx.mockRejectedValueOnce(new Error('DB write error'));

      await expect(service.completeHandover('handover-003')).rejects.toThrow('DB write error');
      expect(db.from).toHaveBeenCalledWith('device_handovers');
    });
  });

  // ─── getHandoverStatus ─────────────────────────────────────
  describe('getHandoverStatus', () => {
    it('should throw when handover is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.getHandoverStatus('handover-missing')).rejects.toThrow('Handover not found');
    });

    it('should return handover record', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: {
          id: 'handover-001',
          status: 'initiated',
          identity_verified: false,
          deposit_verified: false,
          device_condition_verified: false,
        },
        error: null,
      });

      const result = await service.getHandoverStatus('handover-001');

      expect(result.id).toBe('handover-001');
      expect(result.status).toBe('initiated');
    });
  });

  // ─── generateHandoverConfirmation ──────────────────────────
  describe('generateHandoverConfirmation', () => {
    it('should include customer and device details', () => {
      const msg = service.generateHandoverConfirmation(
        'John Doe',
        'Samsung A15',
        500,
        50,
        new Date('2024-03-15')
      );

      expect(msg).toContain('Samsung A15');
      expect(msg).toContain('$500.00');
      expect(msg).toContain('$50.00');
      expect(msg).toContain('Device Handover Complete');
    });

    it('should include first payment date', () => {
      const msg = service.generateHandoverConfirmation(
        'Jane Smith',
        'Nokia G60',
        300,
        30,
        new Date('2024-04-01')
      );

      expect(msg).toContain('April');
      expect(msg).toContain('2024');
    });

    it('should include payment reminder info', () => {
      const msg = service.generateHandoverConfirmation(
        'Test User',
        'Tecno Spark',
        200,
        25,
        new Date('2024-05-01')
      );

      expect(msg).toContain('payment reminders');
    });

    it('should include help contact info', () => {
      const msg = service.generateHandoverConfirmation(
        'Test',
        'Device',
        100,
        10,
        new Date('2024-01-01')
      );

      expect(msg).toContain('HELP');
      expect(msg).toContain('+263');
    });
  });
});
