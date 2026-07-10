import 'server-only';
import { getPrisma } from '@platform/db';

export async function getAnalyticsReport(days = 30) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - days * 24 * 60 * 60_000);
  const [
    totalClicks,
    providerClicks,
    channelClicks,
    resourceClicks,
    searchTerms,
    zeroResultTerms,
    linkStatuses,
    verifiedConversions,
    daily,
  ] = await Promise.all([
    prisma.clickEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.clickEvent.groupBy({
      by: ['providerSlug'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.clickEvent.groupBy({
      by: ['channelSlug'],
      where: { createdAt: { gte: since }, channelSlug: { not: null } },
      _count: { _all: true },
    }),
    prisma.clickEvent.groupBy({
      by: ['resourceId'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.searchQuery.groupBy({
      by: ['normalizedQuery'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.searchQuery.groupBy({
      by: ['normalizedQuery'],
      where: { createdAt: { gte: since }, resultCount: 0 },
      _count: { _all: true },
    }),
    prisma.cloudLink.groupBy({
      by: ['currentStatus'],
      where: { isEnabled: true, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.conversionEvent.count({
      where: { occurredAt: { gte: since }, verificationStatus: 'verified' },
    }),
    prisma.dailyAnalytics.findMany({
      where: {
        day: { gte: since },
        metric: { in: ['click_total', 'search_total', 'search_zero_result'] },
      },
      orderBy: { day: 'asc' },
    }),
  ]);
  const resourceIds = resourceClicks.map((item) => item.resourceId);
  const resources = await prisma.resource.findMany({
    where: { id: { in: resourceIds } },
    select: { id: true, title: true },
  });
  const titles = new Map(resources.map((item) => [item.id, item.title]));
  const top = (items: Array<{ normalizedQuery: string; _count: { _all: number } }>) =>
    items
      .filter((item) => item._count._all >= 3)
      .toSorted((left, right) => right._count._all - left._count._all)
      .slice(0, 20)
      .map((item) => ({ term: item.normalizedQuery, count: item._count._all }));
  return {
    days,
    totalClicks,
    verifiedConversions,
    disclosure: '点击不等于转化；转化仅统计已验证的官方回调或官方报表。',
    providerClicks: providerClicks.map((item) => ({
      provider: item.providerSlug,
      count: item._count._all,
    })),
    channelClicks: channelClicks
      .filter((item) => item._count._all >= 3)
      .map((item) => ({ channel: item.channelSlug, count: item._count._all })),
    popularResources: resourceClicks
      .toSorted((left, right) => right._count._all - left._count._all)
      .slice(0, 20)
      .map((item) => ({
        resourceId: item.resourceId,
        title: titles.get(item.resourceId) ?? '已下架资源',
        count: item._count._all,
      })),
    topSearchTerms: top(searchTerms),
    zeroResultTerms: top(zeroResultTerms),
    linkStatuses: linkStatuses.map((item) => ({
      status: item.currentStatus,
      count: item._count._all,
    })),
    daily: daily.map((item) => ({
      day: item.day.toISOString().slice(0, 10),
      metric: item.metric,
      value: item.value.toString(),
    })),
  };
}
