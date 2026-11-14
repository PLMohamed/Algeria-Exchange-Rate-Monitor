import type { ConfigService } from '@nestjs/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ArchiveService } from './archive.service.js';

const HEADER = ['', 'USD / DZD,', '', ',USD / DZD', ''].join('\n');

function createDatabase() {
  const insertedChunks: unknown[][] = [];
  let lastChunk: unknown[] = [];

  const returning = vi.fn().mockImplementation(() =>
    Promise.resolve(lastChunk.map((_, index) => ({ id: String(index) }))),
  );
  const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockImplementation((chunk: unknown[]) => {
    lastChunk = chunk;
    insertedChunks.push(chunk);

    return { onConflictDoNothing };
  });
  const insert = vi.fn().mockReturnValue({ values });

  return {
    db: { insert } as unknown as NodePgDatabase,
    insert,
    values,
    onConflictDoNothing,
    insertedChunks,
  };
}

function createConfigService(directory: string): ConfigService {
  return {
    get: vi.fn().mockReturnValue(directory),
  } as unknown as ConfigService;
}

describe('ArchiveService', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'rates-archive-'));

    await writeFile(
      path.join(directory, 'rates(USD - DZD).csv'),
      `${HEADER}03/01/2000, 68.9491\n04/01/2000,\n`,
    );
    await writeFile(
      path.join(directory, 'rates(EURO - DZD).csv'),
      `${HEADER}03/01/2000, 70.0834\n04/01/2000, -\n05/01/2000, 70.5134\n`,
    );
    await writeFile(path.join(directory, 'notes.txt'), 'ignore me');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('imports every CSV file and reports parsed, inserted, and skipped rows', async () => {
    const { db, insertedChunks } = createDatabase();
    const service = new ArchiveService(db, createConfigService(directory));

    await expect(service.importArchive()).resolves.toEqual({
      files: 2,
      parsed: 3,
      inserted: 3,
      skipped: 2,
    });

    expect(insertedChunks).toHaveLength(1);
    expect(insertedChunks[0]).toEqual([
      { currency: 'EUR', rate: '70.0834', rateDate: '2000-01-03' },
      { currency: 'EUR', rate: '70.5134', rateDate: '2000-01-05' },
      { currency: 'USD', rate: '68.9491', rateDate: '2000-01-03' },
    ]);
  });

  it('fails when the archive directory has no CSV files', async () => {
    const emptyDirectory = await mkdtemp(
      path.join(tmpdir(), 'rates-archive-empty-'),
    );
    const { db } = createDatabase();
    const service = new ArchiveService(db, createConfigService(emptyDirectory));

    await expect(service.importArchive()).rejects.toThrow('No CSV files found');

    await rm(emptyDirectory, { recursive: true, force: true });
  });
});
