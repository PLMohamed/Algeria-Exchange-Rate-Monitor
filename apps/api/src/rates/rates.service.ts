import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BankOfAlgeriaService } from '../bank-of-algeria/bank-of-algeria.service.js';
import { exchangeRates } from '../db/schema/exchange-rates.js';

export type IngestRatesResult = {
  fetched: number;
  inserted: number;
};

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name, { timestamp: true });

  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly bankOfAlgeriaService: BankOfAlgeriaService,
  ) {}

  async ingestRates(): Promise<IngestRatesResult> {
    const rates = await this.bankOfAlgeriaService.fetchLatestRates();

    if (rates.length === 0) {
      this.logger.error('No rates fetched from the Bank of Algeria');
      throw new InternalServerErrorException(
        'No rates fetched from the Bank of Algeria. Please check the logs for more details.',
      );
    }

    let inserted: { id: string }[];

    try {
      inserted = await this.db
        .insert(exchangeRates)
        .values(rates)
        .onConflictDoNothing({
          target: [exchangeRates.currency, exchangeRates.rateDate],
        })
        .returning({ id: exchangeRates.id });
    } catch (error) {
      this.logger.error(
        'Error inserting rates into the database',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Error inserting rates into the database. Please check the logs for more details.',
      );
    }

    this.logger.log(
      `Ingested ${inserted.length} new rate(s) out of ${rates.length} fetched from the Bank of Algeria`,
    );

    return { fetched: rates.length, inserted: inserted.length };
  }
}
