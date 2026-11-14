import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BankOfAlgeriaService } from '../bank-of-algeria/bank-of-algeria.service.js';
import { exchangeRates } from '../db/schema/exchange-rates.js';
import type { GetRatesQueryDto } from './dto/get-rates-query.dto.js';

export type IngestRatesResult = {
  fetched: number;
  inserted: number;
};

export type RateItem = {
  currency: string;
  rate: string;
  date: string;
};

export type FindRatesResult = {
  data: RateItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name, { timestamp: true });

  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly bankOfAlgeriaService: BankOfAlgeriaService,
  ) {}

  async findRates(query: GetRatesQueryDto): Promise<FindRatesResult> {
    const { currency, from, to } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;

    if (from && to && from > to) {
      throw new BadRequestException('"from" must be before or equal to "to"');
    }

    const filters: SQL[] = [];

    if (currency) {
      filters.push(eq(exchangeRates.currency, currency.toUpperCase()));
    }

    if (from) {
      filters.push(gte(exchangeRates.rateDate, from));
    }

    if (to) {
      filters.push(lte(exchangeRates.rateDate, to));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    try {
      const [rows, totals] = await Promise.all([
        this.db
          .select({
            currency: exchangeRates.currency,
            rate: exchangeRates.rate,
            date: exchangeRates.rateDate,
          })
          .from(exchangeRates)
          .where(where)
          .orderBy(desc(exchangeRates.rateDate), asc(exchangeRates.currency))
          .limit(limit)
          .offset((page - 1) * limit),
        this.db.select({ total: count() }).from(exchangeRates).where(where),
      ]);

      const total = Number(totals[0]?.total ?? 0);

      return {
        data: rows,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        'Error fetching rates from the database',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Error fetching rates from the database. Please check the logs for more details.',
      );
    }
  }

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
