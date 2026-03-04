/**
 * KYC Provider Factory - Unit Tests
 *
 * Tests createKYCProvider() always returns DiditService.
 * DIDIT is the sole KYC provider — no fallback, no provider switching.
 */

// Mock the provider implementation BEFORE importing factory.
jest.mock('../../../services/kyc-service/src/didit-service', () => {
  return {
    DiditService: jest.fn().mockImplementation(() => ({
      providerName: 'didit',
      submitVerification: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      parseWebhookPayload: jest.fn(),
      determineDecision: jest.fn(),
      handleError: jest.fn(),
    })),
  };
});

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('KYC Provider Factory', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should return DiditService', () => {
    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');
    const provider = createKYCProvider();

    expect(provider.providerName).toBe('didit');
  });

  it('should construct DiditService via the DiditService constructor', () => {
    const { DiditService } = require('../../../services/kyc-service/src/didit-service');
    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');

    createKYCProvider();

    expect(DiditService).toHaveBeenCalledTimes(1);
  });

  it('should return a provider with all required KYCProvider interface methods', () => {
    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');
    const provider = createKYCProvider();

    expect(provider).toHaveProperty('providerName');
    expect(typeof provider.submitVerification).toBe('function');
    expect(typeof provider.verifyWebhookSignature).toBe('function');
    expect(typeof provider.parseWebhookPayload).toBe('function');
    expect(typeof provider.determineDecision).toBe('function');
    expect(typeof provider.handleError).toBe('function');
  });
});
