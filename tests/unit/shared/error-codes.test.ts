import {
  ERROR_CODES,
  createErrorResponse,
} from '../../../services/shared/utils/error-codes';

describe('Error Codes', () => {
  it('all codes follow SERVICE_CATEGORY_CODE format', () => {
    const values = Object.values(ERROR_CODES);
    for (const code of values) {
      expect(code).toMatch(/^[A-Z]+_[A-Z0-9]+_\d{3}$/);
    }
  });

  it('has no duplicate error code values', () => {
    const values = Object.values(ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  it('includes all required service prefixes', () => {
    const values = Object.values(ERROR_CODES);
    const prefixes = new Set(values.map(v => v.split('_')[0]));
    expect(prefixes).toContain('AUTH');
    expect(prefixes).toContain('LOAN');
    expect(prefixes).toContain('PAY');
    expect(prefixes).toContain('KYC');
    expect(prefixes).toContain('DEV');
    expect(prefixes).toContain('VAL');
  });
});

describe('createErrorResponse', () => {
  it('returns a valid ErrorResponse shape', () => {
    const response = createErrorResponse(ERROR_CODES.AUTH_INVALID_TOKEN, 'Invalid token');
    expect(response).toHaveProperty('success', false);
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
    expect(response.error).toHaveProperty('requestId');
    expect(response.error).toHaveProperty('timestamp');
  });

  it('includes the provided error code', () => {
    const response = createErrorResponse(ERROR_CODES.PAY_TIMEOUT, 'Payment timed out');
    expect(response.error.code).toBe('PAY_TIME_001');
  });

  it('includes timestamp in ISO format', () => {
    const response = createErrorResponse(ERROR_CODES.LOAN_KYC_PENDING, 'KYC pending');
    // ISO 8601: e.g. 2024-02-15T10:30:00.000Z
    expect(response.error.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
    );
  });

  it('uses "unknown" when requestId not provided', () => {
    const response = createErrorResponse(ERROR_CODES.VAL_REQUIRED_FIELD, 'Field required');
    expect(response.error.requestId).toBe('unknown');
  });

  it('includes requestId when provided', () => {
    const response = createErrorResponse(
      ERROR_CODES.DEV_NOT_FOUND,
      'Device not found',
      undefined,
      'req_abc123'
    );
    expect(response.error.requestId).toBe('req_abc123');
  });

  it('includes details when provided', () => {
    const details = { minimumScore: 350, currentScore: 280 };
    const response = createErrorResponse(
      ERROR_CODES.LOAN_INSUFFICIENT_SCORE,
      'Insufficient credit score',
      details
    );
    expect(response.error.details).toEqual(details);
  });

  it('omits details when not provided', () => {
    const response = createErrorResponse(ERROR_CODES.KYC_FACE_MISMATCH, 'Face mismatch');
    expect(response.error.details).toBeUndefined();
  });
});
