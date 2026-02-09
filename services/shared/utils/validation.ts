/**
 * Validation Utilities
 * Common validation functions for input data
 */

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  // Zimbabwe phone number format: +263 XXX XXX XXX or 0XXX XXX XXX
  const phoneRegex = /^(\+263|0)[0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidIMEI(imei: string): boolean {
  // IMEI is 15 digits
  const imeiRegex = /^[0-9]{15}$/;
  return imeiRegex.test(imei);
}

export function isValidNationalID(id: string): boolean {
  // Zimbabwe National ID format: XX-XXXXXXX X XX
  const nationalIdRegex = /^[0-9]{2}-[0-9]{7}[A-Z][0-9]{2}$/;
  return nationalIdRegex.test(id);
}

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

export function sanitizePhoneNumber(phone: string): string {
  // Remove spaces and convert to Zimbabwe format (+263XXXXXXXXX)
  let sanitized = phone.replace(/\s/g, '');

  if (sanitized.startsWith('0')) {
    sanitized = '+263' + sanitized.substring(1);
  } else if (!sanitized.startsWith('+')) {
    sanitized = '+263' + sanitized;
  }

  return sanitized;
}
