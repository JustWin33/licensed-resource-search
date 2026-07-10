import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';

function utcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function aggregateAnalytics(dayInput: Date) {
  const prisma = getPrisma();
  const day = utcDay(dayInput);
  const end = new Date(day.getTime() + 24 * 60 * 60_000);
  const clickWhere = { createdAt: { gte: day, lt: end } };
  const searchWhere = { createdAt: { gte: day, lt: end } };
  const [totalClicks, providerClicks, channelClicks, resourceClicks, searches, noResults, links] =
    await Promise.all([
      prisma.clickEvent.count({ where: clickWhere }),
      prisma.clickEvent.groupBy({
        by: ['providerSlug'],
        where: clickWhere,
        _count: { _all: true },
      }),
      prisma.clickEvent.groupBy({
        by: ['channelSlug'],
        where: { ...clickWhere, channelSlug: { not: null } },
        _count: { _all: true },
      }),
      prisma.clickEvent.groupBy({ by: ['resourceId'], where: clickWhere, _count: { _all: true } }),
      prisma.searchQuery.count({ where: searchWhere }),
      prisma.searchQuery.count({ where: { ...searchWhere, resultCount: 0 } }),
      prisma.cloudLink.groupBy({
        by: ['currentStatus'],
        where: { deletedAt: null, isEnabled: true },
        _count: { _all: true },
      }),
    ]);
  const rows = [
    { id: uuidv7(), day, metric: 'click_total', value: BigInt(totalClicks) },
    { id: uuidv7(), day, metric: 'click_deduplicated', value: BigInt(totalClicks) },
    { id: uuidv7(), day, metric: 'search_total', value: BigInt(searches) },
    { id: uuidv7(), day, metric: 'search_zero_result', value: BigInt(noResults) },
    ...providerClicks.map((item) => ({
      id: uuidv7(),
      day,
      metric: 'provider_click',
      providerSlug: item.providerSlug,
      value: BigInt(item._count._all),
    })),
    ...channelClicks.map((item) => ({
      id: uuidv7(),
      day,
      metric: 'channel_click',
      channelSlug: item.channelSlug,
      value: BigInt(item._count._all),
    })),
    ...resourceClicks.map((item) => ({
      id: uuidv7(),
      day,
      metric: 'resource_click',
      resourceId: item.resourceId,
      value: BigInt(item._count._all),
    })),
    ...links.map((item) => ({
      id: uuidv7(),
      day,
      metric: `link_status:${item.currentStatus}`,
      value: BigInt(item._count._all),
    })),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.dailyAnalytics.deleteMany({ where: { day } });
    await tx.dailyAnalytics.createMany({ data: rows });
  });
  return rows.length;
}

export async function runRetentionCleanup(now = new Date()) {
  const prisma = getPrisma();
  const [searchQueries, clickEvents, submissions] = await prisma.$transaction([
    prisma.searchQuery.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.clickEvent.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.submission.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);
  return {
    searchQueries: searchQueries.count,
    clickEvents: clickEvents.count,
    submissions: submissions.count,
  };
}

export async function enqueueDailyMaintenance(now = new Date()) {
  const prisma = getPrisma();
  const today = utcDay(now).toISOString().slice(0, 10);
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'maintenance.last_enqueued_day' },
  });
  const value = setting?.valueJson;
  if (value && typeof value === 'object' && !Array.isArray(value) && value.day === today)
    return false;
  const previousDay = new Date(utcDay(now).getTime() - 24 * 60 * 60_000);
  await prisma.$transaction(async (tx) => {
    await tx.outboxEvent.createMany({
      data: [
        {
          id: uuidv7(),
          aggregateType: 'maintenance',
          aggregateId: uuidv7(),
          eventType: 'analytics_aggregate_requested',
          payloadVersion: 1,
          payloadJson: { day: previousDay.toISOString() },
        },
        {
          id: uuidv7(),
          aggregateType: 'maintenance',
          aggregateId: uuidv7(),
          eventType: 'retention_cleanup_requested',
          payloadVersion: 1,
          payloadJson: { requestedAt: now.toISOString() },
        },
      ],
    });
    await tx.systemSetting.upsert({
      where: { key: 'maintenance.last_enqueued_day' },
      update: { valueJson: { day: today } },
      create: { key: 'maintenance.last_enqueued_day', valueJson: { day: today } },
    });
  });
  return true;
}
