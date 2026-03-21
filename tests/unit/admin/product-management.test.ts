/**
 * Characterization tests for admin-service product management routes.
 *
 * Routes covered:
 *   GET    /admin/products
 *   POST   /admin/products
 *   GET    /admin/products/:id
 *   PATCH  /admin/products/:id
 *   DELETE /admin/products/:id
 *
 * These tests capture the current monolith behavior BEFORE refactoring.
 */

// ─── Mocks (must be before imports) ───

const mockDb = {
  from: jest.fn(),
};
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();
jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: mockQuery,
  queryOne: mockQueryOne,
  withTransaction: jest.fn().mockImplementation((fn: Function) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
}));

const mockGetAuthContext = jest.fn();
const mockIsAdminOrManager = jest.fn();
jest.mock('../../../services/shared/middleware/authorization', () => ({
  getAuthContext: mockGetAuthContext,
  isAdminOrManager: mockIsAdminOrManager,
}));

const mockFineractClient = {
  createLoanProduct: jest.fn().mockResolvedValue({ resourceId: 42 }),
  updateLoanProduct: jest.fn().mockResolvedValue({ resourceId: 42 }),
  listLoanProducts: jest.fn().mockResolvedValue([]),
  listGLAccounts: jest.fn().mockResolvedValue([]),
};
jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn().mockResolvedValue(mockFineractClient),
  FineractApiError: class FineractApiError extends Error {
    statusCode: number;
    errorBody: unknown;
    constructor(msg: string, statusCode: number, errorBody?: unknown) {
      super(msg);
      this.statusCode = statusCode;
      this.errorBody = errorBody;
    }
  },
}));

jest.mock('../../../services/shared/clients/fineract-sync', () => ({
  syncProductToFineract: jest.fn().mockResolvedValue({ success: true, fineract_product_id: 42 }),
}));

jest.mock('../../../services/shared/utils/rbz-compliance', () => ({
  validateRBZCompliance: jest.fn().mockReturnValue({ compliant: true, violations: [] }),
}));

jest.mock('../../../services/shared/utils/product-versioning', () => ({
  createProductVersion: jest.fn().mockResolvedValue(undefined),
  getProductVersions: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../services/shared/utils/response', () => {
  const actual = jest.requireActual('../../../services/shared/utils/response');
  return {
    ...actual,
    getSecurityHeaders: jest.fn().mockReturnValue({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }),
  };
});

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
  getRequestContext: jest.fn().mockReturnValue({ requestId: 'test-req-id' }),
  maskImei: jest.fn((imei: string) => imei),
}));

// ─── Imports ───

import { handler } from '../../../services/admin-service/src/index';
import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';

// ─── Helpers ───

function buildEvent(overrides: Record<string, unknown> = {}) {
  const base = createAPIGatewayEvent(overrides as never);
  return {
    ...base,
    requestContext: {
      ...base.requestContext,
      authorizer: {
        claims: {
          sub: 'admin-user-1',
          email: 'admin@test.com',
          'cognito:groups': 'admin',
        },
      },
    },
    ...(overrides as object),
  };
}

function chainableMock(terminalData: { data: unknown; error: unknown } | null = null) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'is', 'gte', 'lte', 'order', 'limit',
    'single', 'maybeSingle',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.execute = jest.fn().mockResolvedValue(terminalData ?? { data: [], error: null });
  return chain;
}

/** A valid smartphone product body for POST /admin/products */
function validSmartphoneProductBody(overrides: Record<string, unknown> = {}) {
  return {
    product_code: 'PHONE_001',
    product_name: 'Basic Smartphone Loan',
    product_category: 'smartphone',
    product_type: 'installment',
    short_name: 'PH01',
    default_principal: 250,
    number_of_repayments: 12,
    min_amount_usd: 50,
    max_amount_usd: 500,
    min_term_months: 3,
    max_term_months: 12,
    interest_rate_monthly: 3.5,
    interest_rate_annual: 42,
    requires_device: true,
    deposit_percentage: 10,
    accounting_rule: 1,
    ...overrides,
  };
}

/** A valid digital product body for POST /admin/products */
function validDigitalProductBody(overrides: Record<string, unknown> = {}) {
  return {
    product_code: 'DIG_001',
    product_name: 'Digital Cash Loan',
    product_category: 'digital',
    product_type: 'installment',
    short_name: 'DG01',
    default_principal: 100,
    number_of_repayments: 6,
    min_amount_usd: 10,
    max_amount_usd: 200,
    min_term_months: 1,
    max_term_months: 6,
    interest_rate_monthly: 5,
    interest_rate_annual: 60,
    deposit_percentage: 0,
    requires_organization_verification: true,
    accounting_rule: 1,
    ...overrides,
  };
}

// ─── Tests ───

describe('Admin Service — Product Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockReturnValue({
      userId: 'admin-user-1',
      email: 'admin@test.com',
      roles: ['admin'],
    });
    mockIsAdminOrManager.mockReturnValue(true);
  });

  // ═══════════════════════════════════════════
  // GET /admin/products
  // ═══════════════════════════════════════════

  describe('GET /admin/products', () => {
    it('should return paginated product list', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '2' }], error: null })
        .mockResolvedValueOnce({
          data: [
            { id: 'p1', product_code: 'PHONE_001', product_name: 'Phone Loan', status: 'active' },
            { id: 'p2', product_code: 'DIG_001', product_name: 'Digital Loan', status: 'active' },
          ],
          error: null,
        });

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/products' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: { data: unknown[]; total: number } }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.data).toHaveLength(2);
      expect(body.data.total).toBe(2);
    });

    it('should return 403 when not admin or manager', async () => {
      mockIsAdminOrManager.mockReturnValue(false);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/products' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
    });

    it('should return 500 when DB query fails', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '1' }], error: null })
        .mockResolvedValueOnce({ data: [], error: { message: 'db error' } });

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/products' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(500);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Failed to fetch products');
    });
  });

  // ═══════════════════════════════════════════
  // POST /admin/products
  // ═══════════════════════════════════════════

  describe('POST /admin/products', () => {
    it('should create a smartphone product (happy path)', async () => {
      // Fineract mock already set up in top-level mock (returns resourceId: 42)
      // uniqueness check => not found
      const existingChain = chainableMock({ data: null, error: null });
      // insert
      const insertChain = chainableMock();
      const insertedRow = {
        id: 'prod-new-1',
        ...validSmartphoneProductBody(),
        fineract_product_id: 42,
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      insertChain.execute.mockResolvedValue({ data: [insertedRow], error: null });
      // audit
      const auditChain = chainableMock();

      mockDb.from
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(auditChain);

      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody()),
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.product_code).toBe('PHONE_001');
      expect(body.data.fineract_product_id).toBe(42);
    });

    it('should create a digital product (happy path)', async () => {
      const existingChain = chainableMock({ data: null, error: null });
      const insertChain = chainableMock();
      const insertedRow = {
        id: 'prod-new-2',
        ...validDigitalProductBody(),
        fineract_product_id: 42,
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      insertChain.execute.mockResolvedValue({ data: [insertedRow], error: null });
      const auditChain = chainableMock();

      mockDb.from
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(auditChain);

      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validDigitalProductBody()),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(201);
    });

    it('should return 400 when required fields are missing', async () => {
      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify({ product_code: 'INCOMPLETE' }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('Missing required field');
    });

    it('should return 400 for invalid product_code format', async () => {
      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody({ product_code: 'bad code!!!' })),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('product_code must be alphanumeric');
    });

    it('should return 400 for invalid product_category', async () => {
      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody({ product_category: 'invalid_cat' })),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('product_category must be smartphone or digital');
    });

    it('should return 400 when smartphone product has requires_device = false', async () => {
      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody({ requires_device: false })),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('requires_device');
    });

    it('should return 400 when smartphone product has deposit_percentage <= 0', async () => {
      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody({ deposit_percentage: 0 })),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('deposit_percentage');
    });

    it('should return 400 when min_term_months >= max_term_months', async () => {
      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody({ min_term_months: 12, max_term_months: 12 })),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('min_term_months must be less than max_term_months');
    });

    it('should return 400 when min_amount_usd >= max_amount_usd', async () => {
      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody({ min_amount_usd: 500, max_amount_usd: 500 })),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('min_amount_usd must be less than max_amount_usd');
    });

    it('should return 409 when product_code already exists', async () => {
      const existingChain = chainableMock({ data: { id: 'existing-prod' }, error: null });
      mockDb.from.mockReturnValueOnce(existingChain);

      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody()),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(409);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('product_code already exists');
    });

    it('should return 403 when not admin or manager', async () => {
      mockIsAdminOrManager.mockReturnValue(false);

      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/products',
        body: JSON.stringify(validSmartphoneProductBody()),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
    });
  });

  // ═══════════════════════════════════════════
  // GET /admin/products/:id
  // ═══════════════════════════════════════════

  describe('GET /admin/products/:id', () => {
    it('should return product by ID', async () => {
      const productRow = {
        id: 'a1b2c3d4-e5f6-0001-abcd-ef0000000001',
        product_code: 'PHONE_001',
        product_name: 'Phone Loan',
        status: 'active',
        deleted_at: null,
      };
      const chain = chainableMock({ data: productRow, error: null });
      mockDb.from.mockReturnValue(chain);
      // Mock linked device models query (returns empty array)
      mockQuery.mockResolvedValue({ data: [], error: null });

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/products/a1b2c3d4-e5f6-0001-abcd-ef0000000001' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.product_code).toBe('PHONE_001');
    });

    it('should return 404 when product not found', async () => {
      const chain = chainableMock({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/products/a1b2c3d4-e5f6-0002-abcd-ef0000000002' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(404);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Product not found');
    });
  });

  // ═══════════════════════════════════════════
  // PATCH /admin/products/:id
  // ═══════════════════════════════════════════

  describe('PATCH /admin/products/:id', () => {
    it('should update product fields', async () => {
      const existingProduct = {
        id: 'a1b2c3d4-e5f6-0001-abcd-ef0000000001',
        product_code: 'PHONE_001',
        product_name: 'Phone Loan',
        status: 'active',
        fineract_product_id: null,
      };
      const updatedRow = {
        ...existingProduct,
        product_name: 'Updated Phone Loan',
        updated_at: '2025-02-01T00:00:00Z',
      };
      // 1. SELECT existing product
      const selectChain = chainableMock({ data: existingProduct, error: null });
      // 2. UPDATE
      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({ data: [updatedRow], error: null });
      // 3. Audit log
      const auditChain = chainableMock();

      mockDb.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(auditChain);

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/products/a1b2c3d4-e5f6-0001-abcd-ef0000000001',
        body: JSON.stringify({ product_name: 'Updated Phone Loan', status: 'inactive' }),
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.data.product_name).toBe('Updated Phone Loan');
    });

    it('should return 404 when product not found for update', async () => {
      // SELECT existing product → not found
      const selectChain = chainableMock({ data: null, error: null });
      mockDb.from.mockReturnValueOnce(selectChain);

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/products/a1b2c3d4-e5f6-0002-abcd-ef0000000002',
        body: JSON.stringify({ product_name: 'Nope' }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(404);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Product not found');
    });

    it('should return 500 when DB update fails', async () => {
      const existingProduct = {
        id: 'a1b2c3d4-e5f6-0001-abcd-ef0000000001',
        product_code: 'PHONE_001',
        fineract_product_id: null,
      };
      // 1. SELECT existing product
      const selectChain = chainableMock({ data: existingProduct, error: null });
      // 2. UPDATE → fails
      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({ data: null, error: { message: 'update failed' } });

      mockDb.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/products/a1b2c3d4-e5f6-0001-abcd-ef0000000001',
        body: JSON.stringify({ status: 'inactive' }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(500);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Failed to update product');
    });
  });

  // ═══════════════════════════════════════════
  // DELETE /admin/products/:id
  // ═══════════════════════════════════════════

  describe('DELETE /admin/products/:id', () => {
    it('should soft-delete a product with no active loans', async () => {
      // active loan count check => 0
      mockQuery.mockResolvedValueOnce({ data: [{ count: '0' }], error: null });
      // active session count check => 0
      mockQuery.mockResolvedValueOnce({ data: [{ count: 0 }], error: null });

      // soft delete (update)
      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({
        data: [{ id: 'a1b2c3d4-e5f6-0001-abcd-ef0000000001', deleted_at: '2025-02-01T00:00:00Z' }],
        error: null,
      });
      // audit log
      const auditChain = chainableMock();

      mockDb.from
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(auditChain);

      const event = buildEvent({ httpMethod: 'DELETE', path: '/admin/products/a1b2c3d4-e5f6-0001-abcd-ef0000000001' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: { message: string } }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.data.message).toBe('Product deleted successfully');
    });

    it('should return 400 when product has active loans', async () => {
      mockQuery.mockResolvedValueOnce({ data: [{ count: '3' }], error: null });

      const event = buildEvent({ httpMethod: 'DELETE', path: '/admin/products/a1b2c3d4-e5f6-0001-abcd-ef0000000001' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string; details: { active_loans: number } }>(result);
      expect(body.error).toBe('Cannot delete product with active loans');
      expect(body.details.active_loans).toBe(3);
    });

    it('should return 404 when product not found for delete', async () => {
      mockQuery.mockResolvedValueOnce({ data: [{ count: '0' }], error: null });
      // active session count check => 0
      mockQuery.mockResolvedValueOnce({ data: [{ count: 0 }], error: null });

      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({ data: [], error: null });
      mockDb.from.mockReturnValueOnce(updateChain);

      const event = buildEvent({ httpMethod: 'DELETE', path: '/admin/products/a1b2c3d4-e5f6-0002-abcd-ef0000000002' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(404);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Product not found');
    });

    it('should return 403 when not admin or manager', async () => {
      mockIsAdminOrManager.mockReturnValue(false);

      const event = buildEvent({ httpMethod: 'DELETE', path: '/admin/products/a1b2c3d4-e5f6-0001-abcd-ef0000000001' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
    });

    it('should return 500 when DB soft-delete fails', async () => {
      mockQuery.mockResolvedValueOnce({ data: [{ count: '0' }], error: null });
      // active session count check => 0
      mockQuery.mockResolvedValueOnce({ data: [{ count: 0 }], error: null });

      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({ data: null, error: { message: 'delete failed' } });
      mockDb.from.mockReturnValueOnce(updateChain);

      const event = buildEvent({ httpMethod: 'DELETE', path: '/admin/products/a1b2c3d4-e5f6-0001-abcd-ef0000000001' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(500);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Failed to delete product');
    });
  });
});
