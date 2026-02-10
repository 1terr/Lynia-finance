/**
 * Test Utilities for Lynia Finance Integration Tests
 *
 * Provides mock Supabase client, Lambda handler invoker,
 * and database seeding/teardown utilities.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// =====================================================
// MOCK SUPABASE CLIENT
// =====================================================

type QueryResult = { data: unknown; error: unknown };
type QueryBuilder = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  match: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  gt: jest.Mock;
  lt: jest.Mock;
  is: jest.Mock;
  not: jest.Mock;
  or: jest.Mock;
  filter: jest.Mock;
  range: jest.Mock;
  count: jest.Mock;
};

/** In-memory data store keyed by table name */
const mockDataStore: Record<string, Record<string, unknown>[]> = {};

/** Reset all mock data between tests */
export function resetMockDataStore(): void {
  Object.keys(mockDataStore).forEach(key => delete mockDataStore[key]);
}

/** Seed mock data for a table */
export function seedMockTable(tableName: string, rows: Record<string, unknown>[]): void {
  mockDataStore[tableName] = [...rows];
}

/** Get current mock data for a table */
export function getMockTable(tableName: string): Record<string, unknown>[] {
  return mockDataStore[tableName] || [];
}

/**
 * Create a chainable query builder that operates on the in-memory store.
 * Each method returns the builder itself so calls can be chained.
 */
function createQueryBuilder(tableName: string): QueryBuilder {
  let pendingResult: QueryResult = { data: null, error: null };
  const filters: Array<{ field: string; op: string; value: unknown }> = [];
  let sortField: string | null = null;
  let sortAsc = true;
  let limitCount: number | null = null;
  let isSingle = false;
  let pendingInsert: Record<string, unknown>[] | null = null;
  let pendingUpdate: Record<string, unknown> | null = null;
  let _pendingSelect = '*';

  function applyFilters(): Record<string, unknown>[] {
    let rows = [...(mockDataStore[tableName] || [])];

    for (const f of filters) {
      switch (f.op) {
        case 'eq':
          rows = rows.filter(r => r[f.field] === f.value);
          break;
        case 'neq':
          rows = rows.filter(r => r[f.field] !== f.value);
          break;
        case 'in':
          rows = rows.filter(r => (f.value as unknown[]).includes(r[f.field]));
          break;
        case 'gte':
          rows = rows.filter(r => (r[f.field] as number) >= (f.value as number));
          break;
        case 'lte':
          rows = rows.filter(r => (r[f.field] as number) <= (f.value as number));
          break;
        case 'gt':
          rows = rows.filter(r => (r[f.field] as number) > (f.value as number));
          break;
        case 'lt':
          rows = rows.filter(r => (r[f.field] as number) < (f.value as number));
          break;
        case 'is':
          rows = rows.filter(r => r[f.field] === f.value);
          break;
      }
    }

    if (sortField) {
      rows.sort((a, b) => {
        const va = a[sortField!] as string;
        const vb = b[sortField!] as string;
        return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }

    if (limitCount !== null) {
      rows = rows.slice(0, limitCount);
    }

    return rows;
  }

  function resolve(): QueryResult {
    // Handle insert
    if (pendingInsert !== null) {
      if (!mockDataStore[tableName]) mockDataStore[tableName] = [];
      const inserted = pendingInsert.map(row => ({
        id: row.id || `mock_${tableName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        created_at: new Date().toISOString(),
        ...row
      }));
      mockDataStore[tableName].push(...inserted);
      pendingResult = { data: isSingle ? inserted[0] : inserted, error: null };
      return pendingResult;
    }

    // Handle update
    if (pendingUpdate !== null) {
      const matching = applyFilters();
      for (const row of matching) {
        const idx = mockDataStore[tableName].indexOf(row);
        if (idx >= 0) {
          mockDataStore[tableName][idx] = { ...row, ...pendingUpdate, updated_at: new Date().toISOString() };
        }
      }
      const updated = applyFilters();
      pendingResult = { data: isSingle ? updated[0] || null : updated, error: null };
      return pendingResult;
    }

    // Handle select
    const rows = applyFilters();
    if (isSingle) {
      pendingResult = rows.length > 0
        ? { data: rows[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
    } else {
      pendingResult = { data: rows, error: null };
    }
    return pendingResult;
  }

  const builder: QueryBuilder = {
    select: jest.fn().mockImplementation((_cols?: string) => {
      if (_cols) _pendingSelect = _cols;
      resolve();
      return builder;
    }),
    insert: jest.fn().mockImplementation((rows: Record<string, unknown> | Record<string, unknown>[]) => {
      pendingInsert = Array.isArray(rows) ? rows : [rows];
      resolve();
      return builder;
    }),
    update: jest.fn().mockImplementation((data: Record<string, unknown>) => {
      pendingUpdate = data;
      return builder;
    }),
    delete: jest.fn().mockImplementation(() => {
      const matching = applyFilters();
      for (const row of matching) {
        const idx = (mockDataStore[tableName] || []).indexOf(row);
        if (idx >= 0) mockDataStore[tableName].splice(idx, 1);
      }
      pendingResult = { data: matching, error: null };
      return builder;
    }),
    upsert: jest.fn().mockImplementation((rows: Record<string, unknown> | Record<string, unknown>[]) => {
      pendingInsert = Array.isArray(rows) ? rows : [rows];
      resolve();
      return builder;
    }),
    eq: jest.fn().mockImplementation((field: string, value: unknown) => {
      filters.push({ field, op: 'eq', value });
      resolve();
      return builder;
    }),
    neq: jest.fn().mockImplementation((field: string, value: unknown) => {
      filters.push({ field, op: 'neq', value });
      resolve();
      return builder;
    }),
    in: jest.fn().mockImplementation((field: string, values: unknown[]) => {
      filters.push({ field, op: 'in', value: values });
      resolve();
      return builder;
    }),
    order: jest.fn().mockImplementation((field: string, opts?: { ascending?: boolean }) => {
      sortField = field;
      sortAsc = opts?.ascending !== false;
      resolve();
      return builder;
    }),
    limit: jest.fn().mockImplementation((count: number) => {
      limitCount = count;
      resolve();
      return builder;
    }),
    single: jest.fn().mockImplementation(() => {
      isSingle = true;
      return resolve();
    }),
    maybeSingle: jest.fn().mockImplementation(() => {
      isSingle = true;
      const result = resolve();
      if (result.error) return { data: null, error: null };
      return result;
    }),
    match: jest.fn().mockImplementation((criteria: Record<string, unknown>) => {
      for (const [field, value] of Object.entries(criteria)) {
        filters.push({ field, op: 'eq', value });
      }
      resolve();
      return builder;
    }),
    gte: jest.fn().mockImplementation((field: string, value: unknown) => {
      filters.push({ field, op: 'gte', value });
      resolve();
      return builder;
    }),
    lte: jest.fn().mockImplementation((field: string, value: unknown) => {
      filters.push({ field, op: 'lte', value });
      resolve();
      return builder;
    }),
    gt: jest.fn().mockImplementation((field: string, value: unknown) => {
      filters.push({ field, op: 'gt', value });
      resolve();
      return builder;
    }),
    lt: jest.fn().mockImplementation((field: string, value: unknown) => {
      filters.push({ field, op: 'lt', value });
      resolve();
      return builder;
    }),
    is: jest.fn().mockImplementation((field: string, value: unknown) => {
      filters.push({ field, op: 'is', value });
      resolve();
      return builder;
    }),
    not: jest.fn().mockImplementation((_field: string, _op: string, _value: unknown) => {
      return builder;
    }),
    or: jest.fn().mockImplementation((_conditions: string) => {
      return builder;
    }),
    filter: jest.fn().mockImplementation((_field: string, _op: string, _value: unknown) => {
      return builder;
    }),
    range: jest.fn().mockImplementation((_from: number, _to: number) => {
      return builder;
    }),
    count: jest.fn().mockImplementation(() => {
      const rows = applyFilters();
      pendingResult = { data: rows, error: null };
      return builder;
    })
  };

  return builder;
}

/** Create a mock Supabase client for testing */
export function createMockSupabaseClient() {
  const client = {
    from: jest.fn().mockImplementation((tableName: string) => {
      return createQueryBuilder(tableName);
    }),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null }),
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.supabase.co/storage/test' } }),
      })
    }
  };

  return client;
}

// =====================================================
// LAMBDA HANDLER INVOKER
// =====================================================

/** Create a mock API Gateway event for testing Lambda handlers */
export function createAPIGatewayEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/',
    body: null,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-jwt-token',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: {},
      protocol: 'HTTP/1.1',
      httpMethod: overrides.httpMethod || 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'jest-test',
        userArn: null,
      },
      path: overrides.path || '/',
      stage: 'test',
      requestId: `test-req-${Date.now()}`,
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: overrides.path || '/',
    },
    resource: overrides.path || '/',
    ...overrides,
  };
}

/** Invoke a Lambda handler with a mock event */
export async function invokeLambdaHandler(
  handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>,
  overrides: Partial<APIGatewayProxyEvent> = {}
): Promise<APIGatewayProxyResult> {
  const event = createAPIGatewayEvent(overrides);
  return handler(event);
}

/** Parse Lambda response body */
export function parseResponseBody<T = Record<string, unknown>>(response: APIGatewayProxyResult): T {
  return JSON.parse(response.body) as T;
}

// =====================================================
// FIXTURES HELPERS
// =====================================================

/** Generate a unique test ID */
export function generateTestId(prefix: string): string {
  return `${prefix}_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a test customer fixture */
export function createTestCustomer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: generateTestId('cust'),
    phone_number: '+263771234567',
    whatsapp_number: '+263771234567',
    full_name: 'Test Customer',
    first_name: 'Test',
    last_name: 'Customer',
    date_of_birth: '1990-01-01',
    national_id: 'ZIM123456789',
    physical_address: '123 Test Street, Harare',
    employment_status: 'employed',
    monthly_income_usd: 500,
    kyc_status: 'pending',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Create a test loan fixture */
export function createTestLoan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: generateTestId('loan'),
    customer_id: 'cust_test_001',
    product_id: 'prod_001',
    loan_amount_usd: 350,
    interest_rate: 12,
    loan_term_months: 6,
    monthly_installment_usd: 61.83,
    total_amount_due_usd: 371,
    outstanding_balance_usd: 371,
    loan_status: 'pending',
    days_past_due: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Create a test payment fixture */
export function createTestPayment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: generateTestId('pay'),
    loan_id: 'loan_test_001',
    customer_id: 'cust_test_001',
    payment_amount_usd: 61.83,
    payment_method: 'ecocash',
    payment_status: 'pending',
    payment_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Create a test device fixture */
export function createTestDevice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: generateTestId('dev'),
    device_imei: '123456789012345',
    device_brand: 'Samsung',
    device_model: 'Galaxy A14',
    device_value_usd: 350,
    lock_status: 'unlocked',
    trustonic_enrolled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// =====================================================
// RESPONSE VALIDATORS
// =====================================================

/** Validate standard API success response */
export function expectSuccessResponse(response: APIGatewayProxyResult, statusCode = 200): void {
  expect(response.statusCode).toBe(statusCode);
  expect(response.headers).toHaveProperty('Content-Type', 'application/json');
  const body = parseResponseBody(response);
  expect(body).toBeDefined();
}

/** Validate standard API error response */
export function expectErrorResponse(response: APIGatewayProxyResult, statusCode: number): void {
  expect(response.statusCode).toBe(statusCode);
  const body = parseResponseBody(response);
  expect(body).toHaveProperty('error');
}

/** Validate CORS headers */
export function expectCORSHeaders(response: APIGatewayProxyResult): void {
  expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
}

// =====================================================
// TIMING UTILITIES
// =====================================================

/** Wait for a specified duration (ms) */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Measure execution time of an async function */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}
