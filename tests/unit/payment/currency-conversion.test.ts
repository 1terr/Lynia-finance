/**
 * Unit tests for services/payment-service/src/currency-conversion.ts
 *
 * Tests the convertToUsd function used for RBZ transaction limit checking.
 */

const mockExecute = jest.fn();

jest.mock('../../../services/shared/clients/database', () => {
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'order', 'limit', 'single', 'maybeSingle'];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: { from: jest.fn().mockImplementation(() => createChain()) },
  };
});

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { convertToUsd } from '../../../services/payment-service/src/currency-conversion';
const loggerMock = require('../../../services/shared/utils/logger').default;

describe('convertToUsd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockReset();
    // Set fallback env vars
    process.env.ZWL_USD_RATE = '0.0003';
    process.env.ZAR_USD_RATE = '0.055';
  });

  it('should return amount unchanged for USD', async () => {
    const result = await convertToUsd(500, 'USD');
    expect(result).toBe(500);
    // Should NOT query the database
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should convert ZWL using database rate', async () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    mockExecute.mockResolvedValueOnce({
      data: { value: '0.0004', updated_at: recentDate },
      error: null,
    });

    const result = await convertToUsd(10000, 'ZWL');
    expect(result).toBe(4); // 10000 * 0.0004
  });

  it('should convert ZAR using database rate', async () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(); // 2 hours ago
    mockExecute.mockResolvedValueOnce({
      data: { value: '0.06', updated_at: recentDate },
      error: null,
    });

    const result = await convertToUsd(1000, 'ZAR');
    expect(result).toBe(60); // 1000 * 0.06
  });

  it('should warn when database rate is stale (> 24 hours)', async () => {
    const staleDate = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(); // 48 hours ago
    mockExecute.mockResolvedValueOnce({
      data: { value: '0.0003', updated_at: staleDate },
      error: null,
    });

    await convertToUsd(5000, 'ZWL');

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Exchange rate is stale',
      expect.objectContaining({
        action: 'currency.convert',
        meta: expect.objectContaining({ currency: 'ZWL' }),
      })
    );
  });

  it('should fall back to env var rate when DB lookup fails', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB connection error'));

    const result = await convertToUsd(10000, 'ZWL');
    expect(result).toBeCloseTo(3, 5); // 10000 * 0.0003 (env var fallback)

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Using fallback exchange rate',
      expect.objectContaining({
        action: 'currency.convert',
        meta: expect.objectContaining({ currency: 'ZWL', source: 'environment' }),
      })
    );
  });

  it('should fall back to env var rate when DB returns no data', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const result = await convertToUsd(1000, 'ZAR');
    expect(result).toBe(55); // 1000 * 0.055 (env var fallback)
  });

  it('should throw for unknown currency with no rate available', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    await expect(convertToUsd(100, 'GBP')).rejects.toThrow(
      'No exchange rate available for currency: GBP'
    );
  });

  it('should fall back when DB rate is zero or NaN', async () => {
    const recentDate = new Date().toISOString();
    mockExecute.mockResolvedValueOnce({
      data: { value: '0', updated_at: recentDate },
      error: null,
    });

    const result = await convertToUsd(10000, 'ZWL');
    expect(result).toBeCloseTo(3, 5); // falls back to env var 0.0003
  });
});
