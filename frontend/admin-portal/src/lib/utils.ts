import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  format,
  formatDistanceToNow,
  differenceInHours,
  differenceInMinutes,
  isPast,
} from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

export function formatTimeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getSLAStatus(deadline: string): {
  label: string;
  color: 'red' | 'yellow' | 'green' | 'gray';
  hoursRemaining: number;
  isExpired: boolean;
} {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const hoursRemaining = differenceInHours(deadlineDate, now);
  const minutesRemaining = differenceInMinutes(deadlineDate, now);
  const isExpired = isPast(deadlineDate);

  if (isExpired) {
    return {
      label: `Overdue by ${formatDistanceToNow(deadlineDate)}`,
      color: 'red',
      hoursRemaining,
      isExpired: true,
    };
  }

  if (hoursRemaining < 4) {
    return {
      label: `${minutesRemaining} min remaining`,
      color: 'red',
      hoursRemaining,
      isExpired: false,
    };
  }

  if (hoursRemaining < 12) {
    return {
      label: `${hoursRemaining}h remaining`,
      color: 'yellow',
      hoursRemaining,
      isExpired: false,
    };
  }

  return {
    label: `${hoursRemaining}h remaining`,
    color: 'green',
    hoursRemaining,
    isExpired: false,
  };
}

export function getConfidenceLevel(score: number | null): {
  label: string;
  color: 'red' | 'yellow' | 'green' | 'gray';
} {
  if (score === null) {
    return { label: 'N/A', color: 'gray' };
  }
  if (score >= 85) {
    return { label: 'High', color: 'green' };
  }
  if (score >= 50) {
    return { label: 'Medium', color: 'yellow' };
  }
  return { label: 'Low', color: 'red' };
}
