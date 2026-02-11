'use client';

/**
 * Re-export useAuth from the canonical module.
 * Both import paths work identically:
 *   import { useAuth } from '@/lib/auth/context';
 *   import { useAuth } from '@/lib/hooks/use-auth';
 */
export { useAuth } from '@/lib/auth/context';
