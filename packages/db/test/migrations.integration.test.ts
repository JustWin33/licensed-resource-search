import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

afterAll(async () => {
  await pool?.end();
});

describe('database migrations', () => {
  it('connects to the configured PostgreSQL database', async () => {
    expect(pool, 'DATABASE_URL must be set for integration tests').not.toBeNull();
    const result = await pool!.query<{ database: string }>('select current_database() as database');
    expect(result.rows[0]?.database).toBeTruthy();
  });

  it('has no unfinished or failed Prisma migrations', async () => {
    expect(pool, 'DATABASE_URL must be set for integration tests').not.toBeNull();
    const result = await pool!.query<{ total: string; incomplete: string }>(`
      select
        count(*)::text as total,
        count(*) filter (
          where finished_at is null or (logs is not null and rolled_back_at is null)
        )::text as incomplete
      from _prisma_migrations
    `);
    expect(Number(result.rows[0]?.total)).toBeGreaterThan(0);
    expect(Number(result.rows[0]?.incomplete)).toBe(0);
  });
});
