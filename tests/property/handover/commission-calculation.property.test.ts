/**
 * Property-based tests for distributor commission calculation.
 * Tests: calculateDistributorCommission from services/lock-service/src/handover/commission-calculator.ts
 */

import fc from 'fast-check';
import { arbLoanAmount, arbCommissionRate } from '../../helpers/fast-check-arbitraries';

// Mock the database module before importing
const mockExecute = jest.fn();
const mockSingle = jest.fn(() => ({ execute: mockExecute }));
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('../../../services/shared/clients/database', () => ({
  db: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { calculateDistributorCommission } from '../../../services/lock-service/src/handover/commission-calculator';

describe('Commission Calculation - property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupMocks(principal: number, retailPrice: number, model: string, commissionRate: number | null) {
    // Call 1: db.from('loans').select('principal').eq('id', loanId).single().execute()
    // Call 2: db.from('devices').select(...).eq(...).single().execute()
    // Call 3: db.from('distributors').select(...).eq(...).single().execute()

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      const chainSelect = jest.fn(() => {
        const chainEq = jest.fn(() => {
          const chainSingle = jest.fn(() => ({
            execute: jest.fn().mockResolvedValue((() => {
              callCount++;
              if (table === 'loans') return { data: { principal }, error: null };
              if (table === 'devices') return { data: { retail_price: retailPrice, model }, error: null };
              if (table === 'distributors') {
                return commissionRate !== null
                  ? { data: { commission_rate: commissionRate }, error: null }
                  : { data: null, error: null };
              }
              return { data: null, error: null };
            })())
          }));
          return { single: chainSingle };
        });
        return { eq: chainEq };
      });
      return { select: chainSelect };
    });
  }

  it('commission equals principal * (rate / 100) for any valid principal and rate', () => {
    return fc.assert(
      fc.asyncProperty(arbLoanAmount(), arbCommissionRate(), async (principal, rate) => {
        setupMocks(principal, 200, 'Galaxy A14', rate);
        const result = await calculateDistributorCommission('loan-1', 'dev-1', 'dist-1');

        const expected = Math.round(principal * rate) / 100;
        expect(result.amount).toBe(expected);
        expect(result.percentage).toBe(rate);
        expect(result.loan_amount).toBe(principal);
      }),
      { numRuns: 200 }
    );
  });

  it('defaults to 5% when distributor has no commission_rate', () => {
    return fc.assert(
      fc.asyncProperty(arbLoanAmount(), async (principal) => {
        setupMocks(principal, 200, 'Galaxy A14', null);
        const result = await calculateDistributorCommission('loan-1', 'dev-1', 'dist-1');

        expect(result.amount).toBe(Math.round(principal * 5) / 100);
        expect(result.percentage).toBe(5);
      }),
      { numRuns: 200 }
    );
  });

  it('commission is always non-negative', () => {
    return fc.assert(
      fc.asyncProperty(arbLoanAmount(), arbCommissionRate(), async (principal, rate) => {
        setupMocks(principal, 200, 'Galaxy A14', rate);
        const result = await calculateDistributorCommission('loan-1', 'dev-1', 'dist-1');
        expect(result.amount).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 }
    );
  });

  it('result.percentage * result.loan_amount / 100 equals result.amount', () => {
    return fc.assert(
      fc.asyncProperty(arbLoanAmount(), arbCommissionRate(), async (principal, rate) => {
        setupMocks(principal, 200, 'Galaxy A14', rate);
        const result = await calculateDistributorCommission('loan-1', 'dev-1', 'dist-1');
        const recomputed = Math.round(result.percentage * result.loan_amount) / 100;
        expect(result.amount).toBe(recomputed);
      }),
      { numRuns: 200 }
    );
  });

  it('returns device price and model in result', () => {
    return fc.assert(
      fc.asyncProperty(
        arbLoanAmount(),
        fc.integer({ min: 50, max: 2000 }),
        fc.string({ minLength: 3, maxLength: 30 }),
        async (principal, devicePrice, deviceModel) => {
          setupMocks(principal, devicePrice, deviceModel, 5);
          const result = await calculateDistributorCommission('loan-1', 'dev-1', 'dist-1');
          expect(result.device_price).toBe(devicePrice);
          expect(result.device_model).toBe(deviceModel);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('throws when loan is not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            execute: jest.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      }))
    }));

    await expect(calculateDistributorCommission('bad-loan', 'dev-1', 'dist-1'))
      .rejects.toThrow('Loan not found');
  });

  it('throws when device is not found', async () => {
    let callNum = 0;
    mockFrom.mockImplementation(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            execute: jest.fn().mockResolvedValue(() => {
              callNum++;
              if (callNum === 1) return { data: { principal: 500 }, error: null };
              return { data: null, error: null };
            })
          }))
        }))
      }))
    }));

    // Set up: loan found, device not found
    let call = 0;
    mockFrom.mockImplementation((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            execute: jest.fn().mockResolvedValue(
              table === 'loans'
                ? { data: { principal: 500 }, error: null }
                : { data: null, error: null }
            )
          }))
        }))
      }))
    }));

    await expect(calculateDistributorCommission('loan-1', 'bad-dev', 'dist-1'))
      .rejects.toThrow('Device not found');
  });
});
