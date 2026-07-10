import { publicationGate } from '@platform/core';
import { getPrisma } from '@platform/db';
import {
  buildPublicSearchDocument,
  buildSynonymMap,
  createSearchClient,
  PUBLIC_RESOURCE_INDEX,
  publicIndexSettings,
} from '@platform/search';
import { getServerEnv } from '@platform/config/server';

const env = getServerEnv();
const prisma = getPrisma();
const search = createSearchClient(env.MEILI_HOST, env.MEILI_MASTER_KEY);

async function wait(task: { taskUid: number }) {
  await search.tasks.waitForTask(task.taskUid);
}

async function main() {
  const rebuildIndex = `${PUBLIC_RESOURCE_INDEX}-rebuild-${Date.now()}`;
  const active = search.index(PUBLIC_RESOURCE_INDEX);
  const next = search.index(rebuildIndex);

  await wait(await active.updateSettings(publicIndexSettings));
  await wait(await next.updateSettings(publicIndexSettings));

  const synonymRows = await prisma.synonym.findMany({ where: { isEnabled: true } });
  await wait(await next.updateSynonyms(buildSynonymMap(synonymRows.map((row) => row.termsJson))));

  const resources = await prisma.resource.findMany({
    where: {
      deletedAt: null,
      reviewStatus: 'approved',
      publicationStatus: 'published',
      complaintStatus: { in: ['none', 'restored'] },
    },
    include: {
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      sources: true,
      authorizations: { include: { evidence: true } },
      cloudLinks: { include: { provider: true } },
    },
  });
  const now = new Date();
  const documents = resources.flatMap((resource) => {
    const links = resource.cloudLinks.filter(
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
      enabledLinkCount: links.length,
    });
    if (!gate.ok || !resource.publishedAt) return [];
    return [
      buildPublicSearchDocument({
        id: resource.id,
        slug: resource.slug,
        title: resource.title,
        summary: resource.summary,
        categories: resource.categories.map(({ category }) => category.name),
        categorySlugs: resource.categories
          .filter(({ category }) => category.isEnabled)
          .map(({ category }) => category.slug),
        tags: resource.tags.map(({ tag }) => tag.name),
        providerSlugs: links.map(({ provider }) => provider.slug),
        rightsStatus: resource.rightsStatus,
        publishedAt: resource.publishedAt,
        updatedAt: resource.updatedAt,
        linkStatuses: links.map((link) => link.currentStatus),
        completenessScore: resource.completenessScore,
      }),
    ];
  });

  for (let offset = 0; offset < documents.length; offset += 500) {
    await wait(
      await next.addDocuments(documents.slice(offset, offset + 500), { primaryKey: 'id' }),
    );
  }
  await wait(
    await search.swapIndexes([{ indexes: [PUBLIC_RESOURCE_INDEX, rebuildIndex], rename: true }]),
  );
  await wait(await search.deleteIndex(rebuildIndex));
  console.info(
    JSON.stringify({
      event: 'search.rebuild.completed',
      index: PUBLIC_RESOURCE_INDEX,
      documents: documents.length,
    }),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: 'search.rebuild.failed',
        error: error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
