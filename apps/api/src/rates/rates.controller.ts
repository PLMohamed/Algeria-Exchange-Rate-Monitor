import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CronSecretGuard } from '../common/guards/cron-secret.guard.js';
import { GetRatesQueryDto } from './dto/get-rates-query.dto.js';
import {
  RatesService,
  type FindRatesResult,
  type IngestRatesResult,
} from './rates.service.js';

@ApiTags('rates')
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  findRates(@Query() query: GetRatesQueryDto): Promise<FindRatesResult> {
    return this.ratesService.findRates(query);
  }

  @Post('ingest')
  @UseGuards(CronSecretGuard)
  @ApiHeader({
    name: 'x-cron-secret',
    required: true,
  })
  ingestRates(): Promise<IngestRatesResult> {
    return this.ratesService.ingestRates();
  }
}
