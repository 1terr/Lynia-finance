/**
 * Currency formatting utilities.
 */
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

/**
 * Date formatting utilities.
 */
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

/**
 * Number formatting utilities.
 */
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
 * KYC confidence level helper.
 * Maps a numerical confidence score to a label and color for Badge display.
 */
export function getConfidenceLevel(score: number | null | undefined): {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
} {
  if (score == null) return { label: 'N/A', color: 'gray' };
  if (score >= 85) return { label: 'High', color: 'green' };
  if (score >= 50) return { label: 'Medium', color: 'yellow' };
  return { label: 'Low', color: 'red' };
}

/**
 * SLA status helper for KYC review deadlines.
 * Calculates time remaining until the SLA deadline and returns display info.
 */
export function getSLAStatus(deadline: string): {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
  hoursRemaining: number;
  isExpired: boolean;
} {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const hoursRemaining = diffMs / (1000 * 60 * 60);

  if (hoursRemaining <= 0) {
    const hoursOverdue = Math.abs(Math.round(hoursRemaining));
    return { label: `${hoursOverdue}h overdue`, color: 'red', hoursRemaining: 0, isExpired: true };
  }
  if (hoursRemaining <= 4) {
    return { label: `${Math.round(hoursRemaining)}h left`, color: 'red', hoursRemaining, isExpired: false };
  }
  if (hoursRemaining <= 12) {
    return { label: `${Math.round(hoursRemaining)}h left`, color: 'yellow', hoursRemaining, isExpired: false };
  }
  return { label: `${Math.round(hoursRemaining)}h left`, color: 'green', hoursRemaining, isExpired: false };
}
