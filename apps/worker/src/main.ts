import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { getServerEnv } from '@platform/config/server';

const env = getServerEnv();
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

const worker = new Worker(
  'stage2-infrastructure',
  async (job) => {
    if (job.name === 'health-check') return { ok: true };
    throw new Error(`Unsupported stage two job: ${job.name}`);
  },
  {
    connection,
    concurrency: 1,
    settings: { backoffStrategy: () => 1000 },
  },
);

worker.on('completed', (job) =>
  console.info(JSON.stringify({ event: 'job.completed', jobId: job.id })),
);
worker.on('failed', (job, error) =>
  console.error(JSON.stringify({ event: 'job.failed', jobId: job?.id, error: error.message })),
);

async function shutdown(signal: string) {
  console.info(JSON.stringify({ event: 'worker.shutdown', signal }));
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
console.info(JSON.stringify({ event: 'worker.started', queue: 'stage2-infrastructure' }));
