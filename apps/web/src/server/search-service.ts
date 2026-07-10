import 'server-only';
import { createSearchClient, PUBLIC_RESOURCE_INDEX } from '@platform/search';
import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';
import { getServerEnv } from '../server-env';
import { HttpError } from './http';
import { analyticsEnabled } from './privacy';

export type SearchInput = {
  q: string;
  provider?: 'quark' | 'baidu' | 'generic';
  category?: string;
  rights?: 'owned' | 'authorized' | 'open_licensed' | 'public_domain';
  linkStatus?: 'pending' | 'available' | 'need_password' | 'risk_controlled' | 'unknown';
  sort: 'relevance' | 'newest' | 'popular';
  limit: number;
};

async function recordSearch(input: SearchInput, resultCount: number) {
  if (!(await analyticsEnabled())) return;
  try {
    await getPrisma().searchQuery.create({
      data: {
        id: uuidv7(),
        normalizedQuery: input.q.normalize('NFKC').trim().toLowerCase(),
        filtersJson: {
          provider: input.provider ?? null,
          category: input.category ?? null,
          rights: input.rights ?? null,
          linkStatus: input.linkStatus ?? null,
          sort: input.sort,
        },
        resultCount,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60_000),
      },
    });
  } catch {
    // Search availability must not depend on optional analytics writes.
  }
}

export async function searchPublicResources(input: SearchInput) {
  const env = getServerEnv();
  const client = createSearchClient(env.MEILI_HOST, env.MEILI_MASTER_KEY);
  const filters: string[] = [];
  if (input.provider) filters.push(`providerSlugs = "${input.provider}"`);
  if (input.category) filters.push(`categorySlugs = "${input.category}"`);
  if (input.rights) filters.push(`rightsStatus = "${input.rights}"`);
  if (input.linkStatus) filters.push(`linkStatuses = "${input.linkStatus}"`);
  let result;
  try {
    result = await client.index(PUBLIC_RESOURCE_INDEX).search(input.q, {
      limit: input.limit,
      filter: filters.length ? filters.join(' AND ') : undefined,
      sort: input.sort === 'newest' ? ['publishedAt:desc'] : undefined,
      attributesToRetrieve: ['id'],
    });
  } catch {
    throw new HttpError(503, 'SEARCH_UNAVAILABLE', 'Search service is temporarily unavailable');
  }
  let ids = result.hits.map((hit) => String(hit.id));
  if (ids.length === 0) {
    await recordSearch(input, 0);
    return { hits: [], estimatedTotalHits: result.estimatedTotalHits ?? 0 };
  }
  if (input.sort === 'popular') {
    const clickCounts = await getPrisma().clickEvent.groupBy({
      by: ['resourceId'],
      where: { resourceId: { in: ids }, expiresAt: { gt: new Date() } },
      _count: { _all: true },
    });
    const scores = new Map(clickCounts.map((row) => [row.resourceId, row._count._all]));
    ids = ids.toSorted((left, right) => (scores.get(right) ?? 0) - (scores.get(left) ?? 0));
  }
  const now = new Date();
  const resources = await getPrisma().resource.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      reviewStatus: 'approved',
      publicationStatus: 'published',
      complaintStatus: { in: ['none', 'restored'] },
      rightsStatus: { in: ['owned', 'authorized', 'open_licensed', 'public_domain'] },
      sources: { some: { isPublic: true } },
      ...(input.category
        ? {
            categories: {
              some: { category: { slug: input.category, isEnabled: true } },
            },
          }
        : {}),
      authorizations: {
        some: {
          status: 'active',
          OR: [
            { licenseUrl: { not: null } },
            {
              evidence: {
                some: { verificationStatus: 'verified', deletedAt: null },
              },
            },
          ],
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
      },
      cloudLinks: {
        some: {
          isEnabled: true,
          deletedAt: null,
          currentStatus: { notIn: ['expired', 'disabled'] },
          ...(input.provider ? { provider: { slug: input.provider } } : {}),
          ...(input.linkStatus ? { currentStatus: input.linkStatus } : {}),
        },
      },
    },
    include: {
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      cloudLinks: {
        where: {
          isEnabled: true,
          deletedAt: null,
          currentStatus: { notIn: ['expired', 'disabled'] },
        },
        include: { provider: true },
      },
    },
  });
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const ordered = ids.flatMap((id) => {
    const resource = byId.get(id);
    if (!resource) return [];
    return [
      {
        id: resource.id,
        slug: resource.slug,
        title: resource.title,
        summary: resource.summary,
        rightsStatus: resource.rightsStatus,
        publishedAt: resource.publishedAt?.toISOString() ?? null,
        updatedAt: resource.updatedAt.toISOString(),
        categories: resource.categories.map(({ category }) => category.name),
        tags: resource.tags.map(({ tag }) => tag.name),
        links: resource.cloudLinks.map((link) => ({
          provider: link.provider.slug,
          providerName: link.provider.displayName,
          status: link.currentStatus,
          goUrl: `/go/${resource.id}/${link.provider.slug}`,
        })),
      },
    ];
  });
  await recordSearch(input, ordered.length);
  return { hits: ordered, estimatedTotalHits: result.estimatedTotalHits ?? ordered.length };
}
