import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle } from '@nestjs/drizzle';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  exchangeRates,
  type NewExchangeRate,
} from '../db/schema/exchange-rates.js';
import { parseArchiveFile } from './archive.parser.js';

const CHUNK_SIZE = 1_000;

export type ArchiveImportResult = {
  files: number;
  parsed: number;
  inserted: number;
  skipped: number;
};

@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name, {
    timestamp: true,
  });

  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly configService: ConfigService,
  ) {}

  async importArchive(): Promise<ArchiveImportResult> {
    const directory = path.resolve(
      process.cwd(),
      this.configService.get<string>('ARCHIVE_DIR') ?? 'archive',
    );
    const files = await this.listCsvFiles(directory);

    if (files.length === 0) {
      throw new InternalServerErrorException(
        `No CSV files found in the archive directory "${directory}"`,
      );
    }

    const rates: NewExchangeRate[] = [];
    let skipped = 0;

    for (const file of files) {
      const content = await this.readFile(path.join(directory, file));
      const parsed = parseArchiveFile(file, content);

      rates.push(...parsed.rates);
      skipped += parsed.skipped;
    }

    if (rates.length === 0) {
      throw new InternalServerErrorException(
        `The archive directory "${directory}" contains no usable rates`,
      );
    }

    let inserted = 0;

    try {
      for (let index = 0; index < rates.length; index += CHUNK_SIZE) {
        const chunk = rates.slice(index, index + CHUNK_SIZE);
        const rows = await this.db
          .insert(exchangeRates)
          .values(chunk)
          .onConflictDoNothing({
            target: [exchangeRates.currency, exchangeRates.rateDate],
          })
          .returning({ id: exchangeRates.id });

        inserted += rows.length;
      }
    } catch (error) {
      this.logger.error(
        'Error importing the archive into the database',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Error importing the archive into the database. Please check the logs for more details.',
      );
    }

    this.logger.log(
      `Archive import completed: ${inserted} new rate(s) out of ${rates.length} parsed from ${files.length} file(s), ${skipped} row(s) skipped`,
    );

    return { files: files.length, parsed: rates.length, inserted, skipped };
  }

  private async listCsvFiles(directory: string): Promise<string[]> {
    try {
      const entries = await readdir(directory);

      return entries.filter((entry) => entry.endsWith('.csv')).sort();
    } catch (error) {
      this.logger.error(
        `Unable to read the archive directory "${directory}"`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Unable to read the archive directory "${directory}"`,
      );
    }
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, 'utf8');
    } catch (error) {
      this.logger.error(
        `Unable to read archive file "${filePath}"`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Unable to read archive file "${filePath}"`,
      );
    }
  }
}
