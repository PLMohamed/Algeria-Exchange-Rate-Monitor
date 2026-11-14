import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CronSecretGuard } from '../common/guards/cron-secret.guard.js';
import { RatesService, type IngestRatesResult } from './rates.service.js';

@ApiTags('rates')
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Post('ingest')
  @UseGuards(CronSecretGuard)
  @ApiOperation({ summary: 'Fetch and store the latest exchange rates' })
  @ApiHeader({
    name: 'x-cron-secret',
    description:
      'Shared secret configured in CRON_SECRET. A Bearer token in the Authorization header is also accepted.',
    required: true,
  })
  ingestRates(): Promise<IngestRatesResult> {
    return this.ratesService.ingestRates();
  }
}
