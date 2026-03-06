/**
 * Property-based tests for IMEI validation.
 * Tests: IMEI_REGEX from services/admin-service/src/handlers/inventory-devices.ts
 */

import fc from 'fast-check';

// Same regex used in inventory-devices.ts line 10
const IMEI_REGEX = /^\d{15}$/;

/** Generate a string of N random digits */
function arbDigitString(length: number): fc.Arbitrary<string> {
  return fc.tuple(
    ...Array.from({ length }, () => fc.integer({ min: 0, max: 9 }))
  ).map(digits => digits.join(''));
}

describe('IMEI Validation - property tests', () => {
  it('accepts any 15-digit numeric string', () => {
    fc.assert(
      fc.property(arbDigitString(15), (imei) => {
        expect(IMEI_REGEX.test(imei)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('rejects strings shorter than 15 digits', () => {
    const shortLength = fc.integer({ min: 1, max: 14 });

    fc.assert(
      fc.property(shortLength, (len) => {
        const s = '1'.repeat(len);
        expect(IMEI_REGEX.test(s)).toBe(false);
      }),
      { numRuns: 14 }
    );
  });

  it('rejects strings longer than 15 digits', () => {
    const longLength = fc.integer({ min: 16, max: 25 });

    fc.assert(
      fc.property(longLength, (len) => {
        const s = '9'.repeat(len);
        expect(IMEI_REGEX.test(s)).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it('rejects 15-character strings containing non-digit characters', () => {
    // Insert a non-digit character at a random position in a 15-digit string
    const badImei = fc.tuple(
      fc.integer({ min: 0, max: 14 }),           // position
      fc.string({ minLength: 1, maxLength: 1 }).filter((c: string) => !/\d/.test(c)), // non-digit char
    ).map(([pos, badChar]) => {
      const digits = '123456789012345';
      return digits.substring(0, pos) + badChar + digits.substring(pos + 1);
    });

    fc.assert(
      fc.property(badImei, (s) => {
        expect(IMEI_REGEX.test(s)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects empty string', () => {
    expect(IMEI_REGEX.test('')).toBe(false);
  });

  it('rejects strings with leading/trailing whitespace', () => {
    const paddedDigits = fc.tuple(
      fc.constantFrom(' ', '\t', '\n'),
      arbDigitString(15),
      fc.constantFrom(' ', '\t', '\n', '')
    ).map(([pre, digits, post]) => `${pre}${digits}${post}`);

    fc.assert(
      fc.property(paddedDigits, (s) => {
        expect(IMEI_REGEX.test(s)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
