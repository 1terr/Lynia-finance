/**
 * Fineract Sync Executor Unit Tests
 *
 * Tests for sync-executor.ts which orchestrates syncing Lynia entities
 * (customers, loans, repayments) to Fineract and updating DB mappings.
 *
 * Mocks:
 *   - Fineract client (getFineractClient)
 *   - Database client (db)
 *   - Sync logging (logSync, queueSyncRetry)
 *   - Logger
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ============================================================
// MOCK SETUP
// ============================================================

// Mock the Fineract client
const mockCreateClient = jest.fn();
const mockCreateLoan = jest.fn();
const mockApproveLoan = jest.fn();
const mockDisburseLoan = jest.fn();
const mockPostRepayment = jest.fn();
const mockRegisterInteropParty = jest.fn();

jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(() => Promise.resolve({
    createClient: mockCreateClient,
    createLoan: mockCreateLoan,
    approveLoan: mockApproveLoan,
    disburseLoan: mockDisburseLoan,
    postRepayment: mockPostRepayment,
    registerInteropParty: mockRegisterInteropParty,
  })),
  FineractApiError: class FineractApiError extends Error {
    statusCode: number;
    errorBody: unknown;
    constructor(message: string, statusCode: number, errorBody: unknown) {
      super(message);
      this.name = 'FineractApiError';
      this.statusCode = statusCode;
      this.errorBody = errorBody;
    }
  },
}));

// Mock the database client
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockExecute = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: {
    from: jest.fn(() => ({
      update: jest.fn((data: unknown) => {
        mockUpdate(data);
        return {
          eq: jest.fn((field: string, value: unknown) => {
            mockEq(field, value);
            return { execute: mockExecute };
          }),
        };
      }),
    })),
  },
}));

// Mock sync logging
const mockLogSync = jest.fn().mockResolvedValue(undefined);
const mockQueueSyncRetry = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../services/shared/clients/fineract-sync/sync-scheduler', () => ({
  logSync: (...args: unknown[]) => mockLogSync(...args),
  queueSyncRetry: (...args: unknown[]) => mockQueueSyncRetry(...args),
}));

// Mock logger
jest.mock('../../../services/shared/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock secrets (transitive dependency)
jest.mock('../../../services/shared/utils/secrets', () => ({
  getSecret: jest.fn(() => Promise.resolve({})),
}));

import {
  syncCustomerToFineract,
  syncLoanToFineract,
  approveLoanInFineract,
  disburseLoanInFineract,
  syncRepaymentToFineract,
} from '../../../services/shared/clients/fineract-sync/sync-executor';

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockResolvedValue({ data: null, error: null });
  // Reset env
  delete process.env.FINERACT_USE_INTEROP;
});

// ============================================================
// syncCustomerToFineract()
// ============================================================

describe('syncCustomerToFineract()', () => {
  const defaultParams = {
    customerId: 'cust-uuid-001',
    firstName: 'Tendai',
    lastName: 'Moyo',
    mobileNo: '+263771234567',
  };

  it('should call fineract.createClient with correct params', async () => {
    mockCreateClient.mockResolvedValue({ resourceId: 42 });

    await syncCustomerToFineract(defaultParams);

    expect(mockCreateClient).toHaveBeenCalledWith({
      firstName: 'Tendai',
      lastName: 'Moyo',
      mobileNo: '+263771234567',
      externalId: 'cust-uuid-001',
      dateOfBirth: undefined,
    });
  });

  it('should return the Fineract client ID on success', async () => {
    mockCreateClient.mockResolvedValue({ resourceId: 42 });

    const result = await syncCustomerToFineract(defaultParams);

    expect(result).toBe(42);
  });

  it('should update the customers table with fineract_client_id', async () => {
    mockCreateClient.mockResolvedValue({ resourceId: 42 });

    await syncCustomerToFineract(defaultParams);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        fineract_client_id: 42,
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'cust-uuid-001');
  });

  it('should log a success sync entry', async () => {
    mockCreateClient.mockResolvedValue({ resourceId: 42 });

    await syncCustomerToFineract(defaultParams);

    expect(mockLogSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'client',
        entity_id: 'cust-uuid-001',
        fineract_id: 42,
        operation: 'create',
        direction: 'outbound',
        status: 'success',
      })
    );
  });

  it('should return null and queue retry on Fineract API failure', async () => {
    mockCreateClient.mockRejectedValue(new Error('Connection refused'));

    const result = await syncCustomerToFineract(defaultParams);

    expect(result).toBeNull();
    expect(mockQueueSyncRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'client',
        entityId: 'cust-uuid-001',
        operation: 'create',
      })
    );
  });

  it('should log a failed sync entry on error', async () => {
    mockCreateClient.mockRejectedValue(new Error('Server error'));

    await syncCustomerToFineract(defaultParams);

    expect(mockLogSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'client',
        entity_id: 'cust-uuid-001',
        operation: 'create',
        status: 'failed',
        error_message: 'Server error',
      })
    );
  });

  it('should include dateOfBirth when provided', async () => {
    mockCreateClient.mockResolvedValue({ resourceId: 42 });

    await syncCustomerToFineract({
      ...defaultParams,
      dateOfBirth: '1990-01-15',
    });

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        dateOfBirth: '1990-01-15',
      })
    );
  });
});

// ============================================================
// syncLoanToFineract()
// ============================================================

describe('syncLoanToFineract()', () => {
  const defaultParams = {
    loanId: 'loan-uuid-001',
    customerId: 'cust-uuid-001',
    fineractClientId: 42,
    fineractProductId: 1,
    principal: 200,
    numberOfRepayments: 12,
    repaymentEveryMonths: 1,
    interestRatePerMonth: 5.0,
    expectedDisbursementDate: new Date('2026-03-15'),
  };

  it('should call fineract.createLoan with correct params', async () => {
    mockCreateLoan.mockResolvedValue({ resourceId: 101 });

    await syncLoanToFineract(defaultParams);

    expect(mockCreateLoan).toHaveBeenCalledWith({
      clientId: 42,
      productId: 1,
      principal: 200,
      numberOfRepayments: 12,
      repaymentEveryMonths: 1,
      interestRatePerMonth: 5.0,
      expectedDisbursementDate: defaultParams.expectedDisbursementDate,
      externalId: 'loan-uuid-001',
    });
  });

  it('should return the Fineract loan ID on success', async () => {
    mockCreateLoan.mockResolvedValue({ resourceId: 101 });

    const result = await syncLoanToFineract(defaultParams);

    expect(result).toBe(101);
  });

  it('should update the loans table with fineract_loan_id', async () => {
    mockCreateLoan.mockResolvedValue({ resourceId: 101 });

    await syncLoanToFineract(defaultParams);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        fineract_loan_id: 101,
        fineract_product_id: 1,
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'loan-uuid-001');
  });

  it('should return null and queue retry on failure', async () => {
    mockCreateLoan.mockRejectedValue(new Error('Duplicate external ID'));

    const result = await syncLoanToFineract(defaultParams);

    expect(result).toBeNull();
    expect(mockQueueSyncRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'loan',
        entityId: 'loan-uuid-001',
        operation: 'create',
      })
    );
  });

  it('should log success sync entry with correct entity_type', async () => {
    mockCreateLoan.mockResolvedValue({ resourceId: 101 });

    await syncLoanToFineract(defaultParams);

    expect(mockLogSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'loan',
        entity_id: 'loan-uuid-001',
        fineract_id: 101,
        operation: 'create',
        status: 'success',
      })
    );
  });
});

// ============================================================
// approveLoanInFineract()
// ============================================================

describe('approveLoanInFineract()', () => {
  it('should call fineract.approveLoan with the Fineract loan ID', async () => {
    mockApproveLoan.mockResolvedValue({ resourceId: 101, changes: {} });

    await approveLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
    });

    expect(mockApproveLoan).toHaveBeenCalledWith(101);
  });

  it('should return true on success', async () => {
    mockApproveLoan.mockResolvedValue({ resourceId: 101, changes: {} });

    const result = await approveLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
    });

    expect(result).toBe(true);
  });

  it('should return false and queue retry on failure', async () => {
    mockApproveLoan.mockRejectedValue(new Error('Loan not in pending state'));

    const result = await approveLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
    });

    expect(result).toBe(false);
    expect(mockQueueSyncRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'loan',
        entityId: 'loan-uuid-001',
        operation: 'approve',
      })
    );
  });

  it('should log success sync entry for approve operation', async () => {
    mockApproveLoan.mockResolvedValue({ resourceId: 101, changes: {} });

    await approveLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
    });

    expect(mockLogSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'loan',
        operation: 'approve',
        status: 'success',
        fineract_id: 101,
      })
    );
  });
});

// ============================================================
// disburseLoanInFineract()
// ============================================================

describe('disburseLoanInFineract()', () => {
  it('should call fineract.disburseLoan for standard disbursement', async () => {
    mockDisburseLoan.mockResolvedValue({ resourceId: 101, changes: {} });

    await disburseLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
    });

    expect(mockDisburseLoan).toHaveBeenCalledWith(101, undefined);
  });

  it('should pass disbursementDate when provided', async () => {
    mockDisburseLoan.mockResolvedValue({ resourceId: 101, changes: {} });

    const date = new Date('2026-04-01');
    await disburseLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
      disbursementDate: date,
    });

    expect(mockDisburseLoan).toHaveBeenCalledWith(101, date);
  });

  it('should return true on success', async () => {
    mockDisburseLoan.mockResolvedValue({ resourceId: 101, changes: {} });

    const result = await disburseLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
    });

    expect(result).toBe(true);
  });

  it('should return false and queue retry on failure', async () => {
    mockDisburseLoan.mockRejectedValue(new Error('Loan not approved'));

    const result = await disburseLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
    });

    expect(result).toBe(false);
    expect(mockQueueSyncRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'loan',
        entityId: 'loan-uuid-001',
        operation: 'disburse',
      })
    );
  });

  it('should log disburse operation on success', async () => {
    mockDisburseLoan.mockResolvedValue({ resourceId: 101, changes: {} });

    await disburseLoanInFineract({
      loanId: 'loan-uuid-001',
      fineractLoanId: 101,
    });

    expect(mockLogSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'loan',
        operation: 'disburse',
        status: 'success',
      })
    );
  });
});

// ============================================================
// syncRepaymentToFineract()
// ============================================================

describe('syncRepaymentToFineract()', () => {
  const defaultParams = {
    paymentId: 'pay-uuid-001',
    loanId: 'loan-uuid-001',
    fineractLoanId: 101,
    amount: 25.50,
    transactionDate: new Date('2026-06-01'),
    note: 'EcoCash repayment',
  };

  it('should call fineract.postRepayment with correct params', async () => {
    mockPostRepayment.mockResolvedValue({ resourceId: 501 });

    await syncRepaymentToFineract(defaultParams);

    expect(mockPostRepayment).toHaveBeenCalledWith({
      loanId: 101,
      amount: 25.50,
      transactionDate: defaultParams.transactionDate,
      note: 'EcoCash repayment',
      externalId: 'pay-uuid-001',
    });
  });

  it('should return the Fineract transaction ID on success', async () => {
    mockPostRepayment.mockResolvedValue({ resourceId: 501 });

    const result = await syncRepaymentToFineract(defaultParams);

    expect(result).toBe(501);
  });

  it('should update the payments table with fineract_transaction_id', async () => {
    mockPostRepayment.mockResolvedValue({ resourceId: 501 });

    await syncRepaymentToFineract(defaultParams);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        fineract_transaction_id: 501,
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'pay-uuid-001');
  });

  it('should return null and queue retry on failure', async () => {
    mockPostRepayment.mockRejectedValue(new Error('Loan is closed'));

    const result = await syncRepaymentToFineract(defaultParams);

    expect(result).toBeNull();
    expect(mockQueueSyncRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'repayment',
        entityId: 'pay-uuid-001',
        operation: 'repayment',
      })
    );
  });

  it('should log success sync entry for repayment', async () => {
    mockPostRepayment.mockResolvedValue({ resourceId: 501 });

    await syncRepaymentToFineract(defaultParams);

    expect(mockLogSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'repayment',
        entity_id: 'pay-uuid-001',
        fineract_id: 501,
        operation: 'repayment',
        status: 'success',
      })
    );
  });

  it('should log failure with error message', async () => {
    mockPostRepayment.mockRejectedValue(new Error('Insufficient balance'));

    await syncRepaymentToFineract(defaultParams);

    expect(mockLogSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'repayment',
        status: 'failed',
        error_message: 'Insufficient balance',
      })
    );
  });
});
