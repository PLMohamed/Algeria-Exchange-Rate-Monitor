import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CronSecretGuard } from '../common/guards/cron-secret.guard.js';
import { ArchiveService, type ArchiveImportResult } from './archive.service.js';

@ApiTags('rates')
@Controller('rates/import-archive')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Post()
  @UseGuards(CronSecretGuard)
  @ApiOperation({
    summary: 'Import the historical exchange-rate archive into the database',
  })
  @ApiHeader({
    name: 'x-cron-secret',
    description:
      'Shared secret configured in CRON_SECRET. A Bearer token in the Authorization header is also accepted.',
    required: true,
  })
  importArchive(): Promise<ArchiveImportResult> {
    return this.archiveService.importArchive();
  }
}
