import type { KYCProvider, KYCProviderName } from '../../shared/types/kyc-provider';
import { SmileIdentityService } from './smile-identity-service';
import { DiditService } from './didit-service';
import logger from '../../shared/utils/logger';

/**
 * Create a KYC provider instance based on the KYC_PROVIDER environment variable.
 *
 * Supported values:
 * - 'smile_identity' - Smile Identity Enhanced KYC
 * - 'didit' (default) - DIDIT standalone verification APIs
 */
export function createKYCProvider(): KYCProvider {
  const providerName = (process.env.KYC_PROVIDER || 'didit') as KYCProviderName;

  switch (providerName) {
    case 'didit':
      logger.info('KYC provider initialized', { action: 'kyc.provider.init', provider: 'didit' });
      return new DiditService();

    case 'smile_identity':
      logger.info('KYC provider initialized', { action: 'kyc.provider.init', provider: 'smile_identity' });
      return new SmileIdentityService();

    default:
      logger.warn('Unknown KYC provider, falling back to Didit', { action: 'kyc.provider.init', provider: providerName });
      return new DiditService();
  }
}
