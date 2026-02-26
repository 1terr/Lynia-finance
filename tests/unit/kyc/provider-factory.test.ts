/**
 * KYC Provider Factory - Unit Tests
 *
 * Tests createKYCProvider() behavior based on KYC_PROVIDER environment variable.
 * The factory returns DiditService by default and SmileIdentityService when
 * explicitly configured. Unknown values fall back to DiditService with a warning.
 */

// Mock both provider implementations BEFORE importing factory.
// The providers call requireEnv in their constructors, so we must mock them.
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

jest.mock('../../../services/kyc-service/src/smile-identity-service', () => {
  return {
    SmileIdentityService: jest.fn().mockImplementation(() => ({
      providerName: 'smile_identity',
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
  let originalKYCProvider: string | undefined;

  beforeEach(() => {
    originalKYCProvider = process.env.KYC_PROVIDER;
    jest.resetModules();
  });

  afterEach(() => {
    if (originalKYCProvider === undefined) {
      delete process.env.KYC_PROVIDER;
    } else {
      process.env.KYC_PROVIDER = originalKYCProvider;
    }
  });

  it('should return DiditService when KYC_PROVIDER is "didit"', () => {
    process.env.KYC_PROVIDER = 'didit';

    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');
    const provider = createKYCProvider();

    expect(provider.providerName).toBe('didit');
  });

  it('should return SmileIdentityService when KYC_PROVIDER is "smile_identity"', () => {
    process.env.KYC_PROVIDER = 'smile_identity';

    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');
    const provider = createKYCProvider();

    expect(provider.providerName).toBe('smile_identity');
  });

  it('should return DiditService when KYC_PROVIDER is not set (undefined)', () => {
    delete process.env.KYC_PROVIDER;

    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');
    const provider = createKYCProvider();

    expect(provider.providerName).toBe('didit');
  });

  it('should return DiditService when KYC_PROVIDER is empty string', () => {
    process.env.KYC_PROVIDER = '';

    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');
    const provider = createKYCProvider();

    // Empty string is falsy, so `process.env.KYC_PROVIDER || 'didit'` yields 'didit'
    expect(provider.providerName).toBe('didit');
  });

  it('should return DiditService when KYC_PROVIDER is an unknown value', () => {
    process.env.KYC_PROVIDER = 'google';

    const loggerMock = require('../../../services/shared/utils/logger').default;

    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');
    const provider = createKYCProvider();

    expect(provider.providerName).toBe('didit');
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Unknown KYC provider, falling back to Didit',
      expect.objectContaining({ provider: 'google' })
    );
  });

  it('should construct DiditService via the DiditService constructor', () => {
    process.env.KYC_PROVIDER = 'didit';

    const { DiditService } = require('../../../services/kyc-service/src/didit-service');
    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');

    createKYCProvider();

    expect(DiditService).toHaveBeenCalledTimes(1);
  });

  it('should construct SmileIdentityService via the SmileIdentityService constructor', () => {
    process.env.KYC_PROVIDER = 'smile_identity';

    const { SmileIdentityService } = require('../../../services/kyc-service/src/smile-identity-service');
    const { createKYCProvider } = require('../../../services/kyc-service/src/kyc-provider-factory');

    createKYCProvider();

    expect(SmileIdentityService).toHaveBeenCalledTimes(1);
  });

  it('should return a provider with all required KYCProvider interface methods', () => {
    process.env.KYC_PROVIDER = 'didit';

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
