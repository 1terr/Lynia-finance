import {
  emailSchema,
  phoneSchema,
  uuidSchema,
  currencyAmountSchema,
  paginationSchema,
  imeiSchema,
  zimbabweNationalIdSchema,
} from '@/lib/validation/schemas';

describe('emailSchema', () => {
  it('accepts valid emails', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
    expect(emailSchema.safeParse('admin@lynia.co.zw').success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('missing@').success).toBe(false);
    expect(emailSchema.safeParse('@no-user.com').success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('accepts valid Zimbabwe phone numbers', () => {
    expect(phoneSchema.safeParse('+263771234567').success).toBe(true);
    expect(phoneSchema.safeParse('+263712345678').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(phoneSchema.safeParse('').success).toBe(false);
  });

  it('rejects non-Zimbabwe format', () => {
    expect(phoneSchema.safeParse('0771234567').success).toBe(false);
    expect(phoneSchema.safeParse('+1234567890').success).toBe(false);
    expect(phoneSchema.safeParse('+26377123456').success).toBe(false); // too short
    expect(phoneSchema.safeParse('+2637712345678').success).toBe(false); // too long
  });
});

describe('uuidSchema', () => {
  it('accepts valid UUIDs', () => {
    expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(uuidSchema.safeParse('').success).toBe(false);
  });
});

describe('currencyAmountSchema', () => {
  it('accepts valid amounts', () => {
    expect(currencyAmountSchema.safeParse(100).success).toBe(true);
    expect(currencyAmountSchema.safeParse(0.01).success).toBe(true);
    expect(currencyAmountSchema.safeParse(999.99).success).toBe(true);
  });

  it('rejects zero and negative amounts', () => {
    expect(currencyAmountSchema.safeParse(0).success).toBe(false);
    expect(currencyAmountSchema.safeParse(-10).success).toBe(false);
  });

  it('rejects amounts with more than 2 decimal places', () => {
    expect(currencyAmountSchema.safeParse(10.001).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('applies defaults', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(25);
  });

  it('rejects page < 1', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects limit > 100', () => {
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('imeiSchema', () => {
  it('accepts valid 15-digit IMEI', () => {
    expect(imeiSchema.safeParse('123456789012345').success).toBe(true);
  });

  it('rejects non-15-digit strings', () => {
    expect(imeiSchema.safeParse('12345').success).toBe(false);
    expect(imeiSchema.safeParse('1234567890123456').success).toBe(false);
    expect(imeiSchema.safeParse('12345678901234a').success).toBe(false);
  });
});

describe('zimbabweNationalIdSchema', () => {
  it('accepts valid Zimbabwe national IDs', () => {
    expect(zimbabweNationalIdSchema.safeParse('63-123456A78').success).toBe(true);
    expect(zimbabweNationalIdSchema.safeParse('08-1234567B12').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(zimbabweNationalIdSchema.safeParse('').success).toBe(false);
  });

  it('rejects invalid formats', () => {
    expect(zimbabweNationalIdSchema.safeParse('12345678A90').success).toBe(false);
    expect(zimbabweNationalIdSchema.safeParse('63-12345a78').success).toBe(false); // lowercase letter
  });
});
