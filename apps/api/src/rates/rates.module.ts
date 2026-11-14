import { Module } from '@nestjs/common';
import { BankOfAlgeriaModule } from '../bank-of-algeria/bank-of-algeria.module.js';
import { CronSecretGuard } from '../common/guards/cron-secret.guard.js';
import { RatesController } from './rates.controller.js';
import { RatesScheduler } from './rates.scheduler.js';
import { RatesService } from './rates.service.js';

@Module({
  imports: [BankOfAlgeriaModule],
  controllers: [RatesController],
  providers: [RatesService, RatesScheduler, CronSecretGuard],
})
export class RatesModule {}
