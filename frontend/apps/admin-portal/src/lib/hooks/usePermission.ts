'use client';

/**
 * Re-export from the canonical use-permission.ts (MED-07 fix).
 * Components should prefer importing from '@/lib/hooks/use-permission' directly.
 */
export { usePermission, useAnyPermission, useAdminUser, useAdminRole } from './use-permission';
