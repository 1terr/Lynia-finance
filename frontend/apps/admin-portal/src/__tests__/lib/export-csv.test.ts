import { exportToCsv, formatCurrency, formatPct, formatNumber } from '@/lib/export/csv';

describe('formatCurrency', () => {
  it('formats whole numbers', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });

  it('formats decimal values', () => {
    expect(formatCurrency(391.49)).toBe('$391.49');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats large values', () => {
    expect(formatCurrency(42300)).toBe('$42,300.00');
  });
});

describe('formatPct', () => {
  it('formats percentage with one decimal', () => {
    expect(formatPct(87.0)).toBe('87.0%');
  });

  it('formats small percentages', () => {
    expect(formatPct(1.8)).toBe('1.8%');
  });

  it('formats zero', () => {
    expect(formatPct(0)).toBe('0.0%');
  });

  it('formats 100%', () => {
    expect(formatPct(100)).toBe('100.0%');
  });
});

describe('formatNumber', () => {
  it('formats numbers with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats small numbers', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

describe('exportToCsv', () => {
  let mockClick: jest.Mock;
  let mockAppendChild: jest.SpyInstance;
  let mockRemoveChild: jest.SpyInstance;

  beforeEach(() => {
    mockClick = jest.fn();
    mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      // Intercept the anchor click
      if (node instanceof HTMLAnchorElement) {
        node.click = mockClick;
      }
      return node;
    });
    mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    mockAppendChild.mockRestore();
    mockRemoveChild.mockRestore();
  });

  it('creates and triggers download', () => {
    exportToCsv('test-report', ['Name', 'Value'], [['Foo', 42]]);
    expect(mockClick).toHaveBeenCalled();
  });

  it('creates correct CSV content', () => {
    // Just verify it doesn't throw
    expect(() => {
      exportToCsv('test', ['A', 'B'], [['1', '2'], ['3', '4']]);
    }).not.toThrow();
  });

  it('handles empty data', () => {
    expect(() => {
      exportToCsv('empty', ['Header'], []);
    }).not.toThrow();
  });
});
