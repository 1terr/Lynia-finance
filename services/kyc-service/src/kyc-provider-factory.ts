import type { KYCProvider, KYCProviderName } from '../../shared/types/kyc-provider';
import { SmileIdentityService } from './smile-identity-service';
import { DiditService } from './didit-service';

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
      console.log('KYC provider: DIDIT');
      return new DiditService();

    case 'smile_identity':
      console.log('KYC provider: Smile Identity');
      return new SmileIdentityService();

    default:
      console.warn(`Unknown KYC_PROVIDER "${providerName}", falling back to Didit`);
      return new DiditService();
  }
}
