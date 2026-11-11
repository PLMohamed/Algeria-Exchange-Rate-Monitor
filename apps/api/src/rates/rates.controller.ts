import { Controller, Post } from '@nestjs/common';
import { RatesService, type IngestRatesResult } from './rates.service.js';

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Post('ingest')
  ingestRates(): Promise<IngestRatesResult> {
    return this.ratesService.ingestRates();
  }
}
