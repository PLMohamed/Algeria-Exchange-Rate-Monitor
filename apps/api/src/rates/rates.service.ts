import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BankOfAlgeriaService } from '../bank-of-algeria/bank-of-algeria.service.js';
import { exchangeRates } from '../db/schema/exchange-rates.js';

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name, { timestamp: true });
  private readonly MAX_RANGE_DAYS = 6;

  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly bankOfAlgeriaService: BankOfAlgeriaService,
  ) {}

  async ingestRates(): Promise<void> {
    const latestRates = await this.db
      .select({
        id: exchangeRates.id,
        currency: exchangeRates.currency,
        rateDate: exchangeRates.rateDate,
        createdAt: exchangeRates.createdAt,
      })
      .from(exchangeRates)
      .orderBy(desc(exchangeRates.rateDate))
      .limit(1);

    if (!latestRates || latestRates.length === 0) {
      this.logger.warn(
        'No rates found in the database. Please use the "ingest-all-rates" endpoint to ingest all rates.',
      );
      throw new BadRequestException(
        'No rates found in the database. Please use the "ingest-all-rates" endpoint to ingest all rates.',
      );
    }
    const latestRateDateValue = new Date(latestRates[0].rateDate);
    const latestRateDate = new Date(
      Date.UTC(
        latestRateDateValue.getUTCFullYear(),
        latestRateDateValue.getUTCMonth(),
        latestRateDateValue.getUTCDate(),
      ),
    );
    const currentDateValue = new Date();
    const currentDate = new Date(
      Date.UTC(
        currentDateValue.getUTCFullYear(),
        currentDateValue.getUTCMonth(),
        currentDateValue.getUTCDate(),
      ),
    );

    const diffTime = Math.abs(currentDate.getTime() - latestRateDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > this.MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `The latest rate date is older than ${this.MAX_RANGE_DAYS} days. Please use the "x" endpoint to ingest all rates.`,
      );
    }

    const rates = await this.bankOfAlgeriaService.fetchLatestRates();

    if (!rates || rates.length === 0) {
      this.logger.error('No rates fetched from the Bank of Algeria');
      throw new InternalServerErrorException(
        'No rates fetched from the Bank of Algeria. Please check the logs for more details.',
      );
    }

    await this.db.transaction(async (tx) => {
      try {
        for (const rate of rates) {
          if (rate.rateDate.getTime() <= latestRateDate.getTime()) {
            this.logger.warn(
              `Skipping rate for ${rate.currency} on ${rate.rateDate.toISOString()} as it is not newer than the latest rate date in the database.`,
            );
            continue;
          }

          await tx
            .insert(exchangeRates)
            .values({
              currency: String(rate.currency),
              rate: String(rate.rate),
              rateDate: new Date(
                Date.UTC(
                  rate.rateDate.getUTCFullYear(),
                  rate.rateDate.getUTCMonth(),
                  rate.rateDate.getUTCDate(),
                ),
              )
                .toISOString()
                .split('T')[0],
            })
            .onConflictDoNothing({
              target: [exchangeRates.currency, exchangeRates.rateDate],
            });
        }
      } catch (error) {
        this.logger.error('Error inserting rates into the database', error);
        throw new InternalServerErrorException(
          'Error inserting rates into the database. Please check the logs for more details.',
        );
      }
    });

    this.logger.log('Rates ingested successfully');
  }
}
