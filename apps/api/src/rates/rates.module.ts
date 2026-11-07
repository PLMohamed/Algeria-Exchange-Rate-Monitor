import { Module } from '@nestjs/common';
import { RatesService } from './rates.service.js';
import { RatesController } from './rates.controller.js';
import { BankOfAlgeriaService } from '../bank-of-algeria/bank-of-algeria.service.js';

@Module({
  controllers: [RatesController],
  providers: [RatesService, BankOfAlgeriaService],
})
export class RatesModule {}
