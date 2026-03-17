/**
 * Shared helpers for the Fineract Proxy Service handlers.
 *
 * Pure utility functions (date formatting, pagination clamping,
 * standard response wrappers, aging-bucket classification) plus
 * the row-level interfaces used across handler modules.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { parseFineractDate } from '../../../shared/clients/fineract';
import { getSecurityHeaders } from '../../../shared/utils/response';
import type { FineractDate } from '../../../shared/types/fineract';

// ============================================================
// CONSTANTS
// ============================================================

export const MAX_PAGE_SIZE = 100;

// ============================================================
// ROW INTERFACES
// ============================================================

export interface LyniaLoanRow {
  id: string;
  customer_id: string;
  loan_number: string;
  fineract_loan_id: number | null;
  fineract_product_id: number | null;
  outstanding_balance_usd: number;
  total_paid_usd: number;
  status: string;
  created_at: string;
}

export interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  fineract_client_id: number | null;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Convert Fineract [year, month, day] array to ISO date string */
export function fmtDate(date: FineractDate | undefined | null): string | null {
  if (!date || !Array.isArray(date) || date.length < 3) return null;
  const d = parseFineractDate(date);
  return d.toISOString().split('T')[0];
}

export function clampPage(raw: string | undefined, fallback: number, max: number): number {
  const n = parseInt(raw || '', 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback;
}

export function ok(data: unknown, event: APIGatewayProxyEvent): APIGatewayProxyResult {
  return { statusCode: 200, body: JSON.stringify(data), headers: getSecurityHeaders(event) };
}

export function err(status: number, message: string, event: APIGatewayProxyEvent, details?: unknown): APIGatewayProxyResult {
  const body: Record<string, unknown> = { success: false, error: message };
  if (details) body.details = details;
  return { statusCode: status, body: JSON.stringify(body), headers: getSecurityHeaders(event) };
}

export function getAgingBucket(daysPastDue: number): '1-30' | '31-60' | '61-90' | '90+' {
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  return '90+';
}
