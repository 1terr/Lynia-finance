/**
 * Unit Tests: Digital Product Selection State Handler
 *
 * Tests the digital_product_selection onboarding state where customers
 * choose from available digital loan products linked to their verified
 * organization(s). Covers auto-selection, multi-product listing,
 * numeric choice validation, and edge cases.
 */

import { handleDigitalProductSelection } from '../digital-product-selection';
import { query } from '../../../../../shared/clients/database';
import { updateSession } from '../../session';
import type { OnboardingSession, MessageContext } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../../../../shared/clients/database', () => ({
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock('../../../../../shared/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../session', () => ({
  updateSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../i18n', () => ({
  t: jest.fn((key: string) => key),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockQuery = query as jest.Mock;
const mockUpdateSession = updateSession as jest.Mock;

function makeSession(overrides: Partial<OnboardingSession['state_data']> = {}): OnboardingSession {
  return {
    customer_id: 'cust-001',
    phone_number: '+263771234567',
    current_state: 'digital_product_selection',
    state_data: {
      preferred_language: 'en',
      ...overrides,
    },
    last_activity_at: new Date(),
    created_at: new Date(),
  };
}

function makeContext(message: string): MessageContext {
  return {
    from: '+263771234567',
    message,
    messageId: 'msg-test-001',
    timestamp: Date.now(),
  };
}

function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prod-001',
    product_code: 'DL-CORP',
    product_name: 'Corporate Loan',
    min_amount_usd: 50,
    max_amount_usd: 500,
    interest_rate_monthly: 5,
    min_term_months: 1,
    max_term_months: 12,
    org_name: 'Test Corp',
    org_id: 'org-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleDigitalProductSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── No verified org IDs ───────────────────────────────────────────────

  it('redirects to org_verification when no verified org IDs in state', async () => {
    const session = makeSession({
      verified_organization_ids: [],
      organization_id: undefined,
    });
    const ctx = makeContext('hello');

    const response = await handleDigitalProductSelection(session, ctx);

    expect(mockUpdateSession).toHaveBeenCalledWith(
      ctx.from,
      expect.objectContaining({ current_state: 'org_verification' }),
    );
    expect(response).toContain('verify your organization');
  });

  // ── Product querying ──────────────────────────────────────────────────

  it('queries products for verified org IDs', async () => {
    const orgIds = ['org-001', 'org-002'];
    const session = makeSession({ verified_organization_ids: orgIds });
    const ctx = makeContext('hi');

    mockQuery.mockResolvedValue({ data: [], error: null });

    await handleDigitalProductSelection(session, ctx);

    // First call: org-linked products with orgIds parameter
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[0][1]).toEqual([orgIds]);
  });

  it('also queries open products (no org restriction)', async () => {
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    mockQuery.mockResolvedValue({ data: [], error: null });

    await handleDigitalProductSelection(session, ctx);

    // Second call: open products with empty params
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][1]).toEqual([]);
  });

  // ── No products available ─────────────────────────────────────────────

  it('returns rejection message when no products found', async () => {
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    mockQuery.mockResolvedValue({ data: [], error: null });

    const response = await handleDigitalProductSelection(session, ctx);

    expect(response).toContain('no digital loan products');
  });

  it('updates session to rejected state when no products', async () => {
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    mockQuery.mockResolvedValue({ data: [], error: null });

    await handleDigitalProductSelection(session, ctx);

    expect(mockUpdateSession).toHaveBeenCalledWith(
      ctx.from,
      expect.objectContaining({
        current_state: 'rejected',
        state_data: expect.objectContaining({
          rejection_reason: 'no_products_available',
        }),
      }),
    );
  });

  // ── Auto-select (single product) ─────────────────────────────────────

  it('auto-selects when only 1 product available', async () => {
    const product = makeProduct();
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    // First call returns one product, second returns none
    mockQuery
      .mockResolvedValueOnce({ data: [product], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const response = await handleDigitalProductSelection(session, ctx);

    expect(response).toContain(product.product_name);
    expect(response).toContain('verify your identity');
  });

  it('transitions to kyc_id_upload on auto-select', async () => {
    const product = makeProduct();
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    mockQuery
      .mockResolvedValueOnce({ data: [product], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await handleDigitalProductSelection(session, ctx);

    expect(mockUpdateSession).toHaveBeenCalledWith(
      ctx.from,
      expect.objectContaining({ current_state: 'kyc_id_upload' }),
    );
  });

  it('stores product details in state_data on auto-select', async () => {
    const product = makeProduct({ id: 'prod-777', product_code: 'DL-SPECIAL' });
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    mockQuery
      .mockResolvedValueOnce({ data: [product], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await handleDigitalProductSelection(session, ctx);

    expect(mockUpdateSession).toHaveBeenCalledWith(
      ctx.from,
      expect.objectContaining({
        state_data: expect.objectContaining({
          selected_digital_product_id: 'prod-777',
          selected_product_code: 'DL-SPECIAL',
          product_min_amount: product.min_amount_usd,
          product_max_amount: product.max_amount_usd,
          product_interest_rate: product.interest_rate_monthly,
          product_min_term: product.min_term_months,
          product_max_term: product.max_term_months,
        }),
      }),
    );
  });

  // ── Multiple products: show list ──────────────────────────────────────

  it('shows numbered product list for multiple products', async () => {
    const products = [
      makeProduct({ id: 'prod-001', product_name: 'Starter Loan', org_name: 'Org A' }),
      makeProduct({ id: 'prod-002', product_name: 'Premium Loan', org_name: 'Org B' }),
    ];
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    mockQuery
      .mockResolvedValueOnce({ data: products, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const response = await handleDigitalProductSelection(session, ctx);

    expect(response).toContain('1.');
    expect(response).toContain('2.');
    expect(response).toContain('Starter Loan');
    expect(response).toContain('Premium Loan');
    expect(response).toContain('Reply with the number');
  });

  it('groups products by organization name', async () => {
    const products = [
      makeProduct({ id: 'prod-001', product_name: 'Loan A', org_name: 'Alpha Corp' }),
      makeProduct({ id: 'prod-002', product_name: 'Loan B', org_name: 'Beta Corp' }),
    ];
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    mockQuery
      .mockResolvedValueOnce({ data: products, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const response = await handleDigitalProductSelection(session, ctx);

    expect(response).toContain('Alpha Corp');
    expect(response).toContain('Beta Corp');
  });

  it('stores available_product_ids in state_data for later selection (D4: minimal session data)', async () => {
    const products = [
      makeProduct({ id: 'prod-001' }),
      makeProduct({ id: 'prod-002' }),
    ];
    const session = makeSession({ verified_organization_ids: ['org-001'] });
    const ctx = makeContext('hi');

    mockQuery
      .mockResolvedValueOnce({ data: products, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await handleDigitalProductSelection(session, ctx);

    expect(mockUpdateSession).toHaveBeenCalledWith(
      ctx.from,
      expect.objectContaining({
        state_data: expect.objectContaining({
          products_shown: true,
          available_product_ids: ['prod-001', 'prod-002'],
          available_product_count: 2,
        }),
      }),
    );
  });

  // ── Selection phase (second entry) ────────────────────────────────────

  it('accepts valid numeric selection and re-queries product by ID', async () => {
    const selectedProduct = makeProduct({ id: 'prod-002', product_name: 'Premium Loan' });
    const session = makeSession({
      verified_organization_ids: ['org-001'],
      products_shown: true,
      available_product_ids: ['prod-001', 'prod-002'],
      available_product_count: 2,
    });
    const ctx = makeContext('2');

    // Mock the re-query for the selected product
    mockQuery.mockResolvedValueOnce({ data: [selectedProduct], error: null });

    const response = await handleDigitalProductSelection(session, ctx);

    expect(response).toContain('Premium Loan');
    expect(mockUpdateSession).toHaveBeenCalledWith(
      ctx.from,
      expect.objectContaining({
        current_state: 'kyc_id_upload',
        state_data: expect.objectContaining({
          selected_digital_product_id: 'prod-002',
        }),
      }),
    );
  });

  it('rejects non-numeric input in selection phase', async () => {
    const session = makeSession({
      verified_organization_ids: ['org-001'],
      products_shown: true,
      available_product_ids: ['prod-001', 'prod-002'],
      available_product_count: 2,
    });
    const ctx = makeContext('abc');

    const response = await handleDigitalProductSelection(session, ctx);

    expect(response).toContain('number between 1 and');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('rejects out-of-range number', async () => {
    const session = makeSession({
      verified_organization_ids: ['org-001'],
      products_shown: true,
      available_product_ids: ['prod-001', 'prod-002'],
      available_product_count: 2,
    });
    const ctx = makeContext('5');

    const response = await handleDigitalProductSelection(session, ctx);

    expect(response).toContain('number between 1 and 2');
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it('cleans up temporary state from state_data after selection', async () => {
    const selectedProduct = makeProduct({ id: 'prod-001', product_name: 'Starter Loan' });
    const session = makeSession({
      verified_organization_ids: ['org-001'],
      products_shown: true,
      available_product_ids: ['prod-001'],
      available_product_count: 1,
    });
    const ctx = makeContext('1');

    // Mock the re-query for selected product
    mockQuery.mockResolvedValueOnce({ data: [selectedProduct], error: null });

    await handleDigitalProductSelection(session, ctx);

    expect(mockUpdateSession).toHaveBeenCalledWith(
      ctx.from,
      expect.objectContaining({
        state_data: expect.objectContaining({
          products_shown: undefined,
          available_products: undefined,
          available_product_ids: undefined,
          available_product_count: undefined,
        }),
      }),
    );
  });
});
