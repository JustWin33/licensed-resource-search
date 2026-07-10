export type LinkStatus =
  | 'pending'
  | 'available'
  | 'expired'
  | 'need_password'
  | 'password_error'
  | 'risk_controlled'
  | 'unsupported'
  | 'unknown'
  | 'disabled';

export type CloudLinkForCheck = {
  normalizedUrl: URL;
  provider: string;
  adapterVersion: string;
  hasPasscode?: boolean;
};

export type LinkCheckResult = {
  status: LinkStatus;
  httpResultClass: 'none' | '2xx' | '3xx' | '4xx' | '5xx' | 'network_error' | 'blocked';
  checkedAt: string;
  adapterVersion: string;
  durationMs: number;
  errorCategory?: string;
};

export type RedirectChannel = { slug: string; template: string; provider: string };

export interface CloudDriveAdapter {
  readonly provider: string;
  canHandle(input: URL): boolean;
  normalizeUrl(input: URL): URL;
  validateForStorage(input: URL): { ok: boolean; reason?: string };
  checkAvailability(link: CloudLinkForCheck): Promise<LinkCheckResult>;
  buildRedirectUrl(link: { normalizedUrl: URL }, channel?: RedirectChannel): URL;
}

const providerHosts: Readonly<Record<string, readonly string[]>> = {
  quark: ['pan.quark.cn'],
  baidu: ['pan.baidu.com'],
};

function normalizedHostname(input: URL): string {
  return input.hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function looksLikeIpLiteral(hostname: string): boolean {
  return (
    /^\d+(?:\.\d+){1,3}$/.test(hostname) ||
    hostname.includes(':') ||
    /^0x[0-9a-f]+$/i.test(hostname)
  );
}

export function validatePublicHttpsUrl(input: URL): { ok: boolean; reason?: string } {
  const hostname = normalizedHostname(input);
  if (input.protocol !== 'https:') return { ok: false, reason: 'https_required' };
  if (input.username || input.password) return { ok: false, reason: 'userinfo_not_allowed' };
  if (input.port) return { ok: false, reason: 'non_default_port_not_allowed' };
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, reason: 'localhost_not_allowed' };
  }
  if (looksLikeIpLiteral(hostname)) return { ok: false, reason: 'ip_literal_not_allowed' };
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { ok: false, reason: 'private_host_not_allowed' };
  }
  return { ok: true };
}

export function validateExternalUrl(
  input: URL,
  allowedHosts: readonly string[],
): { ok: boolean; reason?: string } {
  const publicResult = validatePublicHttpsUrl(input);
  if (!publicResult.ok) return publicResult;
  const hostname = normalizedHostname(input);
  const normalizedAllowedHosts = allowedHosts.map((host) => host.toLowerCase());
  if (!normalizedAllowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    return { ok: false, reason: 'host_not_allowed' };
  }
  return { ok: true };
}

export function normalizeCloudDriveUrl(
  input: URL,
  provider: string,
  extraAllowedHosts: readonly string[] = [],
): URL {
  const allowedHosts = providerHosts[provider] ?? extraAllowedHosts;
  const validation = validateExternalUrl(input, allowedHosts);
  if (!validation.ok) throw new Error(validation.reason ?? 'invalid_cloud_url');
  const output = new URL(input.toString());
  output.hash = '';
  for (const key of [...output.searchParams.keys()]) {
    if (key === 'pwd' || key === 'password' || key.startsWith('utm_') || key === 'from') {
      output.searchParams.delete(key);
    }
  }
  output.searchParams.sort();
  if (output.pathname.length > 1) output.pathname = output.pathname.replace(/\/+$/, '');
  return output;
}

export function providerAllowedHosts(provider: string): readonly string[] {
  return providerHosts[provider] ?? [];
}

export function isPublicNetworkAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a = 0, b = 0] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return isPublicNetworkAddress(mapped);
    return !(
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    );
  }
  return false;
}

export function classifyHttpStatus(
  statusCode: number,
  hasPasscode = false,
): Pick<LinkCheckResult, 'status' | 'httpResultClass' | 'errorCategory'> {
  if (statusCode >= 200 && statusCode < 300) {
    return {
      status: hasPasscode ? 'need_password' : 'available',
      httpResultClass: '2xx',
    };
  }
  if (statusCode >= 300 && statusCode < 400) {
    return { status: 'unknown', httpResultClass: '3xx', errorCategory: 'redirect_unresolved' };
  }
  if (statusCode === 404 || statusCode === 410) {
    return { status: 'expired', httpResultClass: '4xx', errorCategory: 'not_found' };
  }
  if ([401, 403, 429].includes(statusCode)) {
    return { status: 'risk_controlled', httpResultClass: '4xx', errorCategory: 'access_limited' };
  }
  if (statusCode >= 400 && statusCode < 500) {
    return { status: 'unknown', httpResultClass: '4xx', errorCategory: 'client_response' };
  }
  return { status: 'unknown', httpResultClass: '5xx', errorCategory: 'upstream_error' };
}

type ResponseHead = {
  statusCode: number;
  location?: string;
  contentType?: string;
};

async function requestHead(url: URL, timeoutMs: number): Promise<ResponseHead> {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicNetworkAddress(address))) {
    throw new Error('blocked_network_address');
  }
  const selected = addresses[0]!;
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: 'HEAD',
        headers: {
          Accept: 'text/html,application/json,text/plain;q=0.8',
          'User-Agent': 'LicensedResourceLinkChecker/1.0',
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, selected.address, selected.family),
        signal: AbortSignal.timeout(timeoutMs),
      },
      (response) => {
        response.destroy();
        resolve({
          statusCode: response.statusCode ?? 0,
          location: response.headers.location,
          contentType: response.headers['content-type'],
        });
      },
    );
    request.once('error', reject);
    request.end();
  });
}

export async function checkCloudLink(
  link: CloudLinkForCheck,
  allowedHosts: readonly string[],
  options: { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<LinkCheckResult> {
  const startedAt = Date.now();
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 8_000, 500), 15_000);
  const maxRedirects = Math.min(Math.max(options.maxRedirects ?? 2, 0), 3);
  let target = normalizeCloudDriveUrl(link.normalizedUrl, link.provider, allowedHosts);
  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const response = await requestHead(target, timeoutMs);
      if (response.statusCode >= 300 && response.statusCode < 400 && response.location) {
        if (redirectCount === maxRedirects) break;
        target = normalizeCloudDriveUrl(
          new URL(response.location, target),
          link.provider,
          allowedHosts,
        );
        continue;
      }
      const result = classifyHttpStatus(response.statusCode, link.hasPasscode);
      return {
        ...result,
        checkedAt: new Date().toISOString(),
        adapterVersion: link.adapterVersion,
        durationMs: Date.now() - startedAt,
      };
    }
    return {
      status: 'unknown',
      httpResultClass: '3xx',
      checkedAt: new Date().toISOString(),
      adapterVersion: link.adapterVersion,
      durationMs: Date.now() - startedAt,
      errorCategory: 'redirect_limit',
    };
  } catch (error) {
    const category = error instanceof Error ? error.message : 'network_error';
    const blocked = category.includes('blocked') || category.includes('not_allowed');
    return {
      status: blocked ? 'unsupported' : 'unknown',
      httpResultClass: blocked ? 'blocked' : 'network_error',
      checkedAt: new Date().toISOString(),
      adapterVersion: link.adapterVersion,
      durationMs: Date.now() - startedAt,
      errorCategory: blocked ? 'ssrf_blocked' : 'network_error',
    };
  }
}

const placeholderPattern = /\{([a-z][a-z0-9_]*)\}/g;

export function validateRedirectTemplate(
  template: string,
  allowedPlaceholders: readonly string[],
): { ok: boolean; reason?: string } {
  const placeholders = [...template.matchAll(placeholderPattern)].map((match) => match[1]!);
  if (placeholders.some((placeholder) => !allowedPlaceholders.includes(placeholder))) {
    return { ok: false, reason: 'placeholder_not_allowed' };
  }
  if (/\{[^}]*\}/.test(template.replace(placeholderPattern, ''))) {
    return { ok: false, reason: 'placeholder_invalid' };
  }
  try {
    const probe = new URL(
      template.replace(placeholderPattern, (_match, name: string) =>
        encodeURIComponent(name === 'target_url' ? 'https://example.com/s/share' : 'probe'),
      ),
    );
    return validatePublicHttpsUrl(probe);
  } catch {
    return { ok: false, reason: 'template_url_invalid' };
  }
}

export function buildConfiguredRedirectUrl(
  template: string,
  allowedPlaceholders: readonly string[],
  values: Readonly<Record<string, string>>,
  allowedTargetHosts: readonly string[],
): URL {
  const validation = validateRedirectTemplate(template, allowedPlaceholders);
  if (!validation.ok) throw new Error(validation.reason ?? 'redirect_template_invalid');
  const rendered = template.replace(placeholderPattern, (_match, name: string) => {
    if (!allowedPlaceholders.includes(name) || values[name] === undefined) {
      throw new Error('redirect_placeholder_missing');
    }
    return encodeURIComponent(values[name]);
  });
  const output = new URL(rendered);
  const targetValidation = validateExternalUrl(output, allowedTargetHosts);
  if (!targetValidation.ok) throw new Error(targetValidation.reason ?? 'redirect_target_invalid');
  return output;
}
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
