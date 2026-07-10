import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { checkCloudLink, type LinkStatus } from '@platform/cloud-drives';
import { publicationGate } from '@platform/core';
import { getPrisma } from '@platform/db';
import {
  buildSynonymMap,
  buildPublicSearchDocument,
  createSearchClient,
  PUBLIC_RESOURCE_INDEX,
  publicIndexSettings,
} from '@platform/search';
import { getServerEnv } from '@platform/config/server';
import { v7 as uuidv7 } from 'uuid';
import { nextCheckAt, resolveObservedLinkStatus } from './link-check-policy.js';
import { aggregateAnalytics, enqueueDailyMaintenance, runRetentionCleanup } from './maintenance.js';

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
  const synonyms = await prisma.synonym.findMany({ where: { isEnabled: true } });
  const synonymTask = await index.updateSynonyms(
    buildSynonymMap(synonyms.map((row) => row.termsJson)),
  );
  await search.tasks.waitForTask(synonymTask.taskUid);
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
    categorySlugs: resource.categories
      .filter(({ category }) => category.isEnabled)
      .map(({ category }) => category.slug),
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

function configuredHosts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

const httpResultClass = {
  none: 'none',
  '2xx': 'two_xx',
  '3xx': 'three_xx',
  '4xx': 'four_xx',
  '5xx': 'five_xx',
  network_error: 'network_error',
  blocked: 'blocked',
} as const;

async function checkLink(cloudLinkId: string) {
  const link = await prisma.cloudLink.findUnique({
    where: { id: cloudLinkId },
    include: {
      provider: true,
      checkRecords: { orderBy: { checkedAt: 'desc' }, take: 1 },
    },
  });
  if (!link || link.deletedAt || !link.isEnabled || !link.provider.isEnabled) return;
  const result = await checkCloudLink(
    {
      normalizedUrl: new URL(link.normalizedUrl),
      provider: link.provider.slug,
      adapterVersion: link.provider.adapterVersion,
      hasPasscode: Boolean(link.passcodeCiphertext),
    },
    configuredHosts(link.provider.allowedHostPatterns),
  );
  const previousStatus = link.checkRecords[0]?.status as LinkStatus | undefined;
  const state = resolveObservedLinkStatus({
    currentStatus: link.currentStatus,
    observedStatus: result.status,
    previousObservedStatus: previousStatus,
    statusConfirmations: link.statusConfirmations,
  });
  const next = nextCheckAt(result.status);
  await prisma.$transaction(async (tx) => {
    await tx.linkCheckRecord.create({
      data: {
        id: uuidv7(),
        cloudLinkId: link.id,
        adapterVersion: result.adapterVersion,
        status: result.status,
        httpResultClass: httpResultClass[result.httpResultClass],
        errorCategory: result.errorCategory,
        durationMs: result.durationMs,
        checkedAt: new Date(result.checkedAt),
        nextCheckAt: next,
      },
    });
    await tx.cloudLink.update({
      where: { id: link.id },
      data: {
        currentStatus: state.currentStatus,
        statusConfirmations: state.statusConfirmations,
        lastCheckedAt: new Date(result.checkedAt),
        nextCheckAt: next,
      },
    });
    if (state.currentStatus !== link.currentStatus) {
      await tx.outboxEvent.create({
        data: {
          id: uuidv7(),
          aggregateType: 'resource',
          aggregateId: link.resourceId,
          eventType: 'resource_index_requested',
          payloadVersion: 1,
          payloadJson: { resourceId: link.resourceId, reason: 'link_status_changed' },
        },
      });
    }
  });
}

async function enqueueDueLinkChecks() {
  const links = await prisma.cloudLink.findMany({
    where: {
      isEnabled: true,
      deletedAt: null,
      provider: { isEnabled: true },
      OR: [{ nextCheckAt: { lte: new Date() } }, { lastCheckedAt: null }],
    },
    orderBy: [{ nextCheckAt: 'asc' }, { createdAt: 'asc' }],
    take: 20,
    select: { id: true },
  });
  for (const link of links) {
    const pending = await prisma.outboxEvent.findFirst({
      where: {
        aggregateType: 'cloud_link',
        aggregateId: link.id,
        eventType: 'link_check_requested',
        processedAt: null,
        deadLetteredAt: null,
      },
      select: { id: true },
    });
    if (!pending) {
      await prisma.outboxEvent.create({
        data: {
          id: uuidv7(),
          aggregateType: 'cloud_link',
          aggregateId: link.id,
          eventType: 'link_check_requested',
          payloadVersion: 1,
          payloadJson: { cloudLinkId: link.id, reason: 'scheduled' },
        },
      });
    }
  }
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
        } else if (event.eventType === 'link_check_requested') {
          await checkLink(event.aggregateId);
        } else if (event.eventType === 'analytics_aggregate_requested') {
          const payload = event.payloadJson;
          const day =
            payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.day : null;
          if (typeof day !== 'string') throw new Error('Analytics day missing');
          await aggregateAnalytics(new Date(day));
        } else if (event.eventType === 'retention_cleanup_requested') {
          await runRetentionCleanup();
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
const linkScheduleTimer = setInterval(() => void enqueueDueLinkChecks(), 60_000);
const maintenanceTimer = setInterval(() => void enqueueDailyMaintenance(), 60 * 60_000);
void ensureIndex()
  .then(async () => {
    await enqueueDueLinkChecks();
    await enqueueDailyMaintenance();
    await processOutbox();
  })
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
  clearInterval(linkScheduleTimer);
  clearInterval(maintenanceTimer);
  console.info(JSON.stringify({ event: 'worker.shutdown', signal }));
  await queueWorker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
console.info(JSON.stringify({ event: 'worker.started', queue: 'stage3-infrastructure' }));
