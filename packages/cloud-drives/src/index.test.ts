import { describe, expect, it } from 'vitest';
import {
  buildConfiguredRedirectUrl,
  classifyHttpStatus,
  isPublicNetworkAddress,
  normalizeCloudDriveUrl,
  validateExternalUrl,
  validatePublicHttpsUrl,
  validateRedirectTemplate,
} from './index.js';

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

describe('link checking and redirect templates', () => {
  it('rejects private and reserved resolved addresses', () => {
    expect(isPublicNetworkAddress('127.0.0.1')).toBe(false);
    expect(isPublicNetworkAddress('10.1.2.3')).toBe(false);
    expect(isPublicNetworkAddress('::1')).toBe(false);
    expect(isPublicNetworkAddress('8.8.8.8')).toBe(true);
  });

  it('classifies deterministic failures separately from access controls', () => {
    expect(classifyHttpStatus(404).status).toBe('expired');
    expect(classifyHttpStatus(403).status).toBe('risk_controlled');
    expect(classifyHttpStatus(200, true).status).toBe('need_password');
  });

  it('only renders allowlisted placeholders to allowlisted hosts', () => {
    expect(
      validateRedirectTemplate('https://pan.baidu.com/share?url={target_url}', ['target_url']),
    ).toEqual({ ok: true });
    expect(validateRedirectTemplate('https://example.com/{secret}', ['target_url']).ok).toBe(false);
    expect(
      buildConfiguredRedirectUrl(
        'https://pan.baidu.com/share?url={target_url}',
        ['target_url'],
        { target_url: 'https://pan.baidu.com/s/abc' },
        ['pan.baidu.com'],
      ).hostname,
    ).toBe('pan.baidu.com');
    expect(() =>
      buildConfiguredRedirectUrl(
        'https://evil.example/forward?url={target_url}',
        ['target_url'],
        { target_url: 'https://pan.baidu.com/s/abc' },
        ['pan.baidu.com'],
      ),
    ).toThrow('host_not_allowed');
  });
});
