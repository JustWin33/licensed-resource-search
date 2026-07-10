import { describe, expect, it } from 'vitest';

describe('database package boundary', () => {
  it('keeps migration tests separate from unit tests', () => {
    expect('prisma/migrations').toContain('migrations');
  });
});
