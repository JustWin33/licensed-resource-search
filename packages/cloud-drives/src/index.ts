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
