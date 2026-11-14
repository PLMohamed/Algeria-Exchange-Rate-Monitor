import {
  currencyFromFileName,
  parseArchiveFile,
} from './archive.parser.js';

describe('currencyFromFileName', () => {
  it('extracts the currency code from the archive file name', () => {
    expect(
      currencyFromFileName(
        'clean_Cotation-DZD-2000-2026-journalier(USD - DZD).csv',
      ),
    ).toBe('USD');
  });

  it('maps EURO to EUR', () => {
    expect(
      currencyFromFileName(
        'clean_Cotation-DZD-2000-2026-journalier(EURO - DZD).csv',
      ),
    ).toBe('EUR');
  });

  it('throws for an unexpected file name', () => {
    expect(() => currencyFromFileName('rates.csv')).toThrow(
      'Unable to determine the currency',
    );
  });
});

describe('parseArchiveFile', () => {
  const content = [
    ',',
    'USD / DZD,',
    ',',
    ',USD / DZD',
    '03/01/2000, 68.9491   ',
    '04/01/2000,',
    '05/01/2000, -',
    '06/01/2000, 437.05125',
    '',
  ].join('\n');

  it('parses valid rows and converts dates to ISO', () => {
    const parsed = parseArchiveFile(
      'clean_Cotation-DZD-2000-2026-journalier(USD - DZD).csv',
      content,
    );

    expect(parsed.currency).toBe('USD');
    expect(parsed.rates).toEqual([
      { currency: 'USD', rate: '68.9491', rateDate: '2000-01-03' },
      { currency: 'USD', rate: '437.05125', rateDate: '2000-01-06' },
    ]);
  });

  it('skips empty and placeholder values', () => {
    const parsed = parseArchiveFile(
      'clean_Cotation-DZD-2000-2026-journalier(USD - DZD).csv',
      content,
    );

    expect(parsed.skipped).toBe(2);
  });

  it('throws for an invalid date', () => {
    expect(() =>
      parseArchiveFile(
        'clean_Cotation-DZD-2000-2026-journalier(USD - DZD).csv',
        '31/02/2000, 10.5',
      ),
    ).toThrow('Invalid date');
  });
});
