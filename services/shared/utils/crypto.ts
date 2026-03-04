/**
 * Shared cryptographic utilities.
 */

import { createHash } from 'crypto';

/**
 * Hash a Zimbabwe national ID using SHA-256.
 * Used for privacy-preserving lookups in organization_members and customer dedup.
 */
export function hashNationalId(nationalId: string): string {
  return createHash('sha256').update(nationalId).digest('hex');
}
