/**
 * Lynia Finance - Domain Constants
 *
 * Single source of truth for all Lynia Finance domain names.
 * The canonical domain is lyniafinance.com (NOT lyniafinance.co.zw).
 *
 * Usage:
 *   import { DOMAINS } from '../shared/utils/domains';
 *   const apiUrl = DOMAINS.production.api;
 */

const BASE_DOMAIN = 'lyniafinance.com';

export const DOMAINS = {
  baseDomain: BASE_DOMAIN,

  production: {
    api: `https://api.${BASE_DOMAIN}`,
    admin: `https://admin.${BASE_DOMAIN}`,
    distributor: `https://distributor.${BASE_DOMAIN}`,
  },

  staging: {
    api: `https://staging-api.${BASE_DOMAIN}`,
    admin: `https://staging-admin.${BASE_DOMAIN}`,
    distributor: `https://staging-distributor.${BASE_DOMAIN}`,
  },

  development: {
    api: `https://development-api.${BASE_DOMAIN}`,
    admin: `https://development-admin.${BASE_DOMAIN}`,
    distributor: `https://development-distributor.${BASE_DOMAIN}`,
  },
} as const;

/**
 * Get domain configuration for a given environment.
 */
export function getDomainsForEnv(env: 'production' | 'staging' | 'development') {
  return DOMAINS[env];
}

/**
 * All allowed CORS origins across all environments.
 */
export const ALL_ALLOWED_ORIGINS: string[] = [
  DOMAINS.production.admin,
  DOMAINS.production.distributor,
  `https://app.${BASE_DOMAIN}`,
  DOMAINS.staging.admin,
  DOMAINS.staging.distributor,
  DOMAINS.development.admin,
  DOMAINS.development.distributor,
];
