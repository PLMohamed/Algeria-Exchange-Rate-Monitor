import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Agent, fetch, type Response } from 'undici';
import { parseRatesPage, type ParsedRate } from './bank-of-algeria.parser.js';

const URL = 'https://www.bank-of-algeria.dz/taux-de-change-journalier';

@Injectable()
export class BankOfAlgeriaService {
  private readonly logger = new Logger(BankOfAlgeriaService.name, {
    timestamp: true,
  });
  private readonly agent = new Agent({
    connect: { rejectUnauthorized: false }, // the site sends an incomplete certificate chain
  });

  async fetchLatestRates(): Promise<ParsedRate[]> {
    const html = await this.fetchPage();

    try {
      const rates = parseRatesPage(html);
      const dates = new Set(rates.map((rate) => rate.rateDate));

      this.logger.log(
        `Parsed ${rates.length} rates across ${dates.size} date(s) from the Bank of Algeria`,
      );

      return rates;
    } catch (error) {
      const message = toErrorMessage(error);
      this.logger.error(
        `Failed to parse exchange rates from Bank of Algeria: ${message}`,
      );
      throw new InternalServerErrorException(
        `Failed to parse exchange rates from Bank of Algeria: ${message}`,
      );
    }
  }

  private async fetchPage(): Promise<string> {
    let response: Response;

    try {
      response = await fetch(URL, { dispatcher: this.agent });
    } catch (error) {
      const message = toErrorMessage(error);
      this.logger.error(
        `Failed to fetch exchange rates from Bank of Algeria: ${message}`,
      );
      throw new InternalServerErrorException(
        `Failed to fetch exchange rates from Bank of Algeria: ${message}`,
      );
    }

    if (!response.ok) {
      const message = `${response.status} ${response.statusText}`;
      this.logger.error(
        `Failed to fetch exchange rates from Bank of Algeria: ${message}`,
      );
      throw new InternalServerErrorException(
        `Failed to fetch exchange rates from Bank of Algeria: ${message}`,
      );
    }

    try {
      return await response.text();
    } catch (error) {
      const message = toErrorMessage(error);
      this.logger.error(
        `Failed to read exchange rates page from Bank of Algeria: ${message}`,
      );
      throw new InternalServerErrorException(
        `Failed to read exchange rates page from Bank of Algeria: ${message}`,
      );
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
