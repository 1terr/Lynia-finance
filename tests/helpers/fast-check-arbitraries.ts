/**
 * Fast-check arbitraries (generators) for Lynia Finance domain values.
 * Used across property-based tests.
 */

import fc from 'fast-check';
import type { KYCVerificationResult, KYCExtractedInfo } from '../../services/shared/types/kyc-provider';

// ─── Zimbabwe ID ───

/** Valid Zimbabwe ID: 2-digit district (01-99) + 6-7 digit reg + uppercase letter + 2-digit suffix */
export function arbZimbabweId(): fc.Arbitrary<string> {
  return fc.tuple(
    fc.integer({ min: 1, max: 99 }),    // district
    fc.integer({ min: 100000, max: 9999999 }), // 6-7 digit registration
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.integer({ min: 0, max: 99 })     // suffix
  ).map(([district, reg, letter, suffix]) =>
    `${String(district).padStart(2, '0')}-${reg}${letter}${String(suffix).padStart(2, '0')}`
  );
}

/** Strings that should fail Zimbabwe ID validation */
export function arbInvalidZimbabweId(): fc.Arbitrary<string> {
  return fc.oneof(
    fc.constant(''),                                         // empty
    fc.constant('ABC'),                                      // too short, no digits
    fc.constant('ABCDEFGHIJKLMNOPQRST'),                     // all letters
    fc.constant('12-12345A01'),                              // registration too short (5 digits)
    fc.constant('12-12345678901A01'),                        // registration too long (11 digits)
    fc.constant('12-1234567101'),                            // no letter separator
    fc.constant('12-123456701'),                             // no letter, wrong format
    fc.stringMatching(/^[!@#$%^&*()]{5,15}$/),              // special chars only
  );
}

// ─── IMEI ───

/** Valid 15-digit IMEI */
export function arbIMEI(): fc.Arbitrary<string> {
  return fc.stringMatching(/^\d{15}$/).filter(s => s.length === 15);
}

/** Invalid IMEIs: wrong length or non-numeric */
export function arbInvalidIMEI(): fc.Arbitrary<string> {
  return fc.oneof(
    fc.stringMatching(/^\d{1,14}$/),                         // too short
    fc.stringMatching(/^\d{16,20}$/),                        // too long
    fc.string({ minLength: 15, maxLength: 15 }).filter(s => !/^\d{15}$/.test(s)), // 15 chars but not all digits
    fc.constant(''),                                         // empty
  );
}

// ─── Phone Numbers ───

/** Valid Zimbabwe phone: +263 7X XXXX XXX */
export function arbPhoneNumberZW(): fc.Arbitrary<string> {
  return fc.tuple(
    fc.constantFrom('71', '73', '77', '78'),
    fc.stringMatching(/^\d{7}$/)
  ).map(([prefix, rest]) => `+263${prefix}${rest}`);
}

// ─── Financial ───

/** Loan amounts in cents-safe range */
export function arbLoanAmount(): fc.Arbitrary<number> {
  return fc.integer({ min: 50, max: 5000 });
}

/** Commission rates 1-20% */
export function arbCommissionRate(): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max: 20 });
}

// ─── KYC ───

export function arbKYCDecision(): fc.Arbitrary<'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW'> {
  return fc.constantFrom('APPROVED' as const, 'REJECTED' as const, 'MANUAL_REVIEW' as const);
}

/** Generate a full KYCVerificationResult with valid score ranges */
export function arbKYCVerificationResult(): fc.Arbitrary<KYCVerificationResult> {
  return fc.record({
    provider: fc.constant('didit' as const),
    provider_job_id: fc.uuid(),
    internal_job_id: fc.uuid(),
    confidence_score: fc.float({ min: 0, max: 100, noNaN: true }),
    face_match_score: fc.float({ min: 0, max: 100, noNaN: true }),
    liveness_score: fc.float({ min: 0, max: 100, noNaN: true }),
    liveness_passed: fc.boolean(),
    document_authentic: fc.boolean(),
    document_tampered: fc.boolean(),
    document_expired: fc.boolean(),
    match_result: fc.constantFrom('verified' as const, 'not_verified' as const, 'manual_review' as const),
    id_info: fc.record({
      full_name: fc.string({ minLength: 2, maxLength: 50 }),
      id_number: arbZimbabweId(),
      date_of_birth: fc.tuple(
        fc.integer({ min: 1940, max: 2005 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 })
      ).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`),
      gender: fc.constantFrom('M' as const, 'F' as const, null),
      nationality: fc.constantFrom('ZW', null),
      document_type: fc.constantFrom('national_id', 'passport'),
    }) as fc.Arbitrary<KYCExtractedInfo>,
    raw_response: fc.constant({} as Record<string, unknown>),
    warnings: fc.constant([]),
  });
}

// ─── Inventory ───

export function arbTransferStatus(): fc.Arbitrary<string> {
  return fc.constantFrom('requested', 'approved', 'in_transit', 'received', 'cancelled');
}

export function arbDeviceStatus(): fc.Arbitrary<string> {
  return fc.constantFrom(
    'in_stock', 'assigned', 'reserved', 'sold', 'returned',
    'repossessed', 'damaged', 'lost', 'written_off'
  );
}
