import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { RatesModule } from './rates/rates.module.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule.forRootAsync({
      useFactory: async () => {
        const db = drizzle(process.env.DATABASE_URL!);

        if (process.env.MIGRATE === 'true') {
          await migrate(db, { migrationsFolder: './drizzle' });
        }

        return { db };
      },
    }),
    RatesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
