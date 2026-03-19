/**
 * Validation Utilities
 * Common validation functions for input data
 */

/**
 * Validate an email address format.
 *
 * @param email - Email string to validate
 * @returns True if the email matches a basic RFC-like pattern
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check whether a phone number matches Zimbabwe mobile format.
 *
 * @param phone - Phone string (e.g. '+263771234567' or '0771234567')
 * @returns True if the number matches a valid Zimbabwe mobile pattern
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Zimbabwe mobile number: +263 7X XXX XXXX or 07X XXX XXXX (carrier prefixes 71-78)
  const phoneRegex = /^(\+263|0)(7[1-8]\d{7})$/;
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
}

/**
 * Validate Zimbabwe phone number with structured result.
 *
 * Valid formats: +263 77 123 4567, 263771234567, 0771234567
 * Valid mobile prefixes: 71, 73, 74, 77, 78 (Econet, NetOne, Telecel)
 */
export function validateZimbabwePhoneNumber(phoneNumber: string): {
  valid: boolean;
  normalized?: string;
  message?: string;
} {
  // Remove spaces, dashes, and parentheses
  const normalized = phoneNumber.replace(/[\s\-()]/g, '');

  // Zimbabwe mobile number pattern
  const mobilePattern = /^(\+?263|0)(7[1-8]{1}\d{7})$/;

  if (!mobilePattern.test(normalized)) {
    // Check if it's a non-Zimbabwean number
    if (!normalized.startsWith('+263') && !normalized.startsWith('263') && !normalized.startsWith('0')) {
      return {
        valid: false,
        message: 'non_zimbabwean_number'
      };
    }

    return {
      valid: false,
      message: 'invalid_zimbabwe_mobile'
    };
  }

  // Normalize to international format
  let normalizedPhone = normalized;
  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = '+263' + normalizedPhone.substring(1);
  } else if (normalizedPhone.startsWith('263')) {
    normalizedPhone = '+' + normalizedPhone;
  }

  return {
    valid: true,
    normalized: normalizedPhone
  };
}

/**
 * Validate a UUID v1-v5 string.
 *
 * @param uuid - UUID string to validate
 * @returns True if the string is a valid UUID
 */
export function isValidUUID(uuid: string): boolean {
  // Accept any 8-4-4-4-12 hex string — matches what PostgreSQL's UUID type accepts
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate a 15-digit IMEI number.
 *
 * @param imei - IMEI string to validate
 * @returns True if the string is exactly 15 digits
 */
export function isValidIMEI(imei: string): boolean {
  // IMEI is 15 digits
  const imeiRegex = /^[0-9]{15}$/;
  return imeiRegex.test(imei);
}

/**
 * Validate a Zimbabwe National ID (format: XX-XXXXXXXAXX).
 *
 * @param id - National ID string to validate
 * @returns True if the ID matches the Zimbabwe national ID pattern
 */
export function isValidNationalID(id: string): boolean {
  // Zimbabwe National ID format: XX-XXXXXXX X XX
  const nationalIdRegex = /^[0-9]{2}-[0-9]{7}[A-Z][0-9]{2}$/;
  return nationalIdRegex.test(id);
}

/**
 * Check that all required fields are present and non-empty.
 *
 * @param data - Object to validate
 * @param requiredFields - List of field names that must exist and be non-empty
 * @returns Object with `valid` flag and a map of field-level errors
 */
export function validateRequired(
  data: Record<string, unknown>,
  requiredFields: string[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      errors[field] = `${field} is required`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Normalize a phone number to Zimbabwe international format (+263XXXXXXXXX).
 *
 * @param phone - Raw phone string (local or international)
 * @returns Phone number in +263 format
 */
export function sanitizePhoneNumber(phone: string): string {
  // Remove spaces, dashes, and parentheses, then convert to Zimbabwe format (+263XXXXXXXXX)
  let sanitized = phone.replace(/[\s\-()]/g, '');

  if (sanitized.startsWith('0')) {
    sanitized = '+263' + sanitized.substring(1);
  } else if (!sanitized.startsWith('+')) {
    sanitized = '+263' + sanitized;
  }

  return sanitized;
}
