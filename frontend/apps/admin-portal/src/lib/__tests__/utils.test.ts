import { cn, formatDate, formatDateTime, formatCurrency, truncateId } from '../utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
    });

    it('merges tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });
  });

  describe('formatDate', () => {
    it('formats a date string', () => {
      const result = formatDate('2025-01-15T10:00:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('formats a Date object', () => {
      const result = formatDate(new Date('2025-06-20'));
      expect(result).toContain('Jun');
      expect(result).toContain('2025');
    });
  });

  describe('formatDateTime', () => {
    it('includes time in the output', () => {
      const result = formatDateTime('2025-01-15T14:30:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });
  });

  describe('formatCurrency', () => {
    it('formats a number as USD', () => {
      expect(formatCurrency(350)).toBe('$350.00');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats decimal amounts', () => {
      expect(formatCurrency(56.88)).toBe('$56.88');
    });
  });

  describe('truncateId', () => {
    it('truncates a UUID to 8 chars by default', () => {
      expect(truncateId('abcdef12-3456-7890-abcd-ef1234567890')).toBe(
        'abcdef12'
      );
    });

    it('accepts custom length', () => {
      expect(truncateId('abcdef1234567890', 4)).toBe('abcd');
    });
  });
});
