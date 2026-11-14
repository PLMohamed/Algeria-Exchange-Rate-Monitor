import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RatesService } from './rates.service.js';

export const DAILY_INGESTION_CRON = '0 0 10 * * *';

/**
 * Runs the rate ingestion once a day, after the Bank of Algeria has published
 * the day's quotation.
 */
@Injectable()
export class RatesScheduler {
  private readonly logger = new Logger(RatesScheduler.name, { timestamp: true });

  constructor(private readonly ratesService: RatesService) {}

  @Cron(DAILY_INGESTION_CRON, {
    timeZone: 'Africa/Algiers',
    waitForCompletion: true,
  })
  async ingestDailyRates(): Promise<void> {
    try {
      const { fetched, inserted } = await this.ratesService.ingestRates();

      this.logger.log(
        `Daily ingestion completed: ${inserted} new rate(s) out of ${fetched} fetched`,
      );
    } catch (error) {
      this.logger.error(
        'Daily ingestion failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
