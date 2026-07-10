import { describe, expect, it } from 'vitest';
import { trustedClientAddress } from './rate-limit-address';

describe('trustedClientAddress', () => {
  it('ignores forwarded addresses when no proxy is trusted', () => {
    const request = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.8' },
    });
    expect(trustedClientAddress(request, 0)).toBeNull();
  });

  it('selects the address before the configured trusted proxy chain', () => {
    const request = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.2' },
    });
    expect(trustedClientAddress(request, 2)).toBe('203.0.113.8');
    expect(trustedClientAddress(request, 1)).toBe('10.0.0.2');
  });

  it('rejects malformed forwarded addresses', () => {
    const request = new Request('https://example.test', {
      headers: { 'x-forwarded-for': 'not-an-ip' },
    });
    expect(trustedClientAddress(request, 1)).toBeNull();
  });
});
