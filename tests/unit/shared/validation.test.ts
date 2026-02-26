/**
 * Characterization tests for services/shared/utils/validation.ts
 *
 * Validates phone numbers, emails, UUIDs, IMEI numbers, and national IDs.
 * Wrong validation = accepting fraudulent documents or rejecting legitimate customers.
 */

import {
  isValidEmail,
  isValidPhoneNumber,
  isValidUUID,
  isValidIMEI,
  isValidNationalID,
  validateRequired,
  sanitizePhoneNumber,
  validateZimbabwePhoneNumber,
} from '../../../services/shared/utils/validation';

describe('validation utilities', () => {
  // ─── isValidEmail ─────────────────────────────────────────────
  describe('isValidEmail', () => {
    it('should accept standard email', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('should accept email with subdomain', () => {
      expect(isValidEmail('admin@mail.lynia.co.zw')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(isValidEmail('notanemail')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('should reject email with spaces', () => {
      expect(isValidEmail('user @example.com')).toBe(false);
    });
  });

  // ─── isValidPhoneNumber ───────────────────────────────────────
  describe('isValidPhoneNumber', () => {
    it('should accept +263 prefixed number', () => {
      expect(isValidPhoneNumber('+263771234567')).toBe(true);
    });

    it('should accept 0-prefixed number', () => {
      expect(isValidPhoneNumber('0771234567')).toBe(true);
    });

    it('should accept number with spaces (stripped internally)', () => {
      expect(isValidPhoneNumber('+263 77 123 4567')).toBe(true);
    });

    it('should reject non-Zimbabwe number', () => {
      expect(isValidPhoneNumber('+1234567890')).toBe(false);
    });

    it('should reject too short number', () => {
      expect(isValidPhoneNumber('+26377123')).toBe(false);
    });

    it('should reject too long number', () => {
      expect(isValidPhoneNumber('+2637712345678')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidPhoneNumber('')).toBe(false);
    });

    it('should reject alphabetic characters', () => {
      expect(isValidPhoneNumber('+263abcdefgh')).toBe(false);
    });

    it('should reject non-mobile Zimbabwe number (landline prefix 24)', () => {
      expect(isValidPhoneNumber('+263241234567')).toBe(false);
    });

    it('should reject Zimbabwe number with invalid mobile prefix (79)', () => {
      expect(isValidPhoneNumber('+263791234567')).toBe(false);
    });

    it('should accept number with dashes (stripped internally)', () => {
      expect(isValidPhoneNumber('+263-77-123-4567')).toBe(true);
    });

    it('should accept number with parentheses (stripped internally)', () => {
      expect(isValidPhoneNumber('+263(77)1234567')).toBe(true);
    });

    it('should accept all valid mobile prefixes (71-78)', () => {
      expect(isValidPhoneNumber('+263711234567')).toBe(true);
      expect(isValidPhoneNumber('+263721234567')).toBe(true);
      expect(isValidPhoneNumber('+263731234567')).toBe(true);
      expect(isValidPhoneNumber('+263741234567')).toBe(true);
      expect(isValidPhoneNumber('+263751234567')).toBe(true);
      expect(isValidPhoneNumber('+263761234567')).toBe(true);
      expect(isValidPhoneNumber('+263771234567')).toBe(true);
      expect(isValidPhoneNumber('+263781234567')).toBe(true);
    });
  });

  // ─── validateZimbabwePhoneNumber ────────────────────────────────
  describe('validateZimbabwePhoneNumber', () => {
    it('should return valid with normalized +263 format for +263 number', () => {
      const result = validateZimbabwePhoneNumber('+263771234567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });

    it('should normalize 0-prefixed number to +263', () => {
      const result = validateZimbabwePhoneNumber('0771234567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });

    it('should normalize 263 without + prefix', () => {
      const result = validateZimbabwePhoneNumber('263771234567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });

    it('should reject non-Zimbabwean number with message', () => {
      const result = validateZimbabwePhoneNumber('+1234567890');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('non_zimbabwean_number');
    });

    it('should reject invalid Zimbabwe mobile with message', () => {
      const result = validateZimbabwePhoneNumber('026377123');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('invalid_zimbabwe_mobile');
    });

    it('should strip spaces and dashes before validation', () => {
      const result = validateZimbabwePhoneNumber('+263 77 123 4567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });

    it('should strip parentheses before validation', () => {
      const result = validateZimbabwePhoneNumber('+263(77)1234567');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+263771234567');
    });
  });

  // ─── isValidUUID ──────────────────────────────────────────────
  describe('isValidUUID', () => {
    it('should accept valid v4 UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should accept lowercase UUID', () => {
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should reject invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('should reject UUID without hyphens', () => {
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });
  });

  // ─── isValidIMEI ──────────────────────────────────────────────
  describe('isValidIMEI', () => {
    it('should accept 15-digit IMEI', () => {
      expect(isValidIMEI('123456789012345')).toBe(true);
    });

    it('should reject IMEI with less than 15 digits', () => {
      expect(isValidIMEI('12345678901234')).toBe(false);
    });

    it('should reject IMEI with more than 15 digits', () => {
      expect(isValidIMEI('1234567890123456')).toBe(false);
    });

    it('should reject IMEI with letters', () => {
      expect(isValidIMEI('12345678901234A')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidIMEI('')).toBe(false);
    });
  });

  // ─── isValidNationalID ────────────────────────────────────────
  describe('isValidNationalID', () => {
    it('should accept valid Zimbabwe national ID format', () => {
      expect(isValidNationalID('12-3456789A01')).toBe(true);
    });

    it('should accept another valid ID', () => {
      expect(isValidNationalID('63-2345678B99')).toBe(true);
    });

    it('should reject ID without hyphen', () => {
      expect(isValidNationalID('123456789A01')).toBe(false);
    });

    it('should reject ID with lowercase letter', () => {
      expect(isValidNationalID('12-3456789a01')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidNationalID('')).toBe(false);
    });

    it('should reject random string', () => {
      expect(isValidNationalID('abc-defghij')).toBe(false);
    });
  });

  // ─── validateRequired ─────────────────────────────────────────
  describe('validateRequired', () => {
    it('should pass when all required fields are present', () => {
      const data = { name: 'John', email: 'john@test.com' };
      const result = validateRequired(data, ['name', 'email']);

      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should fail when required field is missing', () => {
      const data = { name: 'John' };
      const result = validateRequired(data, ['name', 'email']);

      expect(result.valid).toBe(false);
      expect(result.errors.email).toBe('email is required');
    });

    it('should fail when required field is empty string', () => {
      const data = { name: '  ', email: 'john@test.com' };
      const result = validateRequired(data as Record<string, unknown>, ['name', 'email']);

      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe('name is required');
    });

    it('should report multiple missing fields', () => {
      const data = {};
      const result = validateRequired(data, ['name', 'email', 'phone']);

      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors)).toHaveLength(3);
    });
  });

  // ─── sanitizePhoneNumber ──────────────────────────────────────
  describe('sanitizePhoneNumber', () => {
    it('should convert 0-prefixed to +263', () => {
      expect(sanitizePhoneNumber('0771234567')).toBe('+263771234567');
    });

    it('should keep +263 prefix as is', () => {
      expect(sanitizePhoneNumber('+263771234567')).toBe('+263771234567');
    });

    it('should add +263 to bare number', () => {
      expect(sanitizePhoneNumber('771234567')).toBe('+263771234567');
    });

    it('should strip spaces', () => {
      expect(sanitizePhoneNumber('077 123 4567')).toBe('+263771234567');
    });

    it('should strip dashes', () => {
      expect(sanitizePhoneNumber('077-123-4567')).toBe('+263771234567');
    });

    it('should strip parentheses', () => {
      expect(sanitizePhoneNumber('0(77)1234567')).toBe('+263771234567');
    });
  });
});
