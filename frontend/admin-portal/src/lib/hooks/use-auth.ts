'use client';

/**
 * Re-export useAuth from the canonical AuthContext provider (MED-07 fix).
 * Components should prefer importing from '@/lib/auth/context' directly,
 * but this file exists for backwards compatibility.
 */
export { useAuth } from '@/lib/auth/context';
