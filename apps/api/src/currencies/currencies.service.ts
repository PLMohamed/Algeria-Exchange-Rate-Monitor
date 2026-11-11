import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { exchangeRates } from '../db/schema/exchange-rates.js';

@Injectable()
export class CurrenciesService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async getAllSupportedCurrencies() {
    return await this.db
      .selectDistinctOn([exchangeRates.currency], {
        currencyCode: exchangeRates.currency,
      })
      .from(exchangeRates)
      .orderBy(asc(exchangeRates.currency));
  }
}
