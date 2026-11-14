import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

const CURRENCY_REGEX = /^[A-Za-z]{3}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class GetRatesQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 4217 currency code (case-insensitive)',
    example: 'USD',
  })
  @IsOptional()
  @Matches(CURRENCY_REGEX, {
    message: 'currency must be a 3-letter ISO 4217 code',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Inclusive start date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'from must use the YYYY-MM-DD format' })
  @IsDateString(
    { strict: true },
    { message: 'from must be a valid calendar date' },
  )
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end date (YYYY-MM-DD)',
    example: '2026-10-30',
  })
  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'to must use the YYYY-MM-DD format' })
  @IsDateString(
    { strict: true },
    { message: 'to must be a valid calendar date' },
  )
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 100;
}
