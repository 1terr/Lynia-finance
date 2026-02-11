import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyDetailed(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function truncateId(id: string, length = 8): string {
  return id.length > length ? `${id.slice(0, length)}...` : id;
}

/**
 * Mask phone numbers for display. Shows first 4 and last 3 digits.
 * Example: +263771234567 -> +263****567
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length <= 7) return cleaned;
  return cleaned.slice(0, 4) + '****' + cleaned.slice(-3);
}

/**
 * Mask national IDs for display. Shows first 2 and last 2 characters.
 * Example: 12345678A90 -> 12******90
 */
export function maskId(id: string): string {
  if (!id || id.length < 5) return id;
  return id.slice(0, 2) + '******' + id.slice(-2);
}

/**
 * Sanitize search input to prevent PostgREST filter injection.
 * Strips characters that have special meaning in PostgREST filter syntax.
 */
export function sanitizeSearchInput(search: string): string {
  return search.replace(/[.,()\\]/g, '').trim();
}

/** Maximum page size for paginated queries */
export const MAX_PAGE_SIZE = 100;
