/**
 * Currency Conversion Utility
 *
 * Converts ZWL/ZAR amounts to USD equivalent for RBZ transaction limit checking.
 * Uses database exchange rates with env-var fallbacks.
 */

import { db } from '../../shared/clients/database';
import logger from '../../shared/utils/logger';

/**
 * Fallback exchange rates (configurable via environment variables).
 * These are used when the database lookup fails or is unavailable.
 */
const FALLBACK_RATES: Record<string, number> = {
  ZWL: parseFloat(process.env.ZWL_USD_RATE || '0.0003'),  // ~3,333 ZWL per USD
  ZAR: parseFloat(process.env.ZAR_USD_RATE || '0.055'),    // ~18 ZAR per USD
};

/** Maximum age (in hours) before a DB rate is considered stale */
const STALE_RATE_THRESHOLD_HOURS = 24;

/**
 * Convert an amount in a given currency to USD equivalent.
 *
 * Strategy:
 *  1. USD amounts pass through unchanged.
 *  2. Look up rate from `system_config` table (key: `{CURRENCY}_USD`).
 *  3. Fall back to env-var rate if DB lookup fails.
 *  4. Throw if no rate is available for the currency.
 */
export async function convertToUsd(amount: number, currency: string): Promise<number> {
  if (currency === 'USD') return amount;

  const rateKey = `${currency}_USD`;

  // Try database first
  try {
    const { data } = await db
      .from('system_config')
      .select('value, updated_at')
      .eq('key', rateKey)
      .single()
      .execute();

    if (data?.value) {
      const rate = parseFloat(data.value);
      if (!isNaN(rate) && rate > 0) {
        const updatedAt = new Date(data.updated_at);
        const ageHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);

        if (ageHours > STALE_RATE_THRESHOLD_HOURS) {
          logger.warn('Exchange rate is stale', {
            action: 'currency.convert',
            meta: { currency, rateKey, ageHours: Math.round(ageHours) },
          });
        }

        return amount * rate;
      }
    }
  } catch {
    // Fall through to env-var fallback
  }

  // Fallback to environment variable rate
  const fallbackRate = FALLBACK_RATES[currency];
  if (!fallbackRate || fallbackRate <= 0) {
    throw new Error(`No exchange rate available for currency: ${currency}`);
  }

  logger.warn('Using fallback exchange rate', {
    action: 'currency.convert',
    meta: { currency, rate: fallbackRate, source: 'environment' },
  });

  return amount * fallbackRate;
}
