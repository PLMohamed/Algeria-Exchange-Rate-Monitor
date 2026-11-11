import { Module } from '@nestjs/common';
import { BankOfAlgeriaModule } from '../bank-of-algeria/bank-of-algeria.module.js';
import { RatesController } from './rates.controller.js';
import { RatesService } from './rates.service.js';

@Module({
  imports: [BankOfAlgeriaModule],
  controllers: [RatesController],
  providers: [RatesService],
})
export class RatesModule {}
