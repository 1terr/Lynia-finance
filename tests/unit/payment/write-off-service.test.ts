/**
 * Characterization tests for services/payment-service/src/write-off-service.ts
 *
 * Loan write-off workflow — full/partial write-offs, approval chain,
 * reversal, eligibility checks, and post-write-off recovery tracking.
 * A bug here = incorrect accounting entries or lost recovery funds.
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
  requestWriteOff,
  approveWriteOff,
  rejectWriteOff,
  reverseWriteOff,
  checkWriteOffEligibility,
  recordRecovery,
  WriteOffError,
} from '../../../services/payment-service/src/write-off-service';
import { db, query } from '../../../services/shared/clients/database';

// ===================================================================
// HELPERS
// ===================================================================

const mockFrom = db.from as jest.Mock;
const mockQuery = query as jest.Mock;

/**
 * Configure mockExecute to return different results on successive calls.
 * Each entry in `results` maps to one `.execute()` invocation in order.
 */
function setupExecuteSequence(results: Array<{ data: unknown; error?: unknown }>) {
  results.forEach((r, i) => {
    mockExecute.mockResolvedValueOnce({ data: r.data, error: r.error ?? null });
  });
}

function makeLoan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loan-001',
    customer_id: 'cust-001',
    status: 'defaulted',
    outstanding_balance_usd: 1000,
    days_past_due: 200,
    ...overrides,
  };
}

function makeWriteOff(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wo-001',
    loan_id: 'loan-001',
    customer_id: 'cust-001',
    write_off_type: 'full',
    write_off_reason: 'default_180',
    principal_written_off: 800,
    interest_written_off: 100,
    penalties_written_off: 100,
    total_written_off: 1000,
    outstanding_before: 1000,
    outstanding_after: 0,
    recovery_expected: false,
    recovered_amount_usd: 0,
    status: 'pending',
    requested_by: 'staff-001',
    requested_at: '2024-01-01T00:00:00Z',
    credit_bureau_reported: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===================================================================
// requestWriteOff
// ===================================================================

describe('requestWriteOff', () => {
  const baseRequest = {
    loan_id: 'loan-001',
    write_off_type: 'full' as const,
    write_off_reason: 'default_180' as const,
    principal_written_off: 800,
    interest_written_off: 100,
    penalties_written_off: 100,
  };

  it('should create a full write-off with status pending and correct total', async () => {
    const loan = makeLoan();
    const createdWo = makeWriteOff({ status: 'pending' });

    setupExecuteSequence([
      { data: loan },           // fetch loan
      { data: [] },             // check existing write-offs
      { data: createdWo },      // insert write-off
      { data: null },           // audit log
    ]);

    const result = await requestWriteOff(baseRequest, 'staff-001');

    expect(result.status).toBe('pending');
    expect(result.total_written_off).toBe(1000);
    expect(result.principal_written_off).toBe(800);
    expect(result.interest_written_off).toBe(100);
    expect(result.penalties_written_off).toBe(100);
    expect(mockFrom).toHaveBeenCalledWith('loans');
    expect(mockFrom).toHaveBeenCalledWith('loan_write_offs');
  });

  it('should throw WRITEOFF_LOAN_001 when loan is not found', async () => {
    setupExecuteSequence([
      { data: null },           // loan not found
    ]);

    try {
      await requestWriteOff(baseRequest, 'staff-001');
      fail('Expected WriteOffError');
    } catch (err) {
      expect(err).toBeInstanceOf(WriteOffError);
      expect((err as WriteOffError).code).toBe('WRITEOFF_LOAN_001');
    }
  });

  it('should throw WRITEOFF_STATUS_001 for loan with invalid status', async () => {
    setupExecuteSequence([
      { data: makeLoan({ status: 'closed' }) },
    ]);

    await expect(requestWriteOff(baseRequest, 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_STATUS_001' });
  });

  it('should throw WRITEOFF_DUP_001 for duplicate pending/approved write-off', async () => {
    setupExecuteSequence([
      { data: makeLoan() },
      { data: [{ id: 'wo-existing', status: 'pending' }] },
    ]);

    await expect(requestWriteOff(baseRequest, 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_DUP_001' });
  });

  it('should throw WRITEOFF_AMT_002 when total exceeds outstanding balance', async () => {
    const overLimitRequest = {
      ...baseRequest,
      principal_written_off: 900,
      interest_written_off: 200,
      penalties_written_off: 100,
    };

    setupExecuteSequence([
      { data: makeLoan({ outstanding_balance_usd: 500 }) },
      { data: [] },
    ]);

    await expect(requestWriteOff(overLimitRequest, 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_AMT_002' });
  });

  it('should throw WRITEOFF_AMT_003 for full write-off that does not cover entire balance', async () => {
    const partialAsFullRequest = {
      ...baseRequest,
      write_off_type: 'full' as const,
      principal_written_off: 400,
      interest_written_off: 0,
      penalties_written_off: 0,
    };

    setupExecuteSequence([
      { data: makeLoan({ outstanding_balance_usd: 1000 }) },
      { data: [] },
    ]);

    await expect(requestWriteOff(partialAsFullRequest, 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_AMT_003' });
  });

  it('should throw WRITEOFF_AMT_001 for zero total write-off amount', async () => {
    const zeroRequest = {
      ...baseRequest,
      principal_written_off: 0,
      interest_written_off: 0,
      penalties_written_off: 0,
    };

    setupExecuteSequence([
      { data: makeLoan() },
      { data: [] },
    ]);

    await expect(requestWriteOff(zeroRequest, 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_AMT_001' });
  });

  it('should allow partial write-off less than outstanding balance', async () => {
    const partialRequest = {
      ...baseRequest,
      write_off_type: 'partial' as const,
      principal_written_off: 300,
      interest_written_off: 0,
      penalties_written_off: 0,
    };
    const createdWo = makeWriteOff({
      write_off_type: 'partial',
      principal_written_off: 300,
      total_written_off: 300,
      outstanding_after: 700,
    });

    setupExecuteSequence([
      { data: makeLoan({ outstanding_balance_usd: 1000 }) },
      { data: [] },
      { data: createdWo },
      { data: null },
    ]);

    const result = await requestWriteOff(partialRequest, 'staff-001');
    expect(result.write_off_type).toBe('partial');
    expect(result.total_written_off).toBe(300);
  });

  it('should accept loans with active or disbursed status', async () => {
    const activeLoan = makeLoan({ status: 'active' });
    const createdWo = makeWriteOff();

    setupExecuteSequence([
      { data: activeLoan },
      { data: [] },
      { data: createdWo },
      { data: null },
    ]);

    const result = await requestWriteOff(baseRequest, 'staff-001');
    expect(result).toBeDefined();
  });
});

// ===================================================================
// approveWriteOff
// ===================================================================

describe('approveWriteOff', () => {
  it('should update status to approved with approved_by and approved_at', async () => {
    const pending = makeWriteOff({ status: 'pending', requested_by: 'staff-001' });
    const approved = makeWriteOff({
      status: 'approved',
      approved_by: 'manager-001',
      approved_at: '2024-01-02T00:00:00Z',
    });

    setupExecuteSequence([
      { data: pending },        // fetch write-off
      { data: approved },       // update write-off
      { data: null },           // audit log
    ]);
    mockQuery.mockResolvedValueOnce({ data: [], error: null }); // loan update

    const result = await approveWriteOff('wo-001', 'manager-001');

    expect(result.status).toBe('approved');
    expect(result.approved_by).toBe('manager-001');
    expect(mockFrom).toHaveBeenCalledWith('loan_write_offs');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should throw WRITEOFF_APPROVE_002 when status is not pending', async () => {
    setupExecuteSequence([
      { data: makeWriteOff({ status: 'approved' }) },
    ]);

    await expect(approveWriteOff('wo-001', 'manager-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_APPROVE_002' });
  });

  it('should throw WRITEOFF_APPROVE_003 when approver is same as requester', async () => {
    setupExecuteSequence([
      { data: makeWriteOff({ status: 'pending', requested_by: 'staff-001' }) },
    ]);

    await expect(approveWriteOff('wo-001', 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_APPROVE_003' });
  });

  it('should throw WRITEOFF_APPROVE_001 when write-off not found', async () => {
    setupExecuteSequence([
      { data: null },
    ]);

    await expect(approveWriteOff('nonexistent', 'manager-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_APPROVE_001' });
  });
});

// ===================================================================
// rejectWriteOff
// ===================================================================

describe('rejectWriteOff', () => {
  it('should update status to rejected with rejection_reason', async () => {
    const pending = makeWriteOff({ status: 'pending' });
    const rejected = makeWriteOff({
      status: 'rejected',
      rejection_reason: 'Insufficient documentation provided',
    });

    setupExecuteSequence([
      { data: pending },
      { data: rejected },
      { data: null },
    ]);

    const result = await rejectWriteOff('wo-001', 'manager-001', 'Insufficient documentation provided');

    expect(result.status).toBe('rejected');
    expect(result.rejection_reason).toBe('Insufficient documentation provided');
  });

  it('should throw WRITEOFF_REJECT_001 when reason is less than 5 characters', async () => {
    await expect(rejectWriteOff('wo-001', 'manager-001', 'No'))
      .rejects.toMatchObject({ code: 'WRITEOFF_REJECT_001' });
  });

  it('should throw WRITEOFF_REJECT_001 when reason is empty', async () => {
    await expect(rejectWriteOff('wo-001', 'manager-001', ''))
      .rejects.toMatchObject({ code: 'WRITEOFF_REJECT_001' });
  });

  it('should throw WRITEOFF_REJECT_003 when status is not pending', async () => {
    setupExecuteSequence([
      { data: makeWriteOff({ status: 'approved' }) },
    ]);

    await expect(rejectWriteOff('wo-001', 'manager-001', 'Valid reason here'))
      .rejects.toMatchObject({ code: 'WRITEOFF_REJECT_003' });
  });
});

// ===================================================================
// reverseWriteOff
// ===================================================================

describe('reverseWriteOff', () => {
  it('should reverse an approved write-off and restore loan balance', async () => {
    const approved = makeWriteOff({ status: 'approved', total_written_off: 1000 });
    const reversed = makeWriteOff({ status: 'reversed' });

    setupExecuteSequence([
      { data: approved },       // fetch write-off
      { data: reversed },       // update write-off
      { data: null },           // audit log
    ]);
    mockQuery.mockResolvedValueOnce({ data: [], error: null }); // restore loan balance

    const result = await reverseWriteOff('wo-001', 'manager-001', 'Erroneous write-off');

    expect(result.status).toBe('reversed');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should throw WRITEOFF_REVERSE_001 when reason is less than 5 characters', async () => {
    await expect(reverseWriteOff('wo-001', 'manager-001', 'Bad'))
      .rejects.toMatchObject({ code: 'WRITEOFF_REVERSE_001' });
  });

  it('should throw WRITEOFF_REVERSE_003 when status is not approved', async () => {
    setupExecuteSequence([
      { data: makeWriteOff({ status: 'pending' }) },
    ]);

    await expect(reverseWriteOff('wo-001', 'manager-001', 'Valid reason here'))
      .rejects.toMatchObject({ code: 'WRITEOFF_REVERSE_003' });
  });

  it('should throw WRITEOFF_REVERSE_002 when write-off not found', async () => {
    setupExecuteSequence([
      { data: null },
    ]);

    await expect(reverseWriteOff('nonexistent', 'manager-001', 'Valid reason here'))
      .rejects.toMatchObject({ code: 'WRITEOFF_REVERSE_002' });
  });
});

// ===================================================================
// checkWriteOffEligibility
// ===================================================================

describe('checkWriteOffEligibility', () => {
  it('should return eligible true when DPD >= 180', async () => {
    setupExecuteSequence([
      { data: makeLoan({ days_past_due: 200, outstanding_balance_usd: 500 }) },
      { data: [] },                             // no existing write-offs
      { data: { value: '180' } },               // system config
    ]);

    const result = await checkWriteOffEligibility('loan-001');

    expect(result.eligible).toBe(true);
    expect(result.days_past_due).toBe(200);
    expect(result.outstanding_balance).toBe(500);
    expect(result.already_written_off).toBe(false);
  });

  it('should return eligible false with reason when DPD < 180', async () => {
    setupExecuteSequence([
      { data: makeLoan({ days_past_due: 90, outstanding_balance_usd: 500 }) },
      { data: [] },
      { data: { value: '180' } },
    ]);

    const result = await checkWriteOffEligibility('loan-001');

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('90 days past due');
    expect(result.days_past_due).toBe(90);
  });

  it('should return eligible false when already written off', async () => {
    setupExecuteSequence([
      { data: makeLoan({ days_past_due: 200, outstanding_balance_usd: 500 }) },
      { data: [{ id: 'wo-existing' }] },        // existing write-off
      { data: { value: '180' } },
    ]);

    const result = await checkWriteOffEligibility('loan-001');

    expect(result.eligible).toBe(false);
    expect(result.already_written_off).toBe(true);
    expect(result.reason).toContain('already has');
  });

  it('should return eligible false when outstanding balance is zero', async () => {
    setupExecuteSequence([
      { data: makeLoan({ days_past_due: 200, outstanding_balance_usd: 0 }) },
      { data: [] },
      { data: { value: '180' } },
    ]);

    const result = await checkWriteOffEligibility('loan-001');

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('No outstanding balance');
  });

  it('should throw WRITEOFF_ELIG_001 when loan not found', async () => {
    setupExecuteSequence([
      { data: null },
    ]);

    await expect(checkWriteOffEligibility('nonexistent'))
      .rejects.toMatchObject({ code: 'WRITEOFF_ELIG_001' });
  });
});

// ===================================================================
// recordRecovery
// ===================================================================

describe('recordRecovery', () => {
  it('should record recovery amount and update recovered_amount_usd', async () => {
    const approved = makeWriteOff({
      status: 'approved',
      total_written_off: 1000,
      recovered_amount_usd: 0,
    });
    const updatedWo = makeWriteOff({
      status: 'approved',
      recovered_amount_usd: 200,
    });

    setupExecuteSequence([
      { data: approved },       // fetch write-off
      { data: updatedWo },      // update write-off
      { data: null },           // audit log
    ]);

    const result = await recordRecovery('wo-001', 200, 'Customer partial payment', 'staff-001');

    expect(result.recovered_amount_usd).toBe(200);
  });

  it('should throw WRITEOFF_RECOVERY_004 when recovery exceeds total_written_off', async () => {
    const approved = makeWriteOff({
      status: 'approved',
      total_written_off: 1000,
      recovered_amount_usd: 900,
    });

    setupExecuteSequence([
      { data: approved },
    ]);

    await expect(recordRecovery('wo-001', 200, 'Over-recovery attempt', 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_RECOVERY_004' });
  });

  it('should throw WRITEOFF_RECOVERY_003 when write-off status is not approved', async () => {
    setupExecuteSequence([
      { data: makeWriteOff({ status: 'pending' }) },
    ]);

    await expect(recordRecovery('wo-001', 100, 'Recovery on pending', 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_RECOVERY_003' });
  });

  it('should throw WRITEOFF_RECOVERY_001 for negative amount', async () => {
    await expect(recordRecovery('wo-001', -50, 'Negative recovery', 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_RECOVERY_001' });
  });

  it('should throw WRITEOFF_RECOVERY_001 for zero amount', async () => {
    await expect(recordRecovery('wo-001', 0, 'Zero recovery', 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_RECOVERY_001' });
  });

  it('should throw WRITEOFF_RECOVERY_002 when write-off not found', async () => {
    setupExecuteSequence([
      { data: null },
    ]);

    await expect(recordRecovery('nonexistent', 100, 'Not found', 'staff-001'))
      .rejects.toMatchObject({ code: 'WRITEOFF_RECOVERY_002' });
  });
});

// ===================================================================
// WriteOffError class
// ===================================================================

describe('WriteOffError', () => {
  it('should be an instance of Error with correct name and code', () => {
    const err = new WriteOffError('test message', 'TEST_CODE_001');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('WriteOffError');
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE_001');
  });
});
