import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with Tailwind CSS conflict resolution.
 *
 * Uses clsx for conditional class names and tailwind-merge to resolve
 * conflicting Tailwind utility classes (e.g., px-4 + px-6 = px-6).
 *
 * @example
 * cn('px-4', 'py-2', condition && 'bg-blue-500')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
