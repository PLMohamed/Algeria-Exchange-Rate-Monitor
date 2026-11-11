import { InternalServerErrorException } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BankOfAlgeriaService } from '../bank-of-algeria/bank-of-algeria.service.js';
import type { ParsedRate } from '../bank-of-algeria/bank-of-algeria.parser.js';
import { RatesService } from './rates.service.js';

const RATES: ParsedRate[] = [
  { currency: 'USD', rate: '136.3348', rateDate: '2026-11-11' },
  { currency: 'EUR', rate: '152.4428', rateDate: '2026-11-11' },
];

function createDatabase(returningResult: { id: string }[]) {
  const returning = vi.fn().mockResolvedValue(returningResult);
  const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  const insert = vi.fn().mockReturnValue({ values });

  return {
    db: { insert } as unknown as NodePgDatabase,
    insert,
    values,
    onConflictDoNothing,
    returning,
  };
}

function createBankOfAlgeriaService(rates: ParsedRate[]) {
  const fetchLatestRates = vi.fn().mockResolvedValue(rates);

  return {
    service: { fetchLatestRates } as unknown as BankOfAlgeriaService,
    fetchLatestRates,
  };
}

describe('RatesService', () => {
  it('inserts every fetched rate in a single bulk upsert', async () => {
    const { db, values, onConflictDoNothing } = createDatabase([
      { id: '1' },
      { id: '2' },
    ]);
    const { service: bankOfAlgeriaService } = createBankOfAlgeriaService(RATES);
    const service = new RatesService(db, bankOfAlgeriaService);

    await expect(service.ingestRates()).resolves.toEqual({
      fetched: 2,
      inserted: 2,
    });

    expect(values).toHaveBeenCalledWith(RATES);
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('reports only the rows actually inserted when some already exist', async () => {
    const { db } = createDatabase([{ id: '1' }]);
    const { service: bankOfAlgeriaService } = createBankOfAlgeriaService(RATES);
    const service = new RatesService(db, bankOfAlgeriaService);

    await expect(service.ingestRates()).resolves.toEqual({
      fetched: 2,
      inserted: 1,
    });
  });

  it('wraps database errors in an InternalServerErrorException', async () => {
    const { db, returning } = createDatabase([]);
    returning.mockRejectedValue(new Error('connection lost'));
    const { service: bankOfAlgeriaService } = createBankOfAlgeriaService(RATES);
    const service = new RatesService(db, bankOfAlgeriaService);

    await expect(service.ingestRates()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('fails when the source returns no rates', async () => {
    const { db, insert } = createDatabase([]);
    const { service: bankOfAlgeriaService } = createBankOfAlgeriaService([]);
    const service = new RatesService(db, bankOfAlgeriaService);

    await expect(service.ingestRates()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(insert).not.toHaveBeenCalled();
  });
});
