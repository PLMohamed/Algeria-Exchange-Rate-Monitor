import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { RatesModule } from './rates/rates.module.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { CurrenciesModule } from './currencies/currencies.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { BankOfAlgeriaService } from './bank-of-algeria/bank-of-algeria.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule.forRootAsync({
      useFactory: async () => {
        const db = drizzle(process.env.DATABASE_URL!);

        if (process.env.MIGRATE === 'true') {
          await migrate(db, {
            migrationsFolder:
              process.env.DEPLOYMENT_ENV === 'local'
                ? './drizzle-local'
                : './drizzle',
          });
        }

        return { db };
      },
    }),
    RatesModule,
    CurrenciesModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, BankOfAlgeriaService],
})
export class AppModule {}
