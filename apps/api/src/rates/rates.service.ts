import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class RatesService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}
}
