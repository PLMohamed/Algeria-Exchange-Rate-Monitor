import { Module } from '@nestjs/common';
import { CurrenciesService } from './currencies.service.js';
import { CurrenciesController } from './currencies.controller.js';

@Module({
  controllers: [CurrenciesController],
  providers: [CurrenciesService],
})
export class CurrenciesModule {}
