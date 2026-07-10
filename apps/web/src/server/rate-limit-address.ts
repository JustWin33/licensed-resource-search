import { isIP } from 'node:net';

export function trustedClientAddress(request: Request, trustedProxyHops: number): string | null {
  if (trustedProxyHops < 1) return null;
  const chain = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!chain || chain.length < trustedProxyHops) return null;
  const candidate = chain[chain.length - trustedProxyHops];
  return candidate && isIP(candidate) ? candidate : null;
}
