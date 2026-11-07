import { Controller, Get } from '@nestjs/common';
import { CurrenciesService } from './currencies.service.js';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  async getAllSupportedCurrencies() {
    return await this.currenciesService.getAllSupportedCurrencies();
  }
}
