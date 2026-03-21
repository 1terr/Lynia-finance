/**
 * Tests for WhatsApp Multi-Language Support (P3-T016)
 *
 * Covers:
 *   - t() - Translation lookup with fallback, template params, default language
 *   - detectLanguage() - Keyword-based language detection (Shona, Ndebele)
 *   - parseLanguageSelection() - Numbered/named language selection parsing
 *   - getLanguageName() - Language code to display name mapping
 */

// ===================================================================
// MOCKS
// ===================================================================

// Mock database client (required by i18n.ts for getCustomerLanguage/setCustomerLanguage)
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
};
const mockDb = { from: jest.fn(() => ({ ...mockQueryBuilder })) };
jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

import {
  t,
  detectLanguage,
  parseLanguageSelection,
  getLanguageName,
} from '../../../services/whatsapp-service/src/i18n';

// ===================================================================
// TESTS
// ===================================================================

describe('WhatsApp i18n (Multi-Language Support)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------
  // t() - Translation lookup
  // -----------------------------------------------------------------
  describe('t', () => {
    it('should return English translation for "welcome" key', () => {
      const result = t('welcome', 'en');
      expect(result).toContain('Lynia Finance');
    });

    it('should return Shona translation for "welcome" key', () => {
      const result = t('welcome', 'sn');
      expect(result).toContain('Mauya');
    });

    it('should return Ndebele translation for "welcome" key', () => {
      const result = t('welcome', 'nd');
      expect(result).toContain('Siyalemukela');
    });

    it('should default to English when no language is specified', () => {
      const result = t('welcome');
      expect(result).toContain('Lynia Finance');
    });

    it('should return the key itself when translation is not found', () => {
      // Cast to bypass TypeScript type checking for testing unknown keys
      const result = t('nonexistent_key' as any, 'en');
      expect(result).toBe('nonexistent_key');
    });

    it('should substitute template parameters in translation', () => {
      const result = t('payment_due', 'en', { amount: '50', date: 'Jan 1' });
      expect(result).toContain('$50');
      expect(result).toContain('Jan 1');
    });

    it('should substitute template parameters in Shona translation', () => {
      const result = t('payment_due', 'sn', { amount: '100', date: 'Feb 15' });
      expect(result).toContain('$100');
      expect(result).toContain('Feb 15');
    });
  });

  // -----------------------------------------------------------------
  // detectLanguage()
  // -----------------------------------------------------------------
  describe('detectLanguage', () => {
    it('should detect Shona from keyword "mhoro"', () => {
      expect(detectLanguage('mhoro')).toBe('sn');
    });

    it('should detect Ndebele from keyword "sawubona"', () => {
      expect(detectLanguage('sawubona')).toBe('nd');
    });

    it('should return null for English text "hello"', () => {
      expect(detectLanguage('hello')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(detectLanguage('')).toBeNull();
    });

    it('should be case insensitive when detecting language', () => {
      expect(detectLanguage('MHORO')).toBe('sn');
      expect(detectLanguage('Sawubona')).toBe('nd');
    });
  });

  // -----------------------------------------------------------------
  // parseLanguageSelection()
  // -----------------------------------------------------------------
  describe('parseLanguageSelection', () => {
    it('should parse "1" as English', () => {
      expect(parseLanguageSelection('1')).toBe('en');
    });

    it('should parse "2" as Shona', () => {
      expect(parseLanguageSelection('2')).toBe('sn');
    });

    it('should parse "3" as Ndebele', () => {
      expect(parseLanguageSelection('3')).toBe('nd');
    });

    it('should parse "english" as English', () => {
      expect(parseLanguageSelection('english')).toBe('en');
    });

    it('should parse "shona" as Shona', () => {
      expect(parseLanguageSelection('shona')).toBe('sn');
    });

    it('should return null for invalid input', () => {
      expect(parseLanguageSelection('invalid')).toBeNull();
    });

    it('should handle whitespace in input', () => {
      expect(parseLanguageSelection('  1  ')).toBe('en');
    });
  });

  // -----------------------------------------------------------------
  // getLanguageName()
  // -----------------------------------------------------------------
  describe('getLanguageName', () => {
    it('should return "English" for code "en"', () => {
      expect(getLanguageName('en')).toBe('English');
    });

    it('should return "Shona" for code "sn"', () => {
      expect(getLanguageName('sn')).toBe('Shona');
    });

    it('should return "Ndebele" for code "nd"', () => {
      expect(getLanguageName('nd')).toBe('Ndebele');
    });
  });
});
