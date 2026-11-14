import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetRatesQueryDto } from './get-rates-query.dto.js';

async function validateQuery(input: Record<string, unknown>) {
  const dto = plainToInstance(GetRatesQueryDto, input);

  return { dto, errors: await validate(dto) };
}

describe('GetRatesQueryDto', () => {
  it('applies the default pagination values', async () => {
    const { dto, errors } = await validateQuery({});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(100);
  });

  it('converts pagination strings to numbers', async () => {
    const { dto, errors } = await validateQuery({ page: '2', limit: '50' });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('accepts a valid currency and date range', async () => {
    const { errors } = await validateQuery({
      currency: 'usd',
      from: '2026-01-01',
      to: '2026-10-30',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a currency that is not a 3-letter code', async () => {
    const { errors } = await validateQuery({ currency: 'US' });

    expect(errors).toHaveLength(1);
  });

  it('rejects an invalid calendar date', async () => {
    const { errors } = await validateQuery({ date: '2026-02-31' });

    expect(errors).toHaveLength(1);
  });

  it('rejects a date that is not in YYYY-MM-DD format', async () => {
    const { errors } = await validateQuery({ date: '30/10/2026' });

    expect(errors).toHaveLength(1);
  });

  it('rejects a limit above 500', async () => {
    const { errors } = await validateQuery({ limit: '501' });

    expect(errors).toHaveLength(1);
  });
});
