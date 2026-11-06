import {
  date,
  index,
  numeric,
  snakeCase,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const exchangeRates = snakeCase.table(
  'exchange_rates',
  {
    id: uuid().primaryKey().defaultRandom(),
    currency: varchar({ length: 3 }).notNull(),
    buy: numeric({ precision: 12, scale: 4 }).notNull(),
    sell: numeric({ precision: 12, scale: 4 }).notNull(),
    rateDate: date().notNull(),
    createdAt: timestamp({
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique().on(table.currency, table.rateDate),
    index().on(table.rateDate),
  ],
);

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
