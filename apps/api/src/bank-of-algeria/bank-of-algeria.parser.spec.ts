import { readFileSync } from 'node:fs';
import { parseRatesPage } from './bank-of-algeria.parser.js';

const fixture = readFileSync(
  new URL('./__fixtures__/rates-page.html', import.meta.url),
  'utf8',
);

function page(...tables: string[]): string {
  return `<div id="organizTable">${tables.join('')}</div>`;
}

function table(date: string | null, rows: string[]): string {
  const header = date ? `<thead><tr><th>${date}</th></tr></thead>` : '';

  return `<table>${header}<tbody>${rows.join('')}</tbody></table>`;
}

function valueRow(value: string): string {
  return `<tr><td>${value}</td></tr>`;
}

function currencyRow(currency: string, rate: string): string {
  return `<tr><td>${currency}</td><td>${rate}</td></tr>`;
}

describe('parseRatesPage', () => {
  it('parses every date table and maps currencies by position', () => {
    const rates = parseRatesPage(fixture);

    expect(rates).toHaveLength(90);
    expect([...new Set(rates.map((rate) => rate.rateDate))]).toEqual([
      '2026-11-11',
      '2026-11-10',
      '2026-11-09',
      '2026-11-06',
      '2026-11-05',
    ]);
    expect(rates[0]).toEqual({
      currency: 'USD',
      rate: '136.3348',
      rateDate: '2026-11-11',
    });
    expect(
      rates.find(
        (rate) => rate.currency === 'EUR' && rate.rateDate === '2026-11-05',
      )?.rate,
    ).toBe('152.7402');
    expect(rates.every((rate) => /^\d+\.\d{4}$/.test(rate.rate))).toBe(true);
  });

  it('keeps the decimal rate as a string and normalizes comma separators', () => {
    const rates = parseRatesPage(
      page(table('01-02-2026', [currencyRow('USD', '1 234,5678')])),
    );

    expect(rates).toEqual([
      { currency: 'USD', rate: '1234.5678', rateDate: '2026-02-01' },
    ]);
  });

  it('throws when the rate table container is missing', () => {
    expect(() => parseRatesPage('<html><body></body></html>')).toThrow(
      /No exchange-rate tables found/,
    );
  });

  it('throws when no currency can be read from the first table', () => {
    expect(() =>
      parseRatesPage(page(table('01-02-2026', [valueRow('136.3348')]))),
    ).toThrow(/No currencies found/);
  });

  it('throws when a table has no date header', () => {
    expect(() =>
      parseRatesPage(page(table(null, [currencyRow('USD', '136.3348')]))),
    ).toThrow(/No date found/);
  });

  it('throws on an invalid calendar date', () => {
    expect(() =>
      parseRatesPage(fixture.replace('11-11-2026', '31-02-2026')),
    ).toThrow(/Invalid date/);
  });

  it('throws when the number of rates does not match the currencies', () => {
    expect(() =>
      parseRatesPage(
        page(
          table('01-02-2026', [
            currencyRow('USD', '136.3348'),
            currencyRow('EUR', '152.4428'),
          ]),
          table('02-02-2026', [valueRow('136.1317')]),
        ),
      ),
    ).toThrow(
      /Mismatch between number of currencies \(2\) and number of rates \(1\)/,
    );
  });

  it('throws on a non-numeric rate', () => {
    expect(() =>
      parseRatesPage(page(table('01-02-2026', [currencyRow('USD', 'N/A')]))),
    ).toThrow(/Invalid rate for currency USD/);
  });
});
