import { z } from 'zod';

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format');

export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .regex(/^\+263\d{9}$/, 'Phone must be in format +263XXXXXXXXX');

export const uuidSchema = z
  .string()
  .uuid('Invalid ID format');

export const currencyAmountSchema = z
  .number()
  .positive('Amount must be greater than 0')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places');

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
});

export const imeiSchema = z
  .string()
  .regex(/^\d{15}$/, 'IMEI must be exactly 15 digits');

export const zimbabweNationalIdSchema = z
  .string()
  .min(1, 'National ID is required')
  .regex(/^\d{2}-\d{6,7}[A-Z]\d{2}$/, 'Invalid Zimbabwe National ID format');
