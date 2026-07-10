import { describe, expect, it } from 'vitest';

describe('database migration prerequisites', () => {
  it('is explicitly gated on the integration environment', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });
});
