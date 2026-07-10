import 'server-only';
import { Prisma } from '@prisma/client';
import { buildConfiguredRedirectUrl, validateRedirectTemplate } from '@platform/cloud-drives';
import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import type { AdminIdentity } from './auth';
import { HttpError } from './http';

const placeholders = z.enum(['target_url', 'resource_id', 'provider']);

export const createRedirectChannelSchema = z.object({
  providerId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/),
  displayName: z.string().trim().min(2).max(120),
  template: z.string().trim().url().max(2_000),
  allowedPlaceholders: z
    .array(placeholders)
    .min(1)
    .max(3)
    .transform((items) => [...new Set(items)]),
});

export const updateRedirectChannelSchema = z.object({ isEnabled: z.boolean() });
export const assignRedirectChannelSchema = z.object({
  redirectChannelId: z.string().uuid().nullable(),
});

function stringList(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export async function listLinkOperations() {
  const prisma = getPrisma();
  const [links, providers, channels] = await Promise.all([
    prisma.cloudLink.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        resource: { select: { title: true } },
        provider: true,
        redirectTemplate: true,
        checkRecords: { orderBy: { checkedAt: 'desc' }, take: 10 },
      },
    }),
    prisma.cloudProvider.findMany({ where: { isEnabled: true }, orderBy: { displayName: 'asc' } }),
    prisma.redirectChannel.findMany({
      orderBy: { createdAt: 'desc' },
      include: { provider: true },
    }),
  ]);
  return {
    providers: providers.map((provider) => ({
      id: provider.id,
      slug: provider.slug,
      displayName: provider.displayName,
    })),
    channels: channels.map((channel) => ({
      id: channel.id,
      slug: channel.slug,
      displayName: channel.displayName,
      providerId: channel.providerId,
      providerName: channel.provider.displayName,
      template: channel.template,
      allowedPlaceholders: stringList(channel.allowedPlaceholders),
      isEnabled: channel.isEnabled,
    })),
    links: links.map((link) => ({
      id: link.id,
      resourceTitle: link.resource.title,
      providerId: link.providerId,
      provider: link.provider.slug,
      providerName: link.provider.displayName,
      normalizedUrl: link.normalizedUrl,
      currentStatus: link.currentStatus,
      lastCheckedAt: link.lastCheckedAt?.toISOString() ?? null,
      nextCheckAt: link.nextCheckAt?.toISOString() ?? null,
      redirectChannelId: link.redirectTemplateId,
      redirectChannelName: link.redirectTemplate?.displayName ?? null,
      history: link.checkRecords.map((record) => ({
        id: record.id,
        status: record.status,
        httpResultClass: record.httpResultClass,
        errorCategory: record.errorCategory,
        durationMs: record.durationMs,
        checkedAt: record.checkedAt.toISOString(),
      })),
    })),
  };
}

export async function queueLinkCheck(linkId: string, actor: AdminIdentity, requestId: string) {
  const prisma = getPrisma();
  const link = await prisma.cloudLink.findFirst({
    where: { id: linkId, deletedAt: null, isEnabled: true },
    select: { id: true },
  });
  if (!link) throw new HttpError(404, 'CLOUD_LINK_NOT_FOUND', 'Cloud link not found');
  return prisma.$transaction(async (tx) => {
    const pending = await tx.outboxEvent.findFirst({
      where: {
        aggregateType: 'cloud_link',
        aggregateId: linkId,
        eventType: 'link_check_requested',
        processedAt: null,
        deadLetteredAt: null,
      },
    });
    const event =
      pending ??
      (await tx.outboxEvent.create({
        data: {
          id: uuidv7(),
          aggregateType: 'cloud_link',
          aggregateId: linkId,
          eventType: 'link_check_requested',
          payloadVersion: 1,
          payloadJson: { cloudLinkId: linkId, reason: 'manual' },
        },
      }));
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'cloud_link.check.requested',
        targetType: 'cloud_link',
        targetId: linkId,
        requestId,
        success: true,
        changedFieldsSummary: { deduplicated: Boolean(pending) },
      },
    });
    return { eventId: event.id, deduplicated: Boolean(pending) };
  });
}

export async function createRedirectChannel(
  input: z.infer<typeof createRedirectChannelSchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  const prisma = getPrisma();
  const provider = await prisma.cloudProvider.findFirst({
    where: { id: input.providerId, isEnabled: true },
  });
  if (!provider) throw new HttpError(404, 'PROVIDER_NOT_FOUND', 'Cloud provider not found');
  const validation = validateRedirectTemplate(input.template, input.allowedPlaceholders);
  if (!validation.ok) {
    throw new HttpError(422, 'REDIRECT_TEMPLATE_INVALID', validation.reason ?? 'Invalid template');
  }
  const allowedHosts = stringList(provider.allowedHostPatterns);
  const canonicalHost = allowedHosts[0];
  if (!canonicalHost) {
    throw new HttpError(422, 'PROVIDER_HOSTS_REQUIRED', 'Provider has no approved redirect hosts');
  }
  try {
    buildConfiguredRedirectUrl(
      input.template,
      input.allowedPlaceholders,
      {
        target_url: `https://${canonicalHost}/s/probe`,
        resource_id: '00000000-0000-4000-8000-000000000000',
        provider: provider.slug,
      },
      allowedHosts,
    );
  } catch (error) {
    throw new HttpError(
      422,
      'REDIRECT_TEMPLATE_TARGET_INVALID',
      error instanceof Error ? error.message : 'Redirect target invalid',
    );
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const channel = await tx.redirectChannel.create({
        data: {
          id: uuidv7(),
          providerId: provider.id,
          slug: input.slug,
          displayName: input.displayName,
          template: input.template,
          allowedPlaceholders: input.allowedPlaceholders,
          createdBy: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          actorType: 'admin_user',
          actorId: actor.id,
          action: 'redirect_channel.create',
          targetType: 'redirect_channel',
          targetId: channel.id,
          requestId,
          success: true,
          changedFieldsSummary: { changed: ['provider', 'slug', 'template', 'placeholders'] },
        },
      });
      return channel;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'CHANNEL_SLUG_CONFLICT', 'Channel slug already exists');
    }
    throw error;
  }
}

export async function setRedirectChannelEnabled(
  channelId: string,
  isEnabled: boolean,
  actor: AdminIdentity,
  requestId: string,
) {
  const prisma = getPrisma();
  const channel = await prisma.redirectChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw new HttpError(404, 'CHANNEL_NOT_FOUND', 'Redirect channel not found');
  return prisma.$transaction(async (tx) => {
    const updated = await tx.redirectChannel.update({
      where: { id: channelId },
      data: { isEnabled },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: isEnabled ? 'redirect_channel.enable' : 'redirect_channel.disable',
        targetType: 'redirect_channel',
        targetId: channelId,
        requestId,
        success: true,
        changedFieldsSummary: { changed: ['is_enabled'] },
      },
    });
    return updated;
  });
}

export async function assignRedirectChannel(
  linkId: string,
  redirectChannelId: string | null,
  actor: AdminIdentity,
  requestId: string,
) {
  const prisma = getPrisma();
  const link = await prisma.cloudLink.findFirst({ where: { id: linkId, deletedAt: null } });
  if (!link) throw new HttpError(404, 'CLOUD_LINK_NOT_FOUND', 'Cloud link not found');
  if (redirectChannelId) {
    const channel = await prisma.redirectChannel.findFirst({
      where: { id: redirectChannelId, providerId: link.providerId, isEnabled: true },
    });
    if (!channel) throw new HttpError(422, 'CHANNEL_PROVIDER_MISMATCH', 'Channel is unavailable');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.cloudLink.update({
      where: { id: linkId },
      data: { redirectTemplateId: redirectChannelId },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'cloud_link.redirect_channel.assign',
        targetType: 'cloud_link',
        targetId: linkId,
        requestId,
        success: true,
        changedFieldsSummary: { changed: ['redirect_template_id'] },
      },
    });
    return updated;
  });
}
