/**
 * Characterization tests for admin-service organization management routes.
 *
 * These tests capture the CURRENT behavior of the monolith handler so that
 * future refactoring can be verified against a known-good baseline.
 *
 * Routes covered:
 *   GET    /admin/organizations
 *   POST   /admin/organizations
 *   GET    /admin/organizations/:id
 *   PATCH  /admin/organizations/:id
 *   POST   /admin/organizations/:id/import
 *   GET    /admin/organizations/:id/members
 */

import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';

// ─── Mocks (must be declared before handler import) ──────────────────

const mockDb = { from: jest.fn() };
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: mockQuery,
  queryOne: mockQueryOne,
  withTransaction: jest.fn().mockImplementation((fn: (...args: any[]) => any) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
}));

const mockGetAuthContext = jest.fn();
const mockIsAdminOrManager = jest.fn();
jest.mock('../../../services/shared/middleware/authorization', () => ({
  getAuthContext: mockGetAuthContext,
  isAdminOrManager: mockIsAdminOrManager,
}));

jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(),
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

import { handler } from '../../../services/admin-service/src/index';

// ─── Helpers ─────────────────────────────────────────────────────────

const TEST_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildMockChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
  };
  for (const [key, val] of Object.entries(overrides)) {
    (chain as Record<string, unknown>)[key] = val;
  }
  return chain;
}

// ─── Test suite ──────────────────────────────────────────────────────

describe('Admin Service — Organization Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAuthContext.mockReturnValue({
      userId: 'admin-user-1',
      email: 'admin@test.com',
      roles: ['admin'],
    });
    mockIsAdminOrManager.mockReturnValue(true);
  });

  // ═══════════════════════════════════════════════════════════════════
  // OPTIONS preflight
  // ═══════════════════════════════════════════════════════════════════

  it('OPTIONS /admin/organizations returns 204', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'OPTIONS',
      path: '/admin/organizations',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(204);
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET /admin/organizations
  // ═══════════════════════════════════════════════════════════════════

  it('GET /admin/organizations returns paginated list', async () => {
    const rows = [
      { id: TEST_UUID, org_code: 'ORG001', org_name: 'Test Org', org_type: 'employer' },
    ];

    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '1' }], error: null })
      .mockResolvedValueOnce({ data: rows, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/organizations',
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.data).toEqual(rows);
    expect(body.data.total).toBe(1);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(25);
    expect(body.data.total_pages).toBe(1);
  });

  it('GET /admin/organizations respects page/limit and filtering', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '30' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/organizations',
      queryStringParameters: { page: '2', limit: '10', org_type: 'employer' },
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.data.page).toBe(2);
    expect(body.data.limit).toBe(10);
    expect(body.data.total_pages).toBe(3);
  });

  it('GET /admin/organizations returns 500 on DB error', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '0' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'query failed' } });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/organizations',
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to fetch organizations');
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET /admin/organizations/:id
  // ═══════════════════════════════════════════════════════════════════

  it('GET /admin/organizations/:id returns organization with member count', async () => {
    const org = { id: TEST_UUID, org_code: 'ORG001', org_name: 'Test Org', org_type: 'employer' };

    const chain = buildMockChain();
    chain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: org, error: null }),
    });
    mockDb.from.mockReturnValue(chain);

    // Member count query via query()
    mockQuery.mockResolvedValueOnce({ data: [{ count: '42' }], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: `/admin/organizations/${TEST_UUID}`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.org_name).toBe('Test Org');
    expect(body.data.member_count).toBe(42);
  });

  it('GET /admin/organizations/:id returns 404 when not found', async () => {
    const chain = buildMockChain();
    chain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockDb.from.mockReturnValue(chain);

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: `/admin/organizations/${TEST_UUID}`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(404);
    expect(body.error).toBe('Organization not found');
  });

  // ═══════════════════════════════════════════════════════════════════
  // POST /admin/organizations
  // ═══════════════════════════════════════════════════════════════════

  it('POST /admin/organizations creates a new organization', async () => {
    const newOrg = { org_code: 'ORG002', org_name: 'New Org', org_type: 'employer' };
    const created = { id: TEST_UUID, ...newOrg };

    // Uniqueness check
    const uniqueChain = buildMockChain();
    uniqueChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Insert
    const insertChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [created], error: null }),
    });

    // Audit log
    const auditChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockDb.from
      .mockReturnValueOnce(uniqueChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(auditChain);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/organizations',
      body: JSON.stringify(newOrg),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_UUID);
    expect(body.data.org_code).toBe('ORG002');
  });

  it('POST /admin/organizations returns 400 for missing required fields', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/organizations',
      body: JSON.stringify({ org_name: 'Incomplete Org' }), // missing org_code, org_type
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Missing required field/);
  });

  it('POST /admin/organizations returns 409 for duplicate org_code', async () => {
    const chain = buildMockChain();
    chain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null }),
    });
    mockDb.from.mockReturnValue(chain);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/organizations',
      body: JSON.stringify({ org_code: 'ORG001', org_name: 'Dup Org', org_type: 'employer' }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(409);
    expect(body.error).toBe('An organization with this org_code already exists');
  });

  // ═══════════════════════════════════════════════════════════════════
  // PATCH /admin/organizations/:id
  // ═══════════════════════════════════════════════════════════════════

  it('PATCH /admin/organizations/:id updates an organization', async () => {
    const updated = { id: TEST_UUID, org_name: 'Updated Org', org_type: 'employer' };

    const chain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [updated], error: null }),
    });
    mockDb.from
      .mockReturnValueOnce(chain) // update
      .mockReturnValueOnce(buildMockChain({ execute: jest.fn().mockResolvedValue({ data: [], error: null }) })); // audit

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: `/admin/organizations/${TEST_UUID}`,
      body: JSON.stringify({ org_name: 'Updated Org' }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.org_name).toBe('Updated Org');
  });

  it('PATCH /admin/organizations/:id returns 404 when org not found', async () => {
    const chain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockDb.from.mockReturnValue(chain);

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: `/admin/organizations/${TEST_UUID}`,
      body: JSON.stringify({ org_name: 'No Such Org' }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(404);
    expect(body.error).toBe('Organization not found');
  });

  // ═══════════════════════════════════════════════════════════════════
  // POST /admin/organizations/:id/import
  // ═══════════════════════════════════════════════════════════════════

  it('POST /admin/organizations/:id/import imports members successfully', async () => {
    // org existence check
    const orgChain = buildMockChain();
    orgChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: TEST_UUID }, error: null }),
    });

    // For each member: dup check (maybeSingle -> null), customer match (maybeSingle -> null), insert
    const dupChain = buildMockChain();
    dupChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const custChain = buildMockChain();
    custChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const insertMemberChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [{}], error: null }),
    });

    // Update total_members on org
    const updateOrgChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [{}], error: null }),
    });

    // Audit
    const auditChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockDb.from
      .mockReturnValueOnce(orgChain)          // verify org exists
      .mockReturnValueOnce(dupChain)          // dup check for member 1
      .mockReturnValueOnce(custChain)         // customer match for member 1
      .mockReturnValueOnce(insertMemberChain) // insert member 1
      .mockReturnValueOnce(updateOrgChain)    // update total_members
      .mockReturnValueOnce(auditChain);       // audit log

    // COUNT query for total_members update
    mockQuery.mockResolvedValueOnce({ data: [{ count: '1' }], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: `/admin/organizations/${TEST_UUID}/import`,
      body: JSON.stringify({
        members: [
          { national_id: 'ZIM123456789', phone_number: '+263771234567', name: 'John Doe' },
        ],
        data_source: 'manual',
      }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(1);
    expect(body.data.inserted).toBe(1);
    expect(body.data.skipped).toBe(0);
    expect(body.data.errors).toBe(0);
    expect(body.data.import_batch_id).toBeDefined();
  });

  it('POST /admin/organizations/:id/import skips duplicates by national_id hash', async () => {
    // org existence check
    const orgChain = buildMockChain();
    orgChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: TEST_UUID }, error: null }),
    });

    // dup check returns existing member -> should skip
    const dupChain = buildMockChain();
    dupChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: 'existing-member-id' }, error: null }),
    });

    // Update total_members on org
    const updateOrgChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [{}], error: null }),
    });

    // Audit
    const auditChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockDb.from
      .mockReturnValueOnce(orgChain)
      .mockReturnValueOnce(dupChain)         // dup found -> skip
      .mockReturnValueOnce(updateOrgChain)   // update total_members
      .mockReturnValueOnce(auditChain);      // audit

    mockQuery.mockResolvedValueOnce({ data: [{ count: '5' }], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: `/admin/organizations/${TEST_UUID}/import`,
      body: JSON.stringify({
        members: [{ national_id: 'ZIM123456789', phone_number: '+263771234567' }],
      }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.data.inserted).toBe(0);
    expect(body.data.skipped).toBe(1);
  });

  it('POST /admin/organizations/:id/import returns 404 when org not found', async () => {
    const orgChain = buildMockChain();
    orgChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockDb.from.mockReturnValue(orgChain);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: `/admin/organizations/${TEST_UUID}/import`,
      body: JSON.stringify({
        members: [{ national_id: 'ZIM123' }],
      }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(404);
    expect(body.error).toBe('Organization not found');
  });

  it('POST /admin/organizations/:id/import returns 400 for empty members array', async () => {
    // org existence check
    const orgChain = buildMockChain();
    orgChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: TEST_UUID }, error: null }),
    });
    mockDb.from.mockReturnValue(orgChain);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: `/admin/organizations/${TEST_UUID}/import`,
      body: JSON.stringify({ members: [] }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(400);
    expect(body.error).toBe('members must be a non-empty array');
  });

  it('POST /admin/organizations/:id/import counts errors for invalid members', async () => {
    // org existence check
    const orgChain = buildMockChain();
    orgChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: TEST_UUID }, error: null }),
    });

    // Update total_members
    const updateOrgChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [{}], error: null }),
    });

    // Audit
    const auditChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockDb.from
      .mockReturnValueOnce(orgChain)
      .mockReturnValueOnce(updateOrgChain) // update total_members
      .mockReturnValueOnce(auditChain);    // audit

    // COUNT query
    mockQuery.mockResolvedValueOnce({ data: [{ count: '0' }], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: `/admin/organizations/${TEST_UUID}/import`,
      body: JSON.stringify({
        members: [
          { name: 'No ID or phone' }, // missing both national_id and phone_number -> error
        ],
      }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.data.errors).toBe(1);
    expect(body.data.inserted).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET /admin/organizations/:id/members
  // ═══════════════════════════════════════════════════════════════════

  it('GET /admin/organizations/:id/members returns paginated masked members', async () => {
    // org existence check
    const orgChain = buildMockChain();
    orgChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: TEST_UUID }, error: null }),
    });
    mockDb.from.mockReturnValue(orgChain);

    const memberRows = [
      {
        id: 'member-1',
        organization_id: TEST_UUID,
        phone_number: '+263771234567',
        employee_number: 'EMP001',
        employment_status: 'active',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '1' }], error: null })  // count
      .mockResolvedValueOnce({ data: memberRows, error: null });        // data

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: `/admin/organizations/${TEST_UUID}/members`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.data).toHaveLength(1);
    // Phone number should be masked per maskPhone regex: (\+?\d{3})\d{4}(\d{3}) -> $1****$2
    // +263771234567 -> +263 (group1) + 7712 (masked) + 345 (group2) + 67 (leftover) = +263****34567
    expect(body.data.data[0].phone_number).toBe('+263****34567');
    expect(body.data.total).toBe(1);
    expect(body.data.page).toBe(1);
  });

  it('GET /admin/organizations/:id/members returns 404 when org not found', async () => {
    const orgChain = buildMockChain();
    orgChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockDb.from.mockReturnValue(orgChain);

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: `/admin/organizations/${TEST_UUID}/members`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(404);
    expect(body.error).toBe('Organization not found');
  });

  it('GET /admin/organizations/:id/members returns 500 on DB error', async () => {
    // org existence check
    const orgChain = buildMockChain();
    orgChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: TEST_UUID }, error: null }),
    });
    mockDb.from.mockReturnValue(orgChain);

    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '5' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: `/admin/organizations/${TEST_UUID}/members`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(500);
    expect(body.error).toBe('Failed to fetch organization members');
  });
});
