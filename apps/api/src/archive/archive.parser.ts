export type ArchivedRate = {
  currency: string;
  rate: string;
  rateDate: string;
};

export type ParsedArchiveFile = {
  currency: string;
  rates: ArchivedRate[];
  skipped: number;
};

const FILE_CURRENCY_REGEX = /\(([A-Z]+) - DZD\)/;
const ROW_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})\s*,\s*(.*)$/;
const RATE_REGEX = /^\d+(?:\.\d+)?$/;

const CURRENCY_ALIASES: Record<string, string> = {
  EURO: 'EUR',
};

/**
 * Extracts the ISO currency code from an archive file name such as
 * `clean_Cotation-DZD-2000-2026-journalier(USD - DZD).csv`.
 */
export function currencyFromFileName(fileName: string): string {
  const match = FILE_CURRENCY_REGEX.exec(fileName);

  if (!match) {
    throw new Error(
      `Unable to determine the currency from archive file "${fileName}"`,
    );
  }

  const token = match[1];

  return CURRENCY_ALIASES[token] ?? token;
}

/**
 * Parses one historical archive CSV.
 *
 * The files have four header lines followed by `dd/mm/yyyy, value` rows.
 * Missing values (`""` or `-`) are skipped and counted so the caller can report
 * how much of the archive was usable. Rates stay as decimal strings to avoid a
 * float round-trip before they reach the `numeric` column.
 */
export function parseArchiveFile(
  fileName: string,
  content: string,
): ParsedArchiveFile {
  const currency = currencyFromFileName(fileName);
  const rates: ArchivedRate[] = [];
  let skipped = 0;

  for (const line of content.split(/\r?\n/)) {
    const match = ROW_REGEX.exec(line.trim());

    if (!match) {
      continue;
    }

    const [, dayText, monthText, yearText, valueText] = match;
    const rate = normalizeRate(valueText);

    if (!rate) {
      skipped += 1;
      continue;
    }

    rates.push({
      currency,
      rate,
      rateDate: toIsoDate(dayText, monthText, yearText, fileName),
    });
  }

  return { currency, rates, skipped };
}

function toIsoDate(
  dayText: string,
  monthText: string,
  yearText: string,
  fileName: string,
): string {
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
      `Invalid date "${dayText}/${monthText}/${yearText}" in archive file "${fileName}"`,
    );
  }

  return date.toISOString().slice(0, 10);
}

function normalizeRate(text: string): string | undefined {
  const normalized = text.replace(/\s/g, '');

  if (!RATE_REGEX.test(normalized)) {
    return undefined;
  }

  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return normalized;
}
