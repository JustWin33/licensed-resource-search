import 'server-only';
import Redis from 'ioredis';
import { cookies } from 'next/headers';
import { hmacValue, randomToken } from '@platform/core';
import { getServerEnv } from '../server-env';
import { HttpError } from './http';
import { trustedClientAddress } from './rate-limit-address';

const CLIENT_COOKIE = 'lrs_rate_client';

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  subject?: string;
};

const globalForRedis = globalThis as unknown as { rateLimitRedis?: Redis };

function redisClient(): Redis {
  if (!globalForRedis.rateLimitRedis) {
    globalForRedis.rateLimitRedis = new Redis(getServerEnv().REDIS_URL, {
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }
  return globalForRedis.rateLimitRedis;
}

async function anonymousClientToken(request: Request): Promise<string> {
  const env = getServerEnv();
  const address = trustedClientAddress(request, env.TRUSTED_PROXY_HOPS);
  if (address) return `ip:${address}`;

  const cookieStore = await cookies();
  const existing = cookieStore.get(CLIENT_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{20,128}$/.test(existing)) return `cookie:${existing}`;

  const token = randomToken(24);
  cookieStore.set(CLIENT_COOKIE, token, {
    httpOnly: true,
    secure: env.APP_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return `cookie:${token}`;
}

export async function enforceRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<string> {
  const env = getServerEnv();
  const rawIdentity = options.subject
    ? `subject:${options.subject.trim().toLowerCase()}`
    : await anonymousClientToken(request);
  const fingerprint = hmacValue(rawIdentity, env.URL_HASH_SECRET);
  const key = `lrs:rate:${options.scope}:${fingerprint}`;
  const redis = redisClient();

  try {
    if (redis.status === 'wait') await redis.connect();
    const count = (await redis.eval(
      "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
      1,
      key,
      String(options.windowSeconds),
    )) as number;
    if (count > options.limit) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many requests; please try again later', {
        'Retry-After': String(options.windowSeconds),
      });
    }
    return fingerprint;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'RATE_LIMIT_UNAVAILABLE', 'Request protection is unavailable');
  }
}
