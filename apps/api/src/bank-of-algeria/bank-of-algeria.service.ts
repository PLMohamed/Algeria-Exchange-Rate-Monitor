import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as cheerio from 'cheerio';
import { Agent, fetch, type Response } from 'undici';

type Rate = { currency: string; rate: number; rateDate: Date };

const URL = 'https://www.bank-of-algeria.dz/taux-de-change-journalier';
const DATE_REGEX = /^\d{2}-\d{2}-\d{4}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

@Injectable()
export class BankOfAlgeriaService {
  private readonly logger = new Logger(BankOfAlgeriaService.name, {
    timestamp: true,
  });
  private readonly agent = new Agent({
    connect: { rejectUnauthorized: false }, // the site sends an incomplete certificate chain
  });

  async fetchLatestRates() {
    let response: Response;
    try {
      response = await fetch(URL, { dispatcher: this.agent });
    } catch (error) {
      this.logger.error(
        `Failed to fetch exchange rates from Bank of Algeria: ${error}`,
      );
      throw new InternalServerErrorException(
        `Failed to fetch exchange rates from Bank of Algeria: ${error}`,
      );
    }

    if (!response.ok) {
      this.logger.error(
        `Failed to fetch exchange rates from Bank of Algeria: ${response.status} ${response.statusText}`,
      );
      throw new InternalServerErrorException(
        `Failed to fetch exchange rates from Bank of Algeria: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const tables = $('#organizTable table');

    if (tables.length === 0) {
      this.logger.error(
        'No exchange-rate tables found; the website structure may have changed',
      );
      throw new InternalServerErrorException(
        'No exchange-rate tables found; the website structure may have changed',
      );
    }

    const currencies: string[] = tables
      .eq(0)
      .find('tbody tr')
      .map((_, row) => $(row).find('td').first().text().trim())
      .get()
      .filter((value) => CURRENCY_REGEX.test(value));

    const results: Rate[] = [];

    tables.each((_, table) => {
      const dateText = $(table)
        .find('thead th')
        .map((__, cell) => $(cell).text().trim())
        .get()
        .find((value) => DATE_REGEX.test(value));

      if (!dateText) {
        this.logger.error(
          'No date found in table header; the website structure may have changed',
        );
        throw new InternalServerErrorException(
          'No date found in table header; the website structure may have changed',
        );
      }

      const [day, month, year] = dateText.split('-').map(Number);
      const rateDate = new Date(Date.UTC(year, month - 1, day));

      const rates = $(table)
        .find('tbody tr')
        .map((__, row) => $(row).find('td').last().text().trim())
        .get();

      if (rates.length !== currencies.length) {
        this.logger.error(
          `Mismatch between number of currencies (${currencies.length}) and number of rates (${rates.length}) on ${dateText}`,
        );
        throw new InternalServerErrorException(
          `Mismatch between number of currencies (${currencies.length}) and number of rates (${rates.length}) on ${dateText}`,
        );
      }

      rates.forEach((text, i) => {
        const rate = Number(text.replace(/\s/g, '').replace(',', '.'));

        if (!Number.isFinite(rate)) {
          this.logger.error(
            `Invalid rate for currency ${currencies[i]} on ${dateText}: ${text}`,
          );
          throw new InternalServerErrorException(
            `Invalid rate for currency ${currencies[i]} on ${dateText}: ${text}`,
          );
        }

        results.push({ currency: currencies[i], rate, rateDate });
      });
    });

    const dates = new Set(results.map((r) => r.rateDate.toISOString()));
    this.logger.log(
      `Parsed ${results.length} rates for ${currencies.length} currencies across ${dates.size} dates`,
    );

    return results;
  }
}
