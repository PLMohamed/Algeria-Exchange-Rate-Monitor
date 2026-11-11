import * as cheerio from 'cheerio';

export type ParsedRate = {
  currency: string;
  rate: string;
  rateDate: string;
};

const DATE_REGEX = /^(\d{2})-(\d{2})-(\d{4})$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const RATE_REGEX = /^\d+(?:\.\d+)?$/;

/**
 * Parses the Bank of Algeria daily rates page.
 *
 * The page renders one table per publication date inside `#organizTable`. The
 * first table holds `currency` + `rate` columns, while the following tables
 * only hold the rate values in the same currency order. Rates are returned as
 * decimal strings so they can be stored in a `numeric` column without a float
 * round-trip.
 */
export function parseRatesPage(html: string): ParsedRate[] {
  const $ = cheerio.load(html);
  const tables = $('#organizTable table');

  if (tables.length === 0) {
    throw new Error(
      'No exchange-rate tables found; the website structure may have changed',
    );
  }

  const currencies = tables
    .eq(0)
    .find('tbody tr')
    .map((_, row) => $(row).find('td').first().text().trim())
    .get()
    .filter((value) => CURRENCY_REGEX.test(value));

  if (currencies.length === 0) {
    throw new Error(
      'No currencies found in the first exchange-rate table; the website structure may have changed',
    );
  }

  const results: ParsedRate[] = [];

  tables.each((tableIndex, table) => {
    const dateText = $(table)
      .find('thead th')
      .map((_, cell) => $(cell).text().trim())
      .get()
      .find((value) => DATE_REGEX.test(value));

    if (!dateText) {
      throw new Error(
        `No date found in exchange-rate table #${tableIndex + 1}; the website structure may have changed`,
      );
    }

    const rateDate = toIsoDate(dateText, tableIndex);

    const rates = $(table)
      .find('tbody tr')
      .map((_, row) => $(row).find('td').last().text().trim())
      .get();

    if (rates.length !== currencies.length) {
      throw new Error(
        `Mismatch between number of currencies (${currencies.length}) and number of rates (${rates.length}) on ${dateText}`,
      );
    }

    rates.forEach((text, index) => {
      const currency = currencies[index];

      results.push({
        currency,
        rate: normalizeRate(text, currency, dateText),
        rateDate,
      });
    });
  });

  return results;
}

function toIsoDate(dateText: string, tableIndex: number): string {
  const match = DATE_REGEX.exec(dateText);

  if (!match) {
    throw new Error(
      `Invalid date "${dateText}" in exchange-rate table #${tableIndex + 1}`,
    );
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValidDate) {
    throw new Error(
      `Invalid date "${dateText}" in exchange-rate table #${tableIndex + 1}`,
    );
  }

  return date.toISOString().slice(0, 10);
}

function normalizeRate(
  text: string,
  currency: string,
  dateText: string,
): string {
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);

  if (!RATE_REGEX.test(normalized) || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Invalid rate for currency ${currency} on ${dateText}: "${text}"`,
    );
  }

  return normalized;
}
