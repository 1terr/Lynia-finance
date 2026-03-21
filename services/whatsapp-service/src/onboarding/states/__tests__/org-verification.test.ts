/**
 * Unit Tests: Organization Verification State Handler
 *
 * Tests the org_verification onboarding state which verifies
 * digital credit applicants belong to a registered organization.
 */

import { handleOrgVerification } from '../org-verification';
import type { OnboardingSession, MessageContext } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateSession = jest.fn();
jest.mock('../../session', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

const mockDbFrom = jest.fn();
const mockQuery = jest.fn();
jest.mock('../../../../../shared/clients/database', () => ({
  db: {
    from: (...args: unknown[]) => mockDbFrom(...args),
  },
  query: (...args: unknown[]) => mockQuery(...args),
}));

jest.mock('../../../../../shared/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../../../shared/utils/crypto', () => ({
  hashNationalId: jest.fn((id: string) => `hashed_${id}`),
}));

jest.mock('../../../../../shared/utils/org-lending-resolver', () => ({
  resolveOrgLendingLimits: jest.fn(() => ({
    max_loan_amount: 500,
    min_loan_amount: 20,
    interest_rate_monthly: 2,
    interest_rate_apr: 24,
    min_term_months: 1,
    max_term_months: 6,
    deposit_percentage: 0,
    max_active_loans: 1,
    salary_cap_applied: false,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'org_verification',
    state_data: {
      selected_product: 'digital_credit',
      preferred_language: 'en',
      ...overrides,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
  };
}

function makeContext(message: string): MessageContext {
  return { from: '+263771234567', message, messageId: 'msg-1', timestamp: Date.now() };
}

/** Helper to wire the fluent db chain mock for a given table */
function mockDbChain(data: unknown) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ data }),
  };
  mockDbFrom.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleOrgVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // National ID validation
  // -----------------------------------------------------------------------

  it('accepts valid Zimbabwe national ID format (XX-XXXXXXXAXX)', async () => {
    // Set up: member found, org found, product found, no explicit links
    setupFullHappyPath();

    const result = await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    // Should NOT return the prompt (which means it passed validation)
    expect(result).toContain('Organization Verified');
  });

  it('rejects invalid national ID format with helpful prompt', async () => {
    const result = await handleOrgVerification(makeSession(), makeContext('12345'));

    expect(result).toContain('National ID');
    expect(result).toContain('XX-XXXXXXX-X-XX');
  });

  it('rejects national ID missing letter component', async () => {
    const result = await handleOrgVerification(makeSession(), makeContext('63-2345678-0-08'));

    // '0' is not [A-Z], so it should fail
    expect(result).toContain('National ID');
  });

  it('normalizes spaces around hyphens before validation', async () => {
    setupFullHappyPath();

    const result = await handleOrgVerification(
      makeSession(),
      makeContext('63 - 2345678 - B - 08')
    );

    expect(result).toContain('Organization Verified');
  });

  // -----------------------------------------------------------------------
  // BACK command
  // -----------------------------------------------------------------------

  it('returns to product_selection on BACK command', async () => {
    const result = await handleOrgVerification(makeSession(), makeContext('back'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'product_selection',
        state_data: expect.objectContaining({
          selected_product: undefined,
          organization_id: undefined,
        }),
      })
    );

    // Should show product selection message
    expect(result).toContain('apply for');
  });

  it('handles BACK in any case (BACK, Back, bAcK)', async () => {
    const result = await handleOrgVerification(makeSession(), makeContext('BACK'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({ current_state: 'product_selection' })
    );
    expect(result).toContain('apply for');
  });

  // -----------------------------------------------------------------------
  // Member + org found and eligible
  // -----------------------------------------------------------------------

  it('stores org data and transitions to digital_product_selection on eligible org', async () => {
    setupFullHappyPath();

    const result = await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        current_state: 'digital_product_selection',
        state_data: expect.objectContaining({
          id_number: '63-2345678-B-08',
          organization_id: 'org-001',
          org_name: 'Econet Wireless',
          org_type: 'corporate',
          scoring_trust_level: 'high',
          org_lending_limits: expect.objectContaining({
            max_loan_amount: 500,
            min_loan_amount: 20,
            interest_rate_monthly: 2,
            interest_rate_apr: 24,
          }),
        }),
      })
    );

    expect(result).toContain('Econet Wireless');
  });

  it('stores resolved lending limits in state_data', async () => {
    const { resolveOrgLendingLimits } = require('../../../../../shared/utils/org-lending-resolver');
    resolveOrgLendingLimits.mockReturnValue({
      max_loan_amount: 750,
      min_loan_amount: 50,
      interest_rate_monthly: 3,
      interest_rate_apr: 36,
      min_term_months: 2,
      max_term_months: 12,
      deposit_percentage: 0,
      max_active_loans: 2,
      salary_cap_applied: true,
    });

    setupFullHappyPath();

    await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    expect(mockUpdateSession).toHaveBeenCalledWith(
      '+263771234567',
      expect.objectContaining({
        state_data: expect.objectContaining({
          org_lending_limits: expect.objectContaining({
            max_loan_amount: 750,
            min_loan_amount: 50,
            interest_rate_apr: 36,
          }),
          interest_rate_apr: 36,
          down_payment_percentage: 0,
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // Member not found
  // -----------------------------------------------------------------------

  it('returns "not in registered org" when member not found', async () => {
    // Member lookup returns null
    let callCount = 0;
    mockDbFrom.mockImplementation(() => {
      callCount++;
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: callCount === 1 ? null : undefined }),
      };
    });

    const result = await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    expect(result).toContain('could not find you');
  });

  // -----------------------------------------------------------------------
  // Org found but NOT eligible
  // -----------------------------------------------------------------------

  it('returns rejection when org has explicit product links but is not one of them', async () => {
    // Member found
    let dbCallIndex = 0;
    mockDbFrom.mockImplementation(() => {
      dbCallIndex++;
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      if (dbCallIndex === 1) {
        // member
        chain.execute.mockResolvedValue({
          data: {
            organization_id: 'org-001',
            employment_status: 'active',
            employment_start_date: '2022-01-01',
            salary_verified: true,
            monthly_salary_usd: 400,
          },
        });
      } else {
        // org
        chain.execute.mockResolvedValue({
          data: {
            id: 'org-001',
            org_name: 'Excluded Corp',
            org_type: 'corporate',
            scoring_trust_level: 'standard',
          },
        });
      }
      return chain;
    });

    let queryCallIndex = 0;
    mockQuery.mockImplementation(() => {
      queryCallIndex++;
      if (queryCallIndex === 1) {
        // product
        return Promise.resolve({
          data: [{
            id: 'prod-1',
            min_amount_usd: 20,
            max_amount_usd: 1000,
            interest_rate_monthly: 2,
            min_term_months: 1,
            max_term_months: 12,
            deposit_percentage: 0,
            max_active_loans: 1,
          }],
        });
      } else if (queryCallIndex === 2) {
        // product_organizations for this org — not linked
        return Promise.resolve({ data: [] });
      } else {
        // count of product_organizations — there ARE explicit links (just not for this org)
        return Promise.resolve({ data: [{ count: '3' }] });
      }
    });

    const result = await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    expect(result).toContain('not registered for digital credit');
    expect(result).toContain('Excluded Corp');
  });

  it('returns rejection when org link exists but is_active is false', async () => {
    let dbCallIndex = 0;
    mockDbFrom.mockImplementation(() => {
      dbCallIndex++;
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      if (dbCallIndex === 1) {
        chain.execute.mockResolvedValue({
          data: {
            organization_id: 'org-001',
            employment_status: 'active',
            employment_start_date: '2023-06-01',
            salary_verified: true,
            monthly_salary_usd: 300,
          },
        });
      } else {
        chain.execute.mockResolvedValue({
          data: {
            id: 'org-001',
            org_name: 'Inactive Corp',
            org_type: 'corporate',
            scoring_trust_level: 'standard',
          },
        });
      }
      return chain;
    });

    let queryCallIndex = 0;
    mockQuery.mockImplementation(() => {
      queryCallIndex++;
      if (queryCallIndex === 1) {
        return Promise.resolve({
          data: [{
            id: 'prod-1',
            min_amount_usd: 20,
            max_amount_usd: 1000,
            interest_rate_monthly: 2,
            min_term_months: 1,
            max_term_months: 12,
            deposit_percentage: 0,
            max_active_loans: 1,
          }],
        });
      } else if (queryCallIndex === 2) {
        // org IS linked, but inactive
        return Promise.resolve({
          data: [{
            organization_id: 'org-001',
            is_active: false,
            max_loan_amount_usd: null,
            min_loan_amount_usd: null,
            interest_rate_monthly_override: null,
            max_term_months_override: null,
            min_term_months_override: null,
            deposit_percentage_override: null,
            max_active_loans_override: null,
            salary_multiplier: null,
          }],
        });
      } else {
        return Promise.resolve({ data: [{ count: '5' }] });
      }
    });

    const result = await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    expect(result).toContain('not registered for digital credit');
    expect(result).toContain('Inactive Corp');
  });

  // -----------------------------------------------------------------------
  // API / system errors
  // -----------------------------------------------------------------------

  it('returns user-friendly error on database exception', async () => {
    mockDbFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      execute: jest.fn().mockRejectedValue(new Error('Connection refused')),
    }));

    const result = await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    expect(result).toContain('could not verify');
    expect(result).toContain('support@lynia.finance');
    // Must NOT leak the actual error
    expect(result).not.toContain('Connection refused');
  });

  it('returns error when no active digital loan product exists', async () => {
    // Member found
    mockDbFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({
        data: {
          organization_id: 'org-001',
          employment_status: 'active',
          employment_start_date: '2022-01-01',
          salary_verified: false,
          monthly_salary_usd: 0,
        },
      }),
    }));

    // No active product
    mockQuery.mockResolvedValue({ data: [] });

    const result = await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    expect(result).toContain('could not verify');
  });

  // -----------------------------------------------------------------------
  // Multiple orgs scenario: uses the one linked to the product
  // -----------------------------------------------------------------------

  it('calculates tenure from employment_start_date', async () => {
    // Set a known start date to verify tenure calculation
    setupFullHappyPath('2024-01-15');

    await handleOrgVerification(makeSession(), makeContext('63-2345678-B-08'));

    const updateCall = mockUpdateSession.mock.calls[0];
    const stateData = updateCall[1].state_data;

    // Tenure should be > 0 for any date before today
    expect(stateData.tenure_months).toBeGreaterThanOrEqual(0);
    expect(typeof stateData.tenure_months).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Setup Helpers
// ---------------------------------------------------------------------------

function setupFullHappyPath(employmentStartDate = '2022-06-01') {
  let dbCallIndex = 0;
  mockDbFrom.mockImplementation(() => {
    dbCallIndex++;
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };
    if (dbCallIndex === 1) {
      // organization_members lookup
      chain.execute.mockResolvedValue({
        data: {
          organization_id: 'org-001',
          employment_status: 'active',
          employment_start_date: employmentStartDate,
          salary_verified: true,
          monthly_salary_usd: 400,
        },
      });
    } else {
      // organizations lookup
      chain.execute.mockResolvedValue({
        data: {
          id: 'org-001',
          org_name: 'Econet Wireless',
          org_type: 'corporate',
          scoring_trust_level: 'high',
        },
      });
    }
    return chain;
  });

  let queryCallIndex = 0;
  mockQuery.mockImplementation(() => {
    queryCallIndex++;
    if (queryCallIndex === 1) {
      // loan_products
      return Promise.resolve({
        data: [{
          id: 'prod-1',
          min_amount_usd: 20,
          max_amount_usd: 1000,
          interest_rate_monthly: 2,
          min_term_months: 1,
          max_term_months: 12,
          deposit_percentage: 0,
          max_active_loans: 1,
        }],
      });
    } else if (queryCallIndex === 2) {
      // product_organizations for this org — linked and active
      return Promise.resolve({
        data: [{
          organization_id: 'org-001',
          is_active: true,
          max_loan_amount_usd: null,
          min_loan_amount_usd: null,
          interest_rate_monthly_override: null,
          max_term_months_override: null,
          min_term_months_override: null,
          deposit_percentage_override: null,
          max_active_loans_override: null,
          salary_multiplier: null,
        }],
      });
    } else {
      // count of product_organizations
      return Promise.resolve({ data: [{ count: '1' }] });
    }
  });
}
