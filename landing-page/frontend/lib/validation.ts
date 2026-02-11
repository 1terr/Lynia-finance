/**
 * Server-side input validation for form submissions.
 *
 * Strict patterns for Zimbabwe phone numbers and basic sanitisation
 * to prevent injection attacks.
 */

/** Matches Zimbabwe mobile numbers: +263 7X XXX XXXX or 07X XXX XXXX */
const ZW_PHONE_RE = /^(\+?263|0)7[0-9]{8}$/;

/** Strip all whitespace/dashes so "07 71 234 567" → "0771234567" */
export function normalisePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '');
}

export function isValidPhone(phone: string): boolean {
  return ZW_PHONE_RE.test(normalisePhone(phone));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Basic string sanitisation — strip control chars, limit length */
export function sanitise(input: string, maxLength = 1000): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, maxLength);
}

/** Standard JSON error response helper */
export function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
}
