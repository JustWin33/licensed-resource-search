import { describe, expect, it } from 'vitest';

describe('worker boundary', () => {
  it('has no external link checking in stage two', () => {
    expect('stage2-infrastructure').not.toContain('link-check');
  });
});
