import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { ArchiveService } from './archive.service.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const result = await app.get(ArchiveService).importArchive();

    Logger.log(
      `Archive import result: ${JSON.stringify(result)}`,
      'ImportArchive',
    );
  } catch (error) {
    Logger.error(
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error.stack : undefined,
      'ImportArchive',
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

await bootstrap();
