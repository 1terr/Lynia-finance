/**
 * Characterization tests for services/payment-service/src/penalty-service.ts
 *
 * Penalty configuration, calculation, application, and waiver logic.
 * Ensures caps, grace periods, recurrence, and validation all behave correctly.
 */

const mockExecute = jest.fn();

jest.mock('../../../services/shared/clients/database', () => {
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'order', 'limit', 'single', 'maybeSingle'];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: { from: jest.fn().mockImplementation(() => createChain()) },
    query: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
});

import {
  createPenaltyConfiguration,
  calculatePenalties,
  applyPenalties,
  waivePenalty,
  getLoanPenalties,
  getLoanPenaltySummary,
  PenaltyError,
} from '../../../services/payment-service/src/penalty-service';
import { db, query } from '../../../services/shared/clients/database';

const mockedQuery = query as jest.Mock;
const mockedDbFrom = db.from as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────

function basePenaltyConfig(overrides: Record<string, unknown> = {}) {
  return {
    product_id: null,
    penalty_type: 'late_fee',
    name: 'Late Fee',
    description: 'Standard late fee',
    calculation_method: 'flat',
    flat_amount_usd: 10,
    grace_period_days: 0,
    min_days_past_due: 1,
    recurrence: 'once',
    is_active: true,
    effective_from: '2024-01-01',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('PenaltyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockReset();
    mockedQuery.mockReset();
    mockedQuery.mockResolvedValue({ data: [], error: null });
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. createPenaltyConfiguration — validation
  // ═══════════════════════════════════════════════════════════════
  describe('createPenaltyConfiguration', () => {
    it('should throw PENALTY_VAL_001 for invalid penalty_type', async () => {
      const config = basePenaltyConfig({ penalty_type: 'invalid_type' });

      try {
        await createPenaltyConfiguration(config as any, 'admin-1');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_VAL_001');
        expect(error.message).toContain('Invalid penalty type');
      }
    });

    it('should throw PENALTY_VAL_002 for invalid calculation_method', async () => {
      const config = basePenaltyConfig({ calculation_method: 'logarithmic' });

      try {
        await createPenaltyConfiguration(config as any, 'admin-1');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_VAL_002');
        expect(error.message).toContain('Invalid calculation method');
      }
    });

    it('should throw PENALTY_VAL_003 for flat method without flat_amount_usd', async () => {
      const config = basePenaltyConfig({ calculation_method: 'flat', flat_amount_usd: undefined });

      try {
        await createPenaltyConfiguration(config as any, 'admin-1');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_VAL_003');
      }
    });

    it('should throw PENALTY_VAL_004 for percentage method without percentage_rate', async () => {
      const config = basePenaltyConfig({
        calculation_method: 'percentage',
        flat_amount_usd: undefined,
        percentage_rate: undefined,
      });

      try {
        await createPenaltyConfiguration(config as any, 'admin-1');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_VAL_004');
      }
    });

    it('should throw PENALTY_VAL_005 for tiered method without tiered_config', async () => {
      const config = basePenaltyConfig({
        calculation_method: 'tiered',
        flat_amount_usd: undefined,
        tiered_config: undefined,
      });

      try {
        await createPenaltyConfiguration(config as any, 'admin-1');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_VAL_005');
      }
    });

    it('should throw PENALTY_VAL_006 for negative grace_period_days', async () => {
      const config = basePenaltyConfig({ grace_period_days: -1 });

      try {
        await createPenaltyConfiguration(config as any, 'admin-1');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_VAL_006');
      }
    });

    it('should accept valid late_fee config and return the inserted record', async () => {
      const insertedRecord = { id: 'pc-001', ...basePenaltyConfig() };
      // First execute: insert + single → returns inserted record
      mockExecute.mockResolvedValueOnce({ data: insertedRecord, error: null });
      // Second execute: audit log insert
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const result = await createPenaltyConfiguration(basePenaltyConfig() as any, 'admin-1');

      expect(result).toEqual(insertedRecord);
      expect(mockedDbFrom).toHaveBeenCalledWith('penalty_configurations');
    });

    it('should throw PENALTY_CONFIG_001 when db insert fails', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

      try {
        await createPenaltyConfiguration(basePenaltyConfig() as any, 'admin-1');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_CONFIG_001');
      }
    });

    it('should accept valid percentage config', async () => {
      const config = basePenaltyConfig({
        calculation_method: 'percentage',
        flat_amount_usd: undefined,
        percentage_rate: 0.05,
      });
      const insertedRecord = { id: 'pc-002', ...config };
      mockExecute.mockResolvedValueOnce({ data: insertedRecord, error: null });
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const result = await createPenaltyConfiguration(config as any, 'admin-1');

      expect(result.id).toBe('pc-002');
    });

    it('should accept valid tiered config', async () => {
      const config = basePenaltyConfig({
        calculation_method: 'tiered',
        flat_amount_usd: undefined,
        tiered_config: [{ min_days: 1, max_days: 30, flat_amount: 5 }],
      });
      const insertedRecord = { id: 'pc-003', ...config };
      mockExecute.mockResolvedValueOnce({ data: insertedRecord, error: null });
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const result = await createPenaltyConfiguration(config as any, 'admin-1');

      expect(result.id).toBe('pc-003');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. calculatePenalties
  // ═══════════════════════════════════════════════════════════════
  describe('calculatePenalties', () => {
    it('should return empty array when loan not past due (days_past_due = 0)', async () => {
      // db.from('loans').select().eq().single().execute()
      mockExecute.mockResolvedValueOnce({
        data: { id: 'loan-1', days_past_due: 0, outstanding_balance_usd: 500, product_id: 'prod-1' },
        error: null,
      });

      const result = await calculatePenalties('loan-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when penalty_accrual_suspended is true', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          penalty_accrual_suspended: true,
          outstanding_balance_usd: 500,
          product_id: 'prod-1',
        },
        error: null,
      });

      const result = await calculatePenalties('loan-1');

      expect(result).toEqual([]);
    });

    it('should throw PENALTY_LOAN_001 when loan not found', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await expect(calculatePenalties('nonexistent')).rejects.toThrow('Loan not found');
    });

    it('should calculate flat penalty correctly', async () => {
      // Loan lookup
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 500,
          product_id: 'prod-1',
          total_penalties_usd: 0,
        },
        error: null,
      });

      // getActivePenaltyConfigurations returns a flat config via query()
      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-flat',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 15,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Flat Late Fee',
        }],
        error: null,
      });

      // getApplicationCount: db.from('loan_penalties')...execute()
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      // checkRecurrenceEligibility (recurrence='once'): calls getApplicationCount
      // which calls db.from('loan_penalties')...execute()
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await calculatePenalties('loan-1');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(15);
      expect(result[0].penalty_type).toBe('late_fee');
      expect(result[0].calculation_method).toBe('flat');
      expect(result[0].capped).toBe(false);
    });

    it('should calculate percentage penalty correctly', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 15,
          outstanding_balance_usd: 1000,
          product_id: 'prod-1',
          total_penalties_usd: 0,
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-pct',
          penalty_type: 'penalty_interest',
          calculation_method: 'percentage',
          percentage_rate: 0.05,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Pct Penalty',
        }],
        error: null,
      });

      // getApplicationCount
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      // checkRecurrenceEligibility (once) -> getApplicationCount
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await calculatePenalties('loan-1');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(50); // 1000 * 0.05
      expect(result[0].calculation_method).toBe('percentage');
    });

    it('should calculate tiered penalty correctly based on DPD tier', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 20,
          outstanding_balance_usd: 800,
          product_id: 'prod-1',
          total_penalties_usd: 0,
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-tier',
          penalty_type: 'collection_fee',
          calculation_method: 'tiered',
          tiered_config: [
            { min_days: 1, max_days: 10, flat_amount: 5 },
            { min_days: 11, max_days: 30, flat_amount: 20 },
            { min_days: 31, max_days: null, flat_amount: 50 },
          ],
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Tiered Collection Fee',
        }],
        error: null,
      });

      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await calculatePenalties('loan-1');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(20); // DPD 20 falls in 11-30 tier
    });

    it('should skip penalty when DPD is within grace period', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 3,
          outstanding_balance_usd: 500,
          product_id: 'prod-1',
          total_penalties_usd: 0,
        },
        error: null,
      });

      // Config with grace period 5 days and min_days_past_due 1
      // Required DPD to trigger: min_days_past_due + grace_period_days = 6
      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-grace',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 10,
          grace_period_days: 5,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Late Fee with Grace',
        }],
        error: null,
      });

      const result = await calculatePenalties('loan-1');

      expect(result).toEqual([]);
    });

    it('should skip penalty when DPD exceeds max_days_past_due', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 100,
          outstanding_balance_usd: 500,
          product_id: 'prod-1',
          total_penalties_usd: 0,
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-range',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 10,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: 60,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Range-limited Fee',
        }],
        error: null,
      });

      const result = await calculatePenalties('loan-1');

      expect(result).toEqual([]);
    });

    it('should skip penalty when max_applications reached', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 500,
          product_id: 'prod-1',
          total_penalties_usd: 0,
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-max',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 10,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'daily',
          max_applications: 3,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Max-applications Fee',
        }],
        error: null,
      });

      // getApplicationCount returns 3 existing applications (at max)
      mockExecute.mockResolvedValueOnce({
        data: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        error: null,
      });

      const result = await calculatePenalties('loan-1');

      expect(result).toEqual([]);
    });

    it('should apply per-application cap (max_penalty_amount_usd)', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 2000,
          product_id: 'prod-1',
          total_penalties_usd: 0,
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-cap',
          penalty_type: 'penalty_interest',
          calculation_method: 'percentage',
          percentage_rate: 0.10, // 10% of 2000 = 200
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: 50, // cap at 50
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Capped Penalty',
        }],
        error: null,
      });

      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await calculatePenalties('loan-1');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(50);
      expect(result[0].capped).toBe(true);
      expect(result[0].cap_reason).toBe('Per-application cap');
    });

    it('should apply percentage cap on outstanding balance', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 1000,
          product_id: 'prod-1',
          total_penalties_usd: 0,
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-pctcap',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 200,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: 0.05, // 5% of 1000 = 50
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Percentage-capped Fee',
        }],
        error: null,
      });

      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await calculatePenalties('loan-1');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(50);
      expect(result[0].capped).toBe(true);
      expect(result[0].cap_reason).toBe('Percentage cap on outstanding balance');
    });

    it('should apply cumulative cap (max_total_penalties_usd)', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 1000,
          product_id: 'prod-1',
          total_penalties_usd: 90, // Already 90 applied
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-cumcap',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 25,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'daily',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: 100, // Only 10 remaining
          is_active: true,
          name: 'Cumulative-capped Fee',
        }],
        error: null,
      });

      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      // checkRecurrenceEligibility for 'daily': looks for last penalty
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await calculatePenalties('loan-1');

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(10); // 100 - 90 = 10 remaining cap
      expect(result[0].capped).toBe(true);
      expect(result[0].cap_reason).toBe('Cumulative penalty cap');
    });

    it('should skip when cumulative cap is fully exhausted', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 1000,
          product_id: 'prod-1',
          total_penalties_usd: 100,
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-cumfull',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 25,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'daily',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: 100, // 0 remaining
          is_active: true,
          name: 'Exhausted Fee',
        }],
        error: null,
      });

      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await calculatePenalties('loan-1');

      expect(result).toEqual([]);
    });

    it('should return empty when no active configs exist', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 500,
          product_id: 'prod-1',
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({ data: [], error: null });

      const result = await calculatePenalties('loan-1');

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. applyPenalties
  // ═══════════════════════════════════════════════════════════════
  describe('applyPenalties', () => {
    it('should return empty result when no penalties are applicable', async () => {
      // calculatePenalties: loan lookup (DPD = 0)
      mockExecute.mockResolvedValueOnce({
        data: { id: 'loan-1', days_past_due: 0, outstanding_balance_usd: 500, product_id: 'prod-1' },
        error: null,
      });

      const result = await applyPenalties('loan-1', 'admin-1');

      expect(result.penalties_applied).toEqual([]);
      expect(result.total_amount).toBe(0);
      expect(result.skipped_reasons).toContain('No applicable penalties');
    });

    it('should apply penalties and update loan totals', async () => {
      // --- calculatePenalties internal calls ---
      // 1. Loan lookup (for calculatePenalties)
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 1000,
          product_id: 'prod-1',
          total_penalties_usd: 0,
          customer_id: 'cust-1',
        },
        error: null,
      });

      // 2. getActivePenaltyConfigurations (query)
      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-1',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 20,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Standard Late Fee',
        }],
        error: null,
      });

      // 3. getApplicationCount
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      // 4. checkRecurrenceEligibility (once) -> getApplicationCount
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      // --- applyPenalties own calls ---
      // 5. Loan lookup (for applyPenalties, to get customer_id etc.)
      mockExecute.mockResolvedValueOnce({
        data: {
          customer_id: 'cust-1',
          outstanding_balance_usd: 1000,
          total_penalties_usd: 0,
        },
        error: null,
      });

      // 6. Insert penalty record
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'pen-1',
          loan_id: 'loan-1',
          customer_id: 'cust-1',
          penalty_type: 'late_fee',
          amount_usd: 20,
          status: 'applied',
        },
        error: null,
      });

      // 7. Update loan totals
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      // 8. Audit log
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const result = await applyPenalties('loan-1', 'admin-1');

      expect(result.penalties_applied).toHaveLength(1);
      expect(result.total_amount).toBe(20);
      expect(result.skipped_reasons).toEqual([]);
    });

    it('should enforce global 25% cap on outstanding balance', async () => {
      // Loan with existing penalties at 25% of balance
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 400,
          product_id: 'prod-1',
          total_penalties_usd: 100, // Already at 25% of 400
          customer_id: 'cust-1',
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-1',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 10,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'daily',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Blocked by Global Cap',
        }],
        error: null,
      });

      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      // applyPenalties loan lookup
      mockExecute.mockResolvedValueOnce({
        data: {
          customer_id: 'cust-1',
          outstanding_balance_usd: 400,
          total_penalties_usd: 100,
        },
        error: null,
      });

      const result = await applyPenalties('loan-1', 'admin-1');

      // Penalty should be skipped due to 25% global cap
      expect(result.penalties_applied).toEqual([]);
      expect(result.skipped_reasons.length).toBeGreaterThan(0);
      expect(result.skipped_reasons[0]).toContain('25% cap');
    });

    it('should handle penalty insertion failure gracefully', async () => {
      // Loan lookup for calculatePenalties
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          days_past_due: 10,
          outstanding_balance_usd: 1000,
          product_id: 'prod-1',
          total_penalties_usd: 0,
          customer_id: 'cust-1',
        },
        error: null,
      });

      mockedQuery.mockResolvedValueOnce({
        data: [{
          id: 'cfg-1',
          penalty_type: 'late_fee',
          calculation_method: 'flat',
          flat_amount_usd: 10,
          grace_period_days: 0,
          min_days_past_due: 1,
          max_days_past_due: null,
          recurrence: 'once',
          max_applications: null,
          max_penalty_amount_usd: null,
          max_penalty_percentage: null,
          max_total_penalties_usd: null,
          is_active: true,
          name: 'Test Fee',
        }],
        error: null,
      });

      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      // Loan lookup for applyPenalties
      mockExecute.mockResolvedValueOnce({
        data: {
          customer_id: 'cust-1',
          outstanding_balance_usd: 1000,
          total_penalties_usd: 0,
        },
        error: null,
      });

      // Penalty insert fails
      mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

      const result = await applyPenalties('loan-1', 'admin-1');

      expect(result.penalties_applied).toEqual([]);
      expect(result.total_amount).toBe(0);
      expect(result.skipped_reasons).toContain('late_fee: Failed to record penalty');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. waivePenalty
  // ═══════════════════════════════════════════════════════════════
  describe('waivePenalty', () => {
    it('should throw PENALTY_WAIVER_001 when reason is too short', async () => {
      try {
        await waivePenalty('pen-1', 'admin-1', 'abc');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_WAIVER_001');
        expect(error.message).toContain('at least 5 characters');
      }
    });

    it('should throw PENALTY_WAIVER_001 when reason is empty', async () => {
      try {
        await waivePenalty('pen-1', 'admin-1', '');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_WAIVER_001');
      }
    });

    it('should throw PENALTY_WAIVER_002 when penalty not found', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      try {
        await waivePenalty('nonexistent', 'admin-1', 'Customer hardship case');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_WAIVER_002');
      }
    });

    it('should throw PENALTY_WAIVER_003 when penalty status is not applied', async () => {
      mockExecute.mockResolvedValueOnce({
        data: { id: 'pen-1', status: 'paid', loan_id: 'loan-1', amount_usd: 10 },
        error: null,
      });

      try {
        await waivePenalty('pen-1', 'admin-1', 'Customer request for waiver');
        fail('Expected PenaltyError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(PenaltyError);
        expect(error.code).toBe('PENALTY_WAIVER_003');
        expect(error.message).toContain('paid');
      }
    });

    it('should successfully waive an applied penalty', async () => {
      // Fetch penalty
      mockExecute.mockResolvedValueOnce({
        data: { id: 'pen-1', status: 'applied', loan_id: 'loan-1', amount_usd: 15 },
        error: null,
      });

      // Update penalty to waived
      const waivedPenalty = {
        id: 'pen-1',
        status: 'waived',
        loan_id: 'loan-1',
        amount_usd: 15,
        waived_by: 'admin-1',
        waiver_reason: 'Customer hardship case',
      };
      mockExecute.mockResolvedValueOnce({ data: waivedPenalty, error: null });

      // Update loan totals (via db.from)
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      // Raw query for atomic update
      mockedQuery.mockResolvedValueOnce({ data: null, error: null });

      // Audit log
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const result = await waivePenalty('pen-1', 'admin-1', 'Customer hardship case');

      expect(result.status).toBe('waived');
      expect(result.waiver_reason).toBe('Customer hardship case');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. getLoanPenalties
  // ═══════════════════════════════════════════════════════════════
  describe('getLoanPenalties', () => {
    it('should return all penalties for a loan', async () => {
      const penalties = [
        { id: 'pen-1', loan_id: 'loan-1', status: 'applied', amount_usd: 10 },
        { id: 'pen-2', loan_id: 'loan-1', status: 'paid', amount_usd: 5 },
      ];
      mockExecute.mockResolvedValueOnce({ data: penalties, error: null });

      const result = await getLoanPenalties('loan-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('pen-1');
      expect(result[1].id).toBe('pen-2');
    });

    it('should return empty array when no penalties exist', async () => {
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await getLoanPenalties('loan-1');

      expect(result).toEqual([]);
    });

    it('should filter by status when statusFilter is provided', async () => {
      const penalties = [
        { id: 'pen-1', loan_id: 'loan-1', status: 'applied', amount_usd: 10 },
      ];
      mockExecute.mockResolvedValueOnce({ data: penalties, error: null });

      const result = await getLoanPenalties('loan-1', 'applied');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('applied');
    });

    it('should throw PENALTY_FETCH_001 when query fails', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'query error' } });

      await expect(getLoanPenalties('loan-1')).rejects.toThrow('Failed to fetch loan penalties');
    });

    it('should return empty array when data is null', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      // data is null but no error, so it returns [] via (data || [])
      const result = await getLoanPenalties('loan-1');

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. getLoanPenaltySummary
  // ═══════════════════════════════════════════════════════════════
  describe('getLoanPenaltySummary', () => {
    it('should return correct aggregated summary', async () => {
      mockedQuery.mockResolvedValueOnce({
        data: [{
          total_penalties: '150.00',
          total_paid: '50.00',
          total_waived: '25.00',
          total_outstanding: '75.00',
          penalty_count: '5',
        }],
        error: null,
      });

      const result = await getLoanPenaltySummary('loan-1');

      expect(result.total_penalties).toBe(150);
      expect(result.total_paid).toBe(50);
      expect(result.total_waived).toBe(25);
      expect(result.total_outstanding).toBe(75);
      expect(result.penalty_count).toBe(5);
    });

    it('should return zeros when no penalties exist', async () => {
      mockedQuery.mockResolvedValueOnce({
        data: [{
          total_penalties: '0',
          total_paid: '0',
          total_waived: '0',
          total_outstanding: '0',
          penalty_count: '0',
        }],
        error: null,
      });

      const result = await getLoanPenaltySummary('loan-1');

      expect(result.total_penalties).toBe(0);
      expect(result.total_paid).toBe(0);
      expect(result.total_waived).toBe(0);
      expect(result.total_outstanding).toBe(0);
      expect(result.penalty_count).toBe(0);
    });

    it('should handle null/undefined row values gracefully', async () => {
      mockedQuery.mockResolvedValueOnce({
        data: [{}],
        error: null,
      });

      const result = await getLoanPenaltySummary('loan-1');

      expect(result.total_penalties).toBe(0);
      expect(result.total_paid).toBe(0);
      expect(result.total_waived).toBe(0);
      expect(result.total_outstanding).toBe(0);
      expect(result.penalty_count).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PenaltyError class
  // ═══════════════════════════════════════════════════════════════
  describe('PenaltyError', () => {
    it('should have correct name, message, and code', () => {
      const error = new PenaltyError('Test error message', 'TEST_001');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PenaltyError);
      expect(error.name).toBe('PenaltyError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_001');
    });
  });
});
