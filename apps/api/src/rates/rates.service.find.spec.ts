import { BadRequestException } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BankOfAlgeriaService } from '../bank-of-algeria/bank-of-algeria.service.js';
import type { GetRatesQueryDto } from './dto/get-rates-query.dto.js';
import { RatesService, type RateItem } from './rates.service.js';

const ROWS: RateItem[] = [
  { currency: 'USD', rate: '135.507900', date: '2026-10-30' },
];

function createFindDatabase(rows: RateItem[], total: number) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockReturnValue({ offset });
  const orderBy = vi.fn().mockReturnValue({ limit });
  const rowsWhere = vi.fn().mockReturnValue({ orderBy });
  const rowsFrom = vi.fn().mockReturnValue({ where: rowsWhere });

  const countWhere = vi.fn().mockResolvedValue([{ total }]);
  const countFrom = vi.fn().mockReturnValue({ where: countWhere });

  const select = vi
    .fn()
    .mockReturnValueOnce({ from: rowsFrom })
    .mockReturnValueOnce({ from: countFrom });

  return {
    db: { select } as unknown as NodePgDatabase,
    select,
    limit,
    offset,
  };
}

function createService(db: NodePgDatabase) {
  return new RatesService(db, {} as BankOfAlgeriaService);
}

describe('RatesService.findRates', () => {
  it('returns a paginated envelope ordered by the service query', async () => {
    const { db, limit, offset } = createFindDatabase(ROWS, 25);
    const service = createService(db);

    const result = await service.findRates({
      currency: 'usd',
      page: 2,
      limit: 10,
    } satisfies GetRatesQueryDto);

    expect(result).toEqual({
      data: ROWS,
      meta: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
    expect(limit).toHaveBeenCalledWith(10);
    expect(offset).toHaveBeenCalledWith(10);
  });

  it('uses the default pagination when none is provided', async () => {
    const { db, limit, offset } = createFindDatabase(ROWS, 1);
    const service = createService(db);

    const result = await service.findRates({} as GetRatesQueryDto);

    expect(result.meta).toEqual({
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    });
    expect(limit).toHaveBeenCalledWith(100);
    expect(offset).toHaveBeenCalledWith(0);
  });

  it('rejects a from date after the to date', async () => {
    const { db, select } = createFindDatabase(ROWS, 0);
    const service = createService(db);

    await expect(
      service.findRates({
        from: '2026-10-31',
        to: '2026-10-01',
      } as GetRatesQueryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(select).not.toHaveBeenCalled();
  });
});
