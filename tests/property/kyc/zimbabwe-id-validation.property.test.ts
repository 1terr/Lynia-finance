/**
 * Property-based tests for Zimbabwe ID validation.
 * Tests: validateZimbabweIDNumber, extractZimbabweIDNumber
 * Source: services/kyc-service/src/image-processor.ts
 */

import fc from 'fast-check';
import { validateZimbabweIDNumber, extractZimbabweIDNumber } from '../../../services/kyc-service/src/image-processor';
import { arbZimbabweId, arbInvalidZimbabweId } from '../../helpers/fast-check-arbitraries';

describe('validateZimbabweIDNumber - property tests', () => {
  it('should accept any validly-formatted Zimbabwe ID', () => {
    fc.assert(
      fc.property(arbZimbabweId(), (id) => {
        const result = validateZimbabweIDNumber(id);
        expect(result.valid).toBe(true);
        expect(result.normalized).toBeDefined();
      }),
      { numRuns: 500 }
    );
  });

  it('should normalize to canonical format XX-XXXXXXX...AXX', () => {
    fc.assert(
      fc.property(arbZimbabweId(), (id) => {
        const result = validateZimbabweIDNumber(id);
        if (result.valid && result.normalized) {
          // Format: 2-digit district, hyphen, 6-7 digit reg + letter + 2-digit suffix
          expect(result.normalized).toMatch(/^\d{2}-\d{6,7}[A-Z]\d{2}$/);
        }
      }),
      { numRuns: 500 }
    );
  });

  it('should accept IDs regardless of separator style (hyphens, dots, spaces)', () => {
    const separators = ['-', '.', ' ', '/'];

    fc.assert(
      fc.property(arbZimbabweId(), fc.constantFrom(...separators), (id, sep) => {
        // Replace the canonical hyphen with a different separator
        const modified = id.replace('-', sep);
        const result = validateZimbabweIDNumber(modified);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 300 }
    );
  });

  it('should accept IDs with no separator at all', () => {
    fc.assert(
      fc.property(arbZimbabweId(), (id) => {
        const noSep = id.replace('-', '');
        const result = validateZimbabweIDNumber(noSep);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 300 }
    );
  });

  it('should be idempotent: normalizing a normalized ID returns the same result', () => {
    fc.assert(
      fc.property(arbZimbabweId(), (id) => {
        const first = validateZimbabweIDNumber(id);
        if (first.valid && first.normalized) {
          const second = validateZimbabweIDNumber(first.normalized);
          expect(second.valid).toBe(true);
          expect(second.normalized).toBe(first.normalized);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('should reject strings that do not match the ID pattern', () => {
    fc.assert(
      fc.property(arbInvalidZimbabweId(), (bad) => {
        const result = validateZimbabweIDNumber(bad);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 200 }
    );
  });

  it('should handle case insensitively and uppercase the letter', () => {
    fc.assert(
      fc.property(arbZimbabweId(), (id) => {
        const lower = id.toLowerCase();
        const result = validateZimbabweIDNumber(lower);
        expect(result.valid).toBe(true);
        if (result.normalized) {
          // The letter should be uppercase in normalized form
          expect(result.normalized).toMatch(/[A-Z]/);
        }
      }),
      { numRuns: 200 }
    );
  });
});

describe('extractZimbabweIDNumber - property tests', () => {
  it('should extract a valid ID embedded in surrounding text', () => {
    fc.assert(
      fc.property(
        arbZimbabweId(),
        fc.string({ minLength: 0, maxLength: 20 }).filter(s => !/\d{8,}/.test(s)),
        fc.string({ minLength: 0, maxLength: 20 }).filter(s => !/\d{8,}/.test(s)),
        (id, prefix, suffix) => {
          const text = `${prefix} ${id} ${suffix}`;
          const extracted = extractZimbabweIDNumber(text);
          expect(extracted).not.toBeNull();
          // The extracted ID should normalize to the same canonical form
          if (extracted) {
            const extractedNorm = validateZimbabweIDNumber(extracted);
            const originalNorm = validateZimbabweIDNumber(id);
            expect(extractedNorm.normalized).toBe(originalNorm.normalized);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should return null for text with no valid ID pattern', () => {
    const noIdText = fc.string({ minLength: 0, maxLength: 50 })
      .filter(s => !/\d{2}-?\d{6,7}[A-Za-z]\d{2}/.test(s) && !/\d{8,9}[A-Za-z]\d{2}/.test(s));

    fc.assert(
      fc.property(noIdText, (text) => {
        const result = extractZimbabweIDNumber(text);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });
});
