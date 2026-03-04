import type { KYCProvider } from '../../shared/types/kyc-provider';
import { DiditService } from './didit-service';
import logger from '../../shared/utils/logger';

/**
 * Create the KYC provider instance (DIDIT).
 */
export function createKYCProvider(): KYCProvider {
  logger.info('KYC provider initialized', { action: 'kyc.provider.init', provider: 'didit' });
  return new DiditService();
}
