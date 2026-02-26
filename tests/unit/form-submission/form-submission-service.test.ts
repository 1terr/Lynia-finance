/**
 * Characterization tests for Form Submission Service
 *
 * These tests capture the CURRENT behavior of the form submission handler.
 * The service handles three form types: contact, partnership, and waitlist.
 * It is a public endpoint (no Cognito authorizer) that accepts POST requests
 * with a `type` discriminator field.
 *
 * Target: services/form-submission-service/src/index.ts (174 lines)
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

// ── Mocks (must be declared before handler import) ────────────────────

const mockExecute = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../../../services/shared/clients/database', () => {
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = [
      'select', 'insert', 'update', 'delete',
      'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is',
      'order', 'limit', 'single', 'maybeSingle',
    ];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: {
      from: jest.fn().mockImplementation(() => createChain()),
    },
  };
});

const mockIsValidEmail = jest.fn().mockReturnValue(true);
const mockIsValidPhoneNumber = jest.fn().mockReturnValue(true);
const mockSanitizePhoneNumber = jest.fn().mockImplementation((phone: string) => phone);

jest.mock('../../../services/shared/utils/validation', () => ({
  isValidEmail: (...args: unknown[]) => mockIsValidEmail(...args),
  isValidPhoneNumber: (...args: unknown[]) => mockIsValidPhoneNumber(...args),
  sanitizePhoneNumber: (...args: unknown[]) => mockSanitizePhoneNumber(...args),
}));

// Use REAL response implementations
jest.mock('../../../services/shared/utils/response', () => {
  const actual = jest.requireActual('../../../services/shared/utils/response');
  return actual;
});

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Import handler AFTER mocks ────────────────────────────────────────

import { handler } from '../../../services/form-submission-service/src/index';

// ── Helpers ───────────────────────────────────────────────────────────

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/forms/submit',
    body: null,
    headers: { origin: 'https://lyniafinance.com' },
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '/forms/submit',
    isBase64Encoded: false,
    ...overrides,
  };
}

function parseBody(result: { body: string }) {
  return JSON.parse(result.body);
}

// ── Setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockIsValidEmail.mockReturnValue(true);
  mockIsValidPhoneNumber.mockReturnValue(true);
  mockSanitizePhoneNumber.mockImplementation((phone: string) => phone);
  mockExecute.mockResolvedValue({ data: null, error: null });
});

// =====================================================================
// General request handling
// =====================================================================

describe('Form Submission Service — general', () => {
  it('should return 204 for OPTIONS (CORS preflight)', async () => {
    const event = createEvent({ httpMethod: 'OPTIONS' });
    const result = await handler(event);
    expect(result.statusCode).toBe(204);
    const body = parseBody(result);
    expect(body.success).toBe(true);
  });

  it('should return 405 for GET requests', async () => {
    const event = createEvent({ httpMethod: 'GET' });
    const result = await handler(event);
    expect(result.statusCode).toBe(405);
    const body = parseBody(result);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Method not allowed');
  });

  it('should return 400 for invalid JSON body', async () => {
    const event = createEvent({ body: '{invalid json!!!' });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('Invalid JSON body');
  });

  it('should return 400 when type is missing', async () => {
    const event = createEvent({ body: JSON.stringify({}) });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('Invalid form type');
  });

  it('should return 400 when type is empty string', async () => {
    const event = createEvent({ body: JSON.stringify({ type: '' }) });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('Invalid form type');
  });

  it('should return 400 for unknown form type', async () => {
    const event = createEvent({ body: JSON.stringify({ type: 'newsletter' }) });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('Invalid form type');
  });
});

// =====================================================================
// Contact form
// =====================================================================

describe('Form Submission Service — contact form', () => {
  const validContact = {
    type: 'contact',
    name: 'John Doe',
    phone: '+263771234567',
    email: 'john@example.com',
    message: 'I would like more information about your services.',
  };

  it('should return 200 for valid contact submission', async () => {
    const event = createEvent({ body: JSON.stringify(validContact) });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
  });

  it('should return 400 when name is missing', async () => {
    const event = createEvent({
      body: JSON.stringify({ ...validContact, name: undefined }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('Name is required');
  });

  it('should return 400 when name is empty string', async () => {
    const event = createEvent({
      body: JSON.stringify({ ...validContact, name: '   ' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('Name is required');
  });

  it('should return 400 when phone is invalid', async () => {
    mockIsValidPhoneNumber.mockReturnValue(false);
    const event = createEvent({
      body: JSON.stringify({ ...validContact, phone: 'bad-phone' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('valid Zimbabwe phone number');
  });

  it('should return 400 when email is provided but invalid', async () => {
    mockIsValidEmail.mockReturnValue(false);
    const event = createEvent({
      body: JSON.stringify({ ...validContact, email: 'not-an-email' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('Invalid email address');
  });

  it('should accept empty email (optional field)', async () => {
    const event = createEvent({
      body: JSON.stringify({ ...validContact, email: undefined }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
  });

  it('should return 500 when DB insert fails', async () => {
    mockExecute.mockResolvedValueOnce({
      data: null,
      error: { message: 'Connection refused' },
    });
    const event = createEvent({ body: JSON.stringify(validContact) });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
    const body = parseBody(result);
    expect(body.error).toContain('Failed to save your message');
  });
});

// =====================================================================
// Partnership form
// =====================================================================

describe('Form Submission Service — partnership form', () => {
  const validPartnership = {
    type: 'partnership',
    name: 'Jane Smith',
    phone: '+263772345678',
    email: 'jane@company.com',
    partner_type: 'distributor',
    message: 'Interested in partnership opportunities.',
  };

  it('should return 200 for valid partnership submission', async () => {
    const event = createEvent({ body: JSON.stringify(validPartnership) });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
  });

  it('should return 400 when name is missing', async () => {
    const event = createEvent({
      body: JSON.stringify({ ...validPartnership, name: undefined }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('Name is required');
  });

  it('should return 400 when email is missing', async () => {
    const event = createEvent({
      body: JSON.stringify({ ...validPartnership, email: undefined }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('valid email address is required');
  });

  it('should return 400 when email is invalid', async () => {
    mockIsValidEmail.mockReturnValue(false);
    const event = createEvent({
      body: JSON.stringify({ ...validPartnership, email: 'bad' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('valid email address is required');
  });

  it('should return 400 when partner_type is invalid', async () => {
    const event = createEvent({
      body: JSON.stringify({ ...validPartnership, partner_type: 'invalid-type' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('valid partnership type');
  });

  it('should accept all valid partner types (b2b)', async () => {
    const event = createEvent({
      body: JSON.stringify({ ...validPartnership, partner_type: 'b2b' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  it('should accept all valid partner types (other)', async () => {
    const event = createEvent({
      body: JSON.stringify({ ...validPartnership, partner_type: 'other' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  it('should return 500 when DB insert fails', async () => {
    mockExecute.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB write error' },
    });
    const event = createEvent({ body: JSON.stringify(validPartnership) });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
    const body = parseBody(result);
    expect(body.error).toContain('Failed to save your application');
  });
});

// =====================================================================
// Waitlist form
// =====================================================================

describe('Form Submission Service — waitlist form', () => {
  const validWaitlist = {
    type: 'waitlist',
    phone: '+263773456789',
  };

  it('should return 200 for valid waitlist submission', async () => {
    const event = createEvent({ body: JSON.stringify(validWaitlist) });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
  });

  it('should return 400 when phone is invalid', async () => {
    mockIsValidPhoneNumber.mockReturnValue(false);
    const event = createEvent({
      body: JSON.stringify({ ...validWaitlist, phone: 'bad' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = parseBody(result);
    expect(body.error).toContain('valid Zimbabwe phone number');
  });

  it('should return 200 (silent success) for duplicate phone', async () => {
    mockExecute.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    });
    const event = createEvent({ body: JSON.stringify(validWaitlist) });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = parseBody(result);
    expect(body.success).toBe(true);
  });

  it('should return 500 for non-duplicate DB error', async () => {
    mockExecute.mockResolvedValueOnce({
      data: null,
      error: { message: 'Connection timeout' },
    });
    const event = createEvent({ body: JSON.stringify(validWaitlist) });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
    const body = parseBody(result);
    expect(body.error).toContain('Failed to save');
  });
});
