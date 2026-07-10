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

const privateOrReservedHost = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$)/i;

export function validateExternalUrl(
  input: URL,
  allowedHosts: readonly string[],
): { ok: boolean; reason?: string } {
  if (input.protocol !== 'https:') return { ok: false, reason: 'https_required' };
  if (input.username || input.password) return { ok: false, reason: 'userinfo_not_allowed' };
  if (input.port) return { ok: false, reason: 'non_default_port_not_allowed' };
  if (privateOrReservedHost.test(input.hostname))
    return { ok: false, reason: 'private_host_not_allowed' };
  if (
    !allowedHosts.some((host) => input.hostname === host || input.hostname.endsWith(`.${host}`))
  ) {
    return { ok: false, reason: 'host_not_allowed' };
  }
  return { ok: true };
}
