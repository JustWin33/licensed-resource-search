import { describe, expect, it } from 'vitest';
import { normalizeCloudDriveUrl, validateExternalUrl, validatePublicHttpsUrl } from './index.js';

describe('external URL validation', () => {
  it('rejects private hosts and non-https URLs', () => {
    expect(validateExternalUrl(new URL('http://127.0.0.1/a'), ['example.com']).ok).toBe(false);
    expect(validateExternalUrl(new URL('https://example.com/a'), ['example.com']).ok).toBe(true);
  });

  it('rejects userinfo, IP literals and deceptive suffixes', () => {
    expect(validatePublicHttpsUrl(new URL('https://user:pass@example.com/a')).ok).toBe(false);
    expect(validatePublicHttpsUrl(new URL('https://[::1]/a')).ok).toBe(false);
    expect(
      validateExternalUrl(new URL('https://pan.baidu.com.evil.example/a'), ['pan.baidu.com']).ok,
    ).toBe(false);
  });

  it('normalizes approved provider links and removes passcodes from the URL', () => {
    const normalized = normalizeCloudDriveUrl(
      new URL('https://pan.baidu.com/s/abc/?pwd=1234&utm_source=test#fragment'),
      'baidu',
    );
    expect(normalized.toString()).toBe('https://pan.baidu.com/s/abc');
  });
});
