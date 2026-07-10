import { describe, expect, it } from 'vitest';
import { validateExternalUrl } from './index.js';

describe('external URL validation', () => {
  it('rejects private hosts and non-https URLs', () => {
    expect(validateExternalUrl(new URL('http://127.0.0.1/a'), ['example.com']).ok).toBe(false);
    expect(validateExternalUrl(new URL('https://example.com/a'), ['example.com']).ok).toBe(true);
  });
});
