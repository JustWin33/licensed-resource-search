import { describe, expect, it } from 'vitest';
import { decryptSensitive, encryptSensitive, hmacValue } from './crypto';

const secret = 'test-only-encryption-key-with-more-than-32-chars';

describe('sensitive value crypto', () => {
  it('round trips an encrypted passcode without embedding plaintext', () => {
    const encrypted = encryptSensitive('A1b2', secret);
    expect(encrypted).not.toContain('A1b2');
    expect(decryptSensitive(encrypted, secret)).toBe('A1b2');
  });

  it('produces stable keyed hashes', () => {
    expect(hmacValue('value', secret)).toBe(hmacValue('value', secret));
    expect(hmacValue('value', secret)).not.toBe(hmacValue('other', secret));
  });
});
