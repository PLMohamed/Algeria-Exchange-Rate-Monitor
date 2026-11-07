import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: process.env.DEPLOYMENT_ENV === 'local' ? './drizzle-local' : './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
