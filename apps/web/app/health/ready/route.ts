import Redis from 'ioredis';
import { getServerEnv } from '../../../src/server-env';
import { getPrisma } from '@platform/db';
import { createSearchClient } from '@platform/search';

export async function GET() {
  const env = getServerEnv();
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  const search = createSearchClient(env.MEILI_HOST, env.MEILI_MASTER_KEY);
  const prisma = getPrisma();
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.connect().then(() => redis.ping()),
    search.health(),
  ]);
  await redis.quit().catch(() => undefined);
  const ready = checks.every((check) => check.status === 'fulfilled');
  return Response.json(
    { status: ready ? 'ready' : 'not_ready', dependencies: checks.map((check) => check.status) },
    {
      status: ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    },
  );
}
