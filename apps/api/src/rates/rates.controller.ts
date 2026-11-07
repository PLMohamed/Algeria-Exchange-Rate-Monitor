import { Controller, Post } from '@nestjs/common';
import { BankOfAlgeriaService } from '../bank-of-algeria/bank-of-algeria.service.js';
import { RatesService } from './rates.service.js';

@Controller('rates')
export class RatesController {
  constructor(
    private readonly ratesService: RatesService,
    private readonly bankOfAlgeriaService: BankOfAlgeriaService,
  ) {}

  @Post('ingest')
  async ingestRates(): Promise<void> {
    await this.ratesService.ingestRates();
    return;
  }

  @Post('ingest-from-bank-of-algeria')
  async ingestRatesFromBankOfAlgeria() {
    const rates = await this.bankOfAlgeriaService.fetchLatestRates();

    return rates;
  }
}
