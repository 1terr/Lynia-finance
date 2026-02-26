/**
 * Characterization tests for services/payment-service/src/reschedule-service.ts
 *
 * Loan rescheduling workflow — term extensions, rate reductions, payment holidays,
 * balance restructuring, multi-step approval, activation, and customer acknowledgement.
 * A bug here = incorrect loan terms or unapproved modifications.
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
  requestReschedule,
  approveReschedule,
  activateReschedule,
  rejectReschedule,
  cancelReschedule,
  acknowledgeReschedule,
  RescheduleError,
} from '../../../services/payment-service/src/reschedule-service';
import { db, query } from '../../../services/shared/clients/database';

// ===================================================================
// HELPERS
// ===================================================================

const mockFrom = db.from as jest.Mock;
const mockQuery = query as jest.Mock;

function setupExecuteSequence(results: Array<{ data: unknown; error?: unknown }>) {
  results.forEach((r) => {
    mockExecute.mockResolvedValueOnce({ data: r.data, error: r.error ?? null });
  });
}

function makeLoan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loan-001',
    customer_id: 'cust-001',
    status: 'active',
    loan_term_months: 6,
    interest_rate: 12,
    next_payment_amount_usd: 200,
    monthly_installment_usd: 200,
    outstanding_balance_usd: 1000,
    maturity_date: '2025-06-01',
    disbursed_at: '2024-12-01T00:00:00Z',
    reschedule_count: 0,
    ...overrides,
  };
}

function makeReschedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rs-001',
    loan_id: 'loan-001',
    customer_id: 'cust-001',
    reschedule_type: 'term_extension',
    reason: 'hardship',
    original_term_months: 6,
    original_interest_rate: 12,
    original_monthly_amount: 200,
    original_outstanding: 1000,
    new_term_months: 9,
    new_interest_rate: 12,
    new_monthly_amount: 150,
    new_outstanding: 1000,
    customer_acknowledgement: false,
    status: 'pending',
    requested_by: 'staff-001',
    requested_at: '2024-01-01T00:00:00Z',
    reschedule_count: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===================================================================
// requestReschedule
// ===================================================================

describe('requestReschedule', () => {
  const baseTermExtension = {
    loan_id: 'loan-001',
    reschedule_type: 'term_extension' as const,
    reason: 'hardship' as const,
    new_term_months: 9,
  };

  const baseRateReduction = {
    loan_id: 'loan-001',
    reschedule_type: 'rate_reduction' as const,
    reason: 'medical' as const,
    new_interest_rate: 8,
  };

  const basePaymentHoliday = {
    loan_id: 'loan-001',
    reschedule_type: 'payment_holiday' as const,
    reason: 'job_loss' as const,
    holiday_months: 2,
    holiday_start_date: '2025-02-01',
  };

  function setupSuccessSequence(loan = makeLoan()) {
    setupExecuteSequence([
      { data: loan },                         // fetch loan
      { data: { value: '3' } },               // max reschedules config
      { data: [] },                           // check pending reschedules
      { data: makeReschedule() },             // insert reschedule
      { data: null },                         // audit log
    ]);
  }

  it('should create a term_extension reschedule with status pending', async () => {
    const created = makeReschedule({ reschedule_type: 'term_extension', new_term_months: 9 });
    setupExecuteSequence([
      { data: makeLoan() },
      { data: { value: '3' } },
      { data: [] },
      { data: created },
      { data: null },
    ]);

    const result = await requestReschedule(baseTermExtension, 'staff-001');

    expect(result.status).toBe('pending');
    expect(result.reschedule_type).toBe('term_extension');
    expect(result.new_term_months).toBe(9);
    expect(mockFrom).toHaveBeenCalledWith('loans');
    expect(mockFrom).toHaveBeenCalledWith('loan_reschedules');
  });

  it('should create a rate_reduction reschedule successfully', async () => {
    const created = makeReschedule({ reschedule_type: 'rate_reduction', new_interest_rate: 8 });
    setupExecuteSequence([
      { data: makeLoan() },
      { data: { value: '3' } },
      { data: [] },
      { data: created },
      { data: null },
    ]);

    const result = await requestReschedule(baseRateReduction, 'staff-001');

    expect(result.reschedule_type).toBe('rate_reduction');
    expect(result.new_interest_rate).toBe(8);
  });

  it('should create a payment_holiday reschedule successfully', async () => {
    const created = makeReschedule({ reschedule_type: 'payment_holiday', holiday_months: 2 });
    setupExecuteSequence([
      { data: makeLoan() },
      { data: { value: '3' } },
      { data: [] },
      { data: created },
      { data: null },
    ]);

    const result = await requestReschedule(basePaymentHoliday, 'staff-001');

    expect(result.reschedule_type).toBe('payment_holiday');
  });

  it('should throw RESCHED_TYPE_001 for invalid reschedule type', async () => {
    const invalidRequest = {
      loan_id: 'loan-001',
      reschedule_type: 'invalid_type' as any,
      reason: 'hardship' as const,
    };

    await expect(requestReschedule(invalidRequest, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_TYPE_001' });
  });

  it('should throw RESCHED_REASON_001 for invalid reason', async () => {
    const invalidRequest = {
      loan_id: 'loan-001',
      reschedule_type: 'term_extension' as const,
      reason: 'invalid_reason' as any,
    };

    await expect(requestReschedule(invalidRequest, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_REASON_001' });
  });

  it('should throw RESCHED_STATUS_001 when loan status is not active or disbursed', async () => {
    setupExecuteSequence([
      { data: makeLoan({ status: 'closed' }) },
    ]);

    await expect(requestReschedule(baseTermExtension, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_STATUS_001' });
  });

  it('should throw RESCHED_LIMIT_001 when max reschedule limit reached', async () => {
    setupExecuteSequence([
      { data: makeLoan({ reschedule_count: 3 }) },
      { data: { value: '3' } },
    ]);

    await expect(requestReschedule(baseTermExtension, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_LIMIT_001' });
  });

  it('should throw RESCHED_DUP_001 when there is already a pending reschedule', async () => {
    setupExecuteSequence([
      { data: makeLoan() },
      { data: { value: '3' } },
      { data: [{ id: 'rs-existing' }] },
    ]);

    await expect(requestReschedule(baseTermExtension, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_DUP_001' });
  });

  it('should throw RESCHED_TERM_001 when term extension exceeds 6 additional months', async () => {
    const oversizedExtension = {
      ...baseTermExtension,
      new_term_months: 20,  // original is 6, so 14 additional months > 6
    };

    setupExecuteSequence([
      { data: makeLoan() },
      { data: { value: '3' } },
      { data: [] },
    ]);

    await expect(requestReschedule(oversizedExtension, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_TERM_001' });
  });

  it('should throw RESCHED_TERM_001 when new term is not greater than original', async () => {
    const noExtension = {
      ...baseTermExtension,
      new_term_months: 5,  // less than original 6
    };

    setupExecuteSequence([
      { data: makeLoan() },
      { data: { value: '3' } },
      { data: [] },
    ]);

    await expect(requestReschedule(noExtension, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_TERM_001' });
  });

  it('should throw RESCHED_RATE_001 when new rate is not lower than current rate', async () => {
    const higherRate = {
      ...baseRateReduction,
      new_interest_rate: 15,  // higher than original 12
    };

    setupExecuteSequence([
      { data: makeLoan() },
      { data: { value: '3' } },
      { data: [] },
    ]);

    await expect(requestReschedule(higherRate, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_RATE_001' });
  });

  it('should throw RESCHED_HOLIDAY_001 when holiday months exceeds 3', async () => {
    const tooLongHoliday = {
      ...basePaymentHoliday,
      holiday_months: 5,
    };

    setupExecuteSequence([
      { data: makeLoan() },
      { data: { value: '3' } },
      { data: [] },
    ]);

    await expect(requestReschedule(tooLongHoliday, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_HOLIDAY_001' });
  });

  it('should throw RESCHED_LOAN_001 when loan not found', async () => {
    setupExecuteSequence([
      { data: null },
    ]);

    await expect(requestReschedule(baseTermExtension, 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_LOAN_001' });
  });

  it('should accept disbursed loans for rescheduling', async () => {
    const created = makeReschedule();
    setupExecuteSequence([
      { data: makeLoan({ status: 'disbursed' }) },
      { data: { value: '3' } },
      { data: [] },
      { data: created },
      { data: null },
    ]);

    const result = await requestReschedule(baseTermExtension, 'staff-001');
    expect(result).toBeDefined();
    expect(result.status).toBe('pending');
  });
});

// ===================================================================
// approveReschedule
// ===================================================================

describe('approveReschedule', () => {
  it('should update status to approved with approver details', async () => {
    const pending = makeReschedule({ status: 'pending' });
    const approved = makeReschedule({
      status: 'approved',
      approved_by: 'manager-001',
      approved_at: '2024-01-02T00:00:00Z',
    });

    setupExecuteSequence([
      { data: pending },
      { data: approved },
      { data: null },           // audit log
    ]);

    const result = await approveReschedule('rs-001', 'manager-001');

    expect(result.status).toBe('approved');
    expect(result.approved_by).toBe('manager-001');
  });

  it('should throw RESCHED_APPROVE_002 when status is not pending', async () => {
    setupExecuteSequence([
      { data: makeReschedule({ status: 'active' }) },
    ]);

    await expect(approveReschedule('rs-001', 'manager-001'))
      .rejects.toMatchObject({ code: 'RESCHED_APPROVE_002' });
  });

  it('should throw RESCHED_APPROVE_001 when reschedule not found', async () => {
    setupExecuteSequence([
      { data: null },
    ]);

    await expect(approveReschedule('nonexistent', 'manager-001'))
      .rejects.toMatchObject({ code: 'RESCHED_APPROVE_001' });
  });
});

// ===================================================================
// activateReschedule
// ===================================================================

describe('activateReschedule', () => {
  it('should apply new terms to loan and set status to active', async () => {
    const approved = makeReschedule({
      status: 'approved',
      new_term_months: 9,
      new_interest_rate: 12,
      new_monthly_amount: 150,
      new_outstanding: 1000,
      new_maturity_date: '2025-09-01',
      loan_id: 'loan-001',
    });
    const activated = makeReschedule({
      status: 'active',
      activated_at: '2024-01-03T00:00:00Z',
    });

    setupExecuteSequence([
      { data: approved },       // fetch reschedule
      { data: activated },      // update reschedule status
      { data: null },           // audit log
    ]);
    mockQuery.mockResolvedValueOnce({ data: [], error: null }); // loan update

    const result = await activateReschedule('rs-001', 'manager-001');

    expect(result.status).toBe('active');
    expect(mockQuery).toHaveBeenCalled();

    // Verify the loan update SQL includes the new terms
    const queryCall = mockQuery.mock.calls[0];
    expect(queryCall[0]).toContain('UPDATE loans SET');
    expect(queryCall[1]).toEqual(
      expect.arrayContaining([9, 12, 150, 1000, '2025-09-01', 'loan-001'])
    );
  });

  it('should throw RESCHED_ACTIVATE_002 when status is not approved', async () => {
    setupExecuteSequence([
      { data: makeReschedule({ status: 'pending' }) },
    ]);

    await expect(activateReschedule('rs-001', 'manager-001'))
      .rejects.toMatchObject({ code: 'RESCHED_ACTIVATE_002' });
  });

  it('should throw RESCHED_ACTIVATE_001 when reschedule not found', async () => {
    setupExecuteSequence([
      { data: null },
    ]);

    await expect(activateReschedule('nonexistent', 'manager-001'))
      .rejects.toMatchObject({ code: 'RESCHED_ACTIVATE_001' });
  });
});

// ===================================================================
// rejectReschedule
// ===================================================================

describe('rejectReschedule', () => {
  it('should set status to rejected with rejection reason', async () => {
    const pending = makeReschedule({ status: 'pending' });
    const rejected = makeReschedule({
      status: 'rejected',
      rejection_reason: 'Customer does not meet hardship criteria',
    });

    setupExecuteSequence([
      { data: pending },
      { data: rejected },
      { data: null },
    ]);

    const result = await rejectReschedule('rs-001', 'manager-001', 'Customer does not meet hardship criteria');

    expect(result.status).toBe('rejected');
    expect(result.rejection_reason).toBe('Customer does not meet hardship criteria');
  });

  it('should throw RESCHED_REJECT_001 when reason is less than 5 characters', async () => {
    await expect(rejectReschedule('rs-001', 'manager-001', 'No'))
      .rejects.toMatchObject({ code: 'RESCHED_REJECT_001' });
  });

  it('should throw RESCHED_REJECT_001 when reason is empty', async () => {
    await expect(rejectReschedule('rs-001', 'manager-001', ''))
      .rejects.toMatchObject({ code: 'RESCHED_REJECT_001' });
  });

  it('should throw RESCHED_REJECT_003 when status is not pending', async () => {
    setupExecuteSequence([
      { data: makeReschedule({ status: 'approved' }) },
    ]);

    await expect(rejectReschedule('rs-001', 'manager-001', 'Valid reason here'))
      .rejects.toMatchObject({ code: 'RESCHED_REJECT_003' });
  });
});

// ===================================================================
// cancelReschedule
// ===================================================================

describe('cancelReschedule', () => {
  it('should set status to cancelled for a pending reschedule', async () => {
    const pending = makeReschedule({ status: 'pending' });
    const cancelled = makeReschedule({ status: 'cancelled' });

    setupExecuteSequence([
      { data: pending },
      { data: cancelled },
      { data: null },
    ]);

    const result = await cancelReschedule('rs-001', 'staff-001');

    expect(result.status).toBe('cancelled');
  });

  it('should throw RESCHED_CANCEL_002 when status is not pending', async () => {
    setupExecuteSequence([
      { data: makeReschedule({ status: 'active' }) },
    ]);

    await expect(cancelReschedule('rs-001', 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_CANCEL_002' });
  });

  it('should throw RESCHED_CANCEL_001 when reschedule not found', async () => {
    setupExecuteSequence([
      { data: null },
    ]);

    await expect(cancelReschedule('nonexistent', 'staff-001'))
      .rejects.toMatchObject({ code: 'RESCHED_CANCEL_001' });
  });
});

// ===================================================================
// acknowledgeReschedule
// ===================================================================

describe('acknowledgeReschedule', () => {
  it('should set customer_acknowledgement to true', async () => {
    const acknowledged = makeReschedule({ customer_acknowledgement: true });

    setupExecuteSequence([
      { data: acknowledged },
    ]);

    const result = await acknowledgeReschedule('rs-001');

    expect(result.customer_acknowledgement).toBe(true);
  });

  it('should throw RESCHED_ACK_001 when update fails', async () => {
    setupExecuteSequence([
      { data: null, error: { message: 'not found' } },
    ]);

    await expect(acknowledgeReschedule('nonexistent'))
      .rejects.toMatchObject({ code: 'RESCHED_ACK_001' });
  });
});

// ===================================================================
// RescheduleError class
// ===================================================================

describe('RescheduleError', () => {
  it('should be an instance of Error with correct name and code', () => {
    const err = new RescheduleError('test message', 'TEST_CODE_001');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RescheduleError');
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE_001');
  });
});
