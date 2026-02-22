import { z } from 'zod';

/**
 * Zimbabwe phone number validation
 * Format: +263XXXXXXXXX (9 digits after country code)
 * Example: +263771234567
 */
export const phoneSchema = z
  .string()
  .regex(/^\+263\d{9}$/, 'Phone must be +263 followed by 9 digits')
  .or(z.literal('')) // Allow empty string
  .optional();

/**
 * Zimbabwe national ID validation
 * Format: XX-XXXXXXX(A-Z)XX
 * Example: 12-3456789A90
 */
export const nationalIdSchema = z
  .string()
  .regex(/^\d{2}-\d{6,7}[A-Z]\d{2}$/, 'Invalid national ID format (XX-XXXXXXXYY)');

/**
 * IMEI validation (for device registration)
 * Format: 15 digits
 * Example: 353456789012345
 */
export const imeiSchema = z
  .string()
  .length(15, 'IMEI must be exactly 15 digits')
  .regex(/^\d{15}$/, 'IMEI must contain only digits');

/**
 * Address validation
 * Minimum 5 characters for meaningful address
 */
export const addressSchema = z
  .string()
  .min(5, 'Address must be at least 5 characters')
  .max(200, 'Address too long')
  .or(z.literal(''))
  .optional();

/**
 * Bank account number validation
 * Flexible format, minimum 5 digits
 */
export const accountNumberSchema = z
  .string()
  .min(5, 'Account number must be at least 5 characters')
  .max(50, 'Account number too long')
  .or(z.literal(''))
  .optional();

/**
 * Bank name validation
 * Common banks in Zimbabwe: CBZ, Stanbic, Steward, FBC, etc.
 */
export const bankNameSchema = z
  .string()
  .min(2, 'Bank name too short')
  .max(100, 'Bank name too long')
  .or(z.literal(''))
  .optional();

/**
 * Profile update form schema
 * Used for distributor profile editing
 */
export const profileSchema = z.object({
  phone_number: phoneSchema,
  address: addressSchema,
  mobile_money_number: phoneSchema,
  bank_name: bankNameSchema,
  account_number: accountNumberSchema,
});

/**
 * Type inference from profile schema
 */
export type ProfileFormData = z.infer<typeof profileSchema>;

/**
 * Customer identity verification schema
 * Used in handover wizard step 2
 */
export const identityVerificationSchema = z.object({
  customer_national_id: nationalIdSchema,
});

export type IdentityVerificationData = z.infer<typeof identityVerificationSchema>;

/**
 * Device verification schema
 * Used in handover wizard step 3
 */
export const deviceVerificationSchema = z.object({
  device_imei: imeiSchema,
});

export type DeviceVerificationData = z.infer<typeof deviceVerificationSchema>;
