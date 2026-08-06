import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit config. `npm run db:generate` diffs db/schema.ts against
 * db/migrations and writes new SQL — no live database required. Applying
 * migrations (`db:migrate`) uses DATABASE_URL.
 */
export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/lambda_nx',
  },
  strict: true,
  verbose: true,
})
