import { Module } from '@nestjs/common';
import { CronSecretGuard } from '../common/guards/cron-secret.guard.js';
import { ArchiveController } from './archive.controller.js';
import { ArchiveService } from './archive.service.js';

@Module({
  controllers: [ArchiveController],
  providers: [ArchiveService, CronSecretGuard],
  exports: [ArchiveService],
})
export class ArchiveModule {}
