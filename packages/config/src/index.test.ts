import { describe, expect, it } from 'vitest';
import { envSchema } from './index.js';

describe('environment schema', () => {
  it('accepts the test environment shape', () => {
    const parsed = envSchema.parse({
      APP_ENV: 'test',
      APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_NAME: 'test',
      DATABASE_URL: 'postgresql://app:test@localhost:5432/app',
      REDIS_URL: 'redis://:test@localhost:6379/0',
      MEILI_HOST: 'http://localhost:7700',
      MEILI_MASTER_KEY: '1234567890123456',
      SESSION_SECRET: '12345678901234567890123456789012',
      URL_HASH_SECRET: '12345678901234567890123456789012',
      ENCRYPTION_KEY: '12345678901234567890123456789012',
    });
    expect(parsed.REGION_STATS_ENABLED).toBe(false);
  });
});
