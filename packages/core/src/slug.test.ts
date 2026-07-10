import { describe, expect, it } from 'vitest';
import { decodeSlugParam, slugifyTitle } from './slug';

describe('slug helpers', () => {
  it('round-trips percent-encoded Chinese slugs', () => {
    const slug = slugifyTitle('Codex 授权资料', '019f4aee');
    expect(decodeSlugParam(encodeURIComponent(slug))).toBe(slug);
  });

  it('rejects malformed or path-like values', () => {
    expect(decodeSlugParam('%E0%A4%A')).toBeNull();
    expect(decodeSlugParam('../secret')).toBeNull();
  });
});
