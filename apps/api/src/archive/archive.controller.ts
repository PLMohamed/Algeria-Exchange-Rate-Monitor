import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CronSecretGuard } from '../common/guards/cron-secret.guard.js';
import { ArchiveService, type ArchiveImportResult } from './archive.service.js';

@ApiTags('rates')
@Controller('rates/import-archive')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Post()
  @UseGuards(CronSecretGuard)
  @ApiHeader({
    name: 'x-cron-secret',
    required: true,
  })
  importArchive(): Promise<ArchiveImportResult> {
    return this.archiveService.importArchive();
  }
}
