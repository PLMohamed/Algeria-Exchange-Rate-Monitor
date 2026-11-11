import { Module } from '@nestjs/common';
import { BankOfAlgeriaService } from './bank-of-algeria.service.js';

@Module({
  providers: [BankOfAlgeriaService],
  exports: [BankOfAlgeriaService],
})
export class BankOfAlgeriaModule {}
