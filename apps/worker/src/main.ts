import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { publicationGate } from '@platform/core';
import { getPrisma } from '@platform/db';
import {
  buildPublicSearchDocument,
  createSearchClient,
  PUBLIC_RESOURCE_INDEX,
  publicIndexSettings,
} from '@platform/search';
import { getServerEnv } from '@platform/config/server';

const env = getServerEnv();
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});
const search = createSearchClient(env.MEILI_HOST, env.MEILI_MASTER_KEY);
const prisma = getPrisma();

const queueWorker = new Worker(
  'stage3-infrastructure',
  async (job) => {
    if (job.name === 'health-check') return { ok: true };
    throw new Error(`Unsupported job: ${job.name}`);
  },
  {
    connection,
    concurrency: 2,
    settings: { backoffStrategy: (attemptsMade) => Math.min(30_000, 1_000 * 2 ** attemptsMade) },
  },
);

let indexReady = false;
let polling = false;

async function ensureIndex() {
  if (indexReady) return;
  const index = search.index(PUBLIC_RESOURCE_INDEX);
  const task = await index.updateSettings(publicIndexSettings);
  await search.tasks.waitForTask(task.taskUid);
  indexReady = true;
}

async function syncResource(resourceId: string) {
  await ensureIndex();
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      sources: true,
      authorizations: { include: { evidence: true } },
      cloudLinks: { include: { provider: true } },
    },
  });
  const index = search.index(PUBLIC_RESOURCE_INDEX);
  if (!resource) {
    const task = await index.deleteDocument(resourceId);
    await search.tasks.waitForTask(task.taskUid);
    return;
  }
  const now = new Date();
  const enabledLinks = resource.cloudLinks.filter(
    (link) =>
      link.isEnabled && !link.deletedAt && !['expired', 'disabled'].includes(link.currentStatus),
  );
  const gate = publicationGate({
    reviewStatus: resource.reviewStatus,
    publicationStatus: resource.publicationStatus,
    complaintStatus: resource.complaintStatus,
    rightsStatus: resource.rightsStatus,
    deletedAt: resource.deletedAt,
    activeSourceCount: resource.sources.filter((source) => source.isPublic).length,
    activeAuthorizationCount: resource.authorizations.filter(
      (record) =>
        record.status === 'active' &&
        (!record.startsAt || record.startsAt <= now) &&
        (!record.endsAt || record.endsAt > now) &&
        (Boolean(record.licenseUrl) ||
          record.evidence.some(
            (evidence) => !evidence.deletedAt && evidence.verificationStatus === 'verified',
          )),
    ).length,
    enabledLinkCount: enabledLinks.length,
  });
  if (!gate.ok || !resource.publishedAt) {
    const task = await index.deleteDocument(resourceId);
    await search.tasks.waitForTask(task.taskUid);
    return;
  }
  const document = buildPublicSearchDocument({
    id: resource.id,
    slug: resource.slug,
    title: resource.title,
    summary: resource.summary,
    categories: resource.categories.map(({ category }) => category.name),
    tags: resource.tags.map(({ tag }) => tag.name),
    providerSlugs: enabledLinks.map(({ provider }) => provider.slug),
    rightsStatus: resource.rightsStatus,
    publishedAt: resource.publishedAt,
    updatedAt: resource.updatedAt,
    linkStatuses: enabledLinks.map((link) => link.currentStatus),
    completenessScore: resource.completenessScore,
  });
  const task = await index.addDocuments([document], { primaryKey: 'id' });
  await search.tasks.waitForTask(task.taskUid);
}

async function processOutbox() {
  if (polling) return;
  polling = true;
  try {
    const events = await prisma.outboxEvent.findMany({
      where: { processedAt: null, deadLetteredAt: null },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const event of events) {
      try {
        if (event.eventType === 'resource_index_requested') {
          await syncResource(event.aggregateId);
        } else if (event.eventType === 'resource_index_removed') {
          await ensureIndex();
          const task = await search.index(PUBLIC_RESOURCE_INDEX).deleteDocument(event.aggregateId);
          await search.tasks.waitForTask(task.taskUid);
        } else {
          throw new Error(`Unsupported outbox event: ${event.eventType}`);
        }
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date(), lastErrorRedacted: null },
        });
      } catch (error) {
        const retryCount = event.retryCount + 1;
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            retryCount,
            lastErrorRedacted:
              error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
            deadLetteredAt: retryCount >= 5 ? new Date() : null,
          },
        });
      }
    }
  } finally {
    polling = false;
  }
}

queueWorker.on('completed', (job) =>
  console.info(JSON.stringify({ event: 'job.completed', jobId: job.id })),
);
queueWorker.on('failed', (job, error) =>
  console.error(JSON.stringify({ event: 'job.failed', jobId: job?.id, error: error.message })),
);

const pollTimer = setInterval(() => void processOutbox(), 1_000);
void ensureIndex()
  .then(() => processOutbox())
  .catch((error) =>
    console.error(
      JSON.stringify({
        event: 'worker.bootstrap.failed',
        error: error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
      }),
    ),
  );

async function shutdown(signal: string) {
  clearInterval(pollTimer);
  console.info(JSON.stringify({ event: 'worker.shutdown', signal }));
  await queueWorker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
console.info(JSON.stringify({ event: 'worker.started', queue: 'stage3-infrastructure' }));
