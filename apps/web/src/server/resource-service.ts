import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { normalizeCloudDriveUrl, validatePublicHttpsUrl } from '@platform/cloud-drives';
import { encryptSensitive, hmacValue, reviewGate, slugifyTitle } from '@platform/core';
import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { getServerEnv } from '../server-env';
import type { AdminIdentity } from './auth';
import { HttpError } from './http';

const rights = z.enum(['owned', 'authorized', 'open_licensed', 'public_domain']);

export const createResourceSchema = z.object({
  title: z.string().trim().min(2).max(300),
  summary: z.string().trim().min(10).max(10_000),
  ownerType: z.enum(['deployer', 'authorized_submitter', 'third_party_rightsholder']),
  rightsStatus: rights,
  source: z.object({
    url: z.string().url().max(2_000),
    name: z.string().trim().min(2).max(200),
    type: z.enum([
      'official_site',
      'author_page',
      'license_registry',
      'public_archive',
      'user_submitted',
      'other',
    ]),
  }),
  authorization: z.object({
    licenseName: z.string().trim().max(200).optional(),
    licenseVersion: z.string().trim().max(80).optional(),
    licenseUrl: z.string().url().max(2_000).optional(),
    verificationBasis: z.string().trim().min(10).max(5_000),
    allowsCommercialPromotion: z.boolean().default(false),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
  }),
  link: z.object({
    provider: z.enum(['quark', 'baidu', 'generic']),
    url: z.string().url().max(2_000),
    passcode: z.string().trim().min(1).max(32).optional(),
    isPrimary: z.boolean().default(true),
  }),
});

export const reviewResourceSchema = z.object({
  decision: z.enum(['approved', 'needs_changes', 'rejected']),
  note: z.string().trim().min(3).max(5_000),
  expectedVersion: z.number().int().positive(),
});

export const publishResourceSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;

function allowedHosts(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeSourceUrl(raw: string): URL {
  const url = new URL(raw);
  const validation = validatePublicHttpsUrl(url);
  if (!validation.ok)
    throw new HttpError(422, 'SOURCE_URL_INVALID', validation.reason ?? 'Source URL invalid');
  url.hash = '';
  return url;
}

function isActiveAuthorization(
  record: { status: string; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
) {
  return (
    record.status === 'active' &&
    (!record.startsAt || record.startsAt <= now) &&
    (!record.endsAt || record.endsAt > now)
  );
}

function hasAuthorizationProof(record: {
  verificationBasis: string;
  licenseUrl: string | null;
  evidence: Array<{
    deletedAt: Date | null;
    verificationStatus: string;
  }>;
}) {
  const hasEvidence = record.evidence.some(
    (evidence) =>
      !evidence.deletedAt && ['pending', 'verified'].includes(evidence.verificationStatus),
  );
  return (
    record.verificationBasis.trim().length >= 10 && (Boolean(record.licenseUrl) || hasEvidence)
  );
}

function isEnabledLink(link: {
  isEnabled: boolean;
  deletedAt: Date | null;
  currentStatus: string;
}) {
  return link.isEnabled && !link.deletedAt && !['expired', 'disabled'].includes(link.currentStatus);
}

export async function createResource(input: CreateResourceInput, actor: AdminIdentity, id: string) {
  const prisma = getPrisma();
  const env = getServerEnv();
  const provider = await prisma.cloudProvider.findUnique({ where: { slug: input.link.provider } });
  if (!provider?.isEnabled)
    throw new HttpError(422, 'PROVIDER_DISABLED', 'Cloud provider is disabled');
  const providerHosts = allowedHosts(provider.allowedHostPatterns);
  if (input.link.provider === 'generic' && providerHosts.length === 0) {
    throw new HttpError(422, 'GENERIC_ALLOWLIST_EMPTY', 'Generic provider allowlist is empty');
  }
  let normalizedLink: URL;
  try {
    normalizedLink = normalizeCloudDriveUrl(
      new URL(input.link.url),
      input.link.provider,
      providerHosts,
    );
  } catch (error) {
    throw new HttpError(
      422,
      'CLOUD_URL_INVALID',
      error instanceof Error ? error.message : 'Cloud URL invalid',
    );
  }
  const source = normalizeSourceUrl(input.source.url);
  const licenseUrl = input.authorization.licenseUrl
    ? normalizeSourceUrl(input.authorization.licenseUrl).toString()
    : null;
  const resourceId = uuidv7();
  const authorizationId = uuidv7();
  const cloudLinkId = uuidv7();
  try {
    return await prisma.$transaction(async (tx) => {
      const resource = await tx.resource.create({
        data: {
          id: resourceId,
          slug: slugifyTitle(input.title, resourceId.slice(0, 8)),
          title: input.title,
          summary: input.summary,
          ownerType: input.ownerType,
          rightsStatus: input.rightsStatus,
          reviewStatus: 'pending_review',
          publicationStatus: 'draft',
          createdBy: actor.id,
        },
      });
      await tx.resourceSource.create({
        data: {
          id: uuidv7(),
          resourceId,
          sourceUrl: source.toString(),
          sourceUrlHash: hmacValue(source.toString(), env.URL_HASH_SECRET),
          sourceName: input.source.name,
          sourceType: input.source.type,
          captureMethod: 'manual',
          isPublic: true,
        },
      });
      await tx.authorizationRecord.create({
        data: {
          id: authorizationId,
          resourceId,
          rightsType: input.rightsStatus,
          licenseName: input.authorization.licenseName,
          licenseVersion: input.authorization.licenseVersion,
          licenseUrl,
          verificationBasis: input.authorization.verificationBasis,
          allowsCommercialPromotion: input.authorization.allowsCommercialPromotion,
          startsAt: input.authorization.startsAt ? new Date(input.authorization.startsAt) : null,
          endsAt: input.authorization.endsAt ? new Date(input.authorization.endsAt) : null,
          status: 'pending',
        },
      });
      await tx.cloudLink.create({
        data: {
          id: cloudLinkId,
          resourceId,
          providerId: provider.id,
          normalizedUrl: normalizedLink.toString(),
          urlHash: hmacValue(normalizedLink.toString(), env.URL_HASH_SECRET),
          passcodeCiphertext: input.link.passcode
            ? encryptSensitive(input.link.passcode, env.ENCRYPTION_KEY)
            : null,
          currentStatus: input.link.passcode ? 'need_password' : 'pending',
          isPrimary: input.link.isPrimary,
          isEnabled: true,
        },
      });
      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          actorType: 'admin_user',
          actorId: actor.id,
          action: 'resource.create',
          targetType: 'resource',
          targetId: resourceId,
          requestId: id,
          success: true,
          changedFieldsSummary: {
            changed: ['title', 'summary', 'rights_status', 'source', 'authorization', 'cloud_link'],
          },
        },
      });
      return { resource, authorizationId, cloudLinkId };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(
        409,
        'RESOURCE_CONFLICT',
        'Resource slug or normalized URL already exists',
      );
    }
    throw error;
  }
}

export async function listAdminResources() {
  const resources = await getPrisma().resource.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      creator: { select: { usernameNormalized: true } },
      sources: true,
      authorizations: { include: { evidence: true } },
      cloudLinks: { include: { provider: true } },
    },
  });
  return resources.map((resource) => ({
    id: resource.id,
    slug: resource.slug,
    title: resource.title,
    summary: resource.summary,
    ownerType: resource.ownerType,
    rightsStatus: resource.rightsStatus,
    reviewStatus: resource.reviewStatus,
    publicationStatus: resource.publicationStatus,
    complaintStatus: resource.complaintStatus,
    version: resource.version,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
    creator: resource.creator?.usernameNormalized ?? null,
    sources: resource.sources.map((source) => ({
      id: source.id,
      name: source.sourceName,
      url: source.sourceUrl,
      type: source.sourceType,
    })),
    authorizations: resource.authorizations.map((authorization) => ({
      id: authorization.id,
      status: authorization.status,
      licenseName: authorization.licenseName,
      licenseVersion: authorization.licenseVersion,
      licenseUrl: authorization.licenseUrl,
      evidence: authorization.evidence.map((evidence) => ({
        id: evidence.id,
        sha256: evidence.sha256,
        mimeType: evidence.mimeType,
        byteSize: evidence.byteSize.toString(),
        verificationStatus: evidence.verificationStatus,
      })),
    })),
    links: resource.cloudLinks.map((link) => ({
      id: link.id,
      provider: link.provider.slug,
      providerName: link.provider.displayName,
      normalizedUrl: link.normalizedUrl,
      status: link.currentStatus,
      isPrimary: link.isPrimary,
      hasPasscode: Boolean(link.passcodeCiphertext),
    })),
  }));
}

export async function reviewResource(
  resourceId: string,
  input: z.infer<typeof reviewResourceSchema>,
  actor: AdminIdentity,
  id: string,
) {
  const prisma = getPrisma();
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      sources: true,
      authorizations: { include: { evidence: true } },
      cloudLinks: true,
    },
  });
  if (!resource || resource.deletedAt)
    throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
  if (resource.version !== input.expectedVersion) {
    throw new HttpError(409, 'VERSION_CONFLICT', 'Resource has been modified');
  }
  if (resource.createdBy === actor.id && !actor.roles.includes('admin')) {
    throw new HttpError(403, 'SELF_REVIEW_FORBIDDEN', 'You cannot review your own resource');
  }
  const qualifiedAuthorizationIds = resource.authorizations
    .filter(hasAuthorizationProof)
    .map((record) => record.id);
  if (input.decision === 'approved') {
    const gate = reviewGate({
      complaintStatus: resource.complaintStatus,
      rightsStatus: resource.rightsStatus,
      deletedAt: resource.deletedAt,
      activeSourceCount: resource.sources.filter((source) => source.isPublic).length,
      activeAuthorizationCount: qualifiedAuthorizationIds.length,
      enabledLinkCount: resource.cloudLinks.filter(isEnabledLink).length,
    });
    if (!gate.ok) throw new HttpError(409, 'REVIEW_GATE_FAILED', gate.reasons.join(','));
  }
  return prisma.$transaction(async (tx) => {
    if (input.decision === 'approved') {
      await tx.authorizationRecord.updateMany({
        where: { resourceId, id: { in: qualifiedAuthorizationIds }, status: 'pending' },
        data: { status: 'active', verifiedBy: actor.id, verifiedAt: new Date() },
      });
      await tx.authorizationEvidence.updateMany({
        where: {
          authorizationRecord: { resourceId },
          verificationStatus: 'pending',
          deletedAt: null,
        },
        data: { verificationStatus: 'verified' },
      });
    }
    const updated = await tx.resource.update({
      where: { id: resourceId, version: input.expectedVersion },
      data: {
        reviewStatus: input.decision,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewNoteInternal: input.note,
        version: { increment: 1 },
      },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: `resource.review.${input.decision}`,
        targetType: 'resource',
        targetId: resourceId,
        requestId: id,
        success: true,
        changedFieldsSummary: { changed: ['review_status', 'reviewed_by', 'reviewed_at'] },
      },
    });
    return updated;
  });
}

export async function publishResource(
  resourceId: string,
  expectedVersion: number,
  actor: AdminIdentity,
  id: string,
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const resource = await tx.resource.findUnique({
      where: { id: resourceId },
      include: {
        sources: true,
        authorizations: { include: { evidence: true } },
        cloudLinks: true,
      },
    });
    if (!resource || resource.deletedAt)
      throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
    if (resource.version !== expectedVersion) {
      throw new HttpError(409, 'VERSION_CONFLICT', 'Resource has been modified');
    }
    const now = new Date();
    const gate = reviewGate({
      complaintStatus: resource.complaintStatus,
      rightsStatus: resource.rightsStatus,
      deletedAt: resource.deletedAt,
      activeSourceCount: resource.sources.filter((source) => source.isPublic).length,
      activeAuthorizationCount: resource.authorizations.filter(
        (record) => isActiveAuthorization(record, now) && hasAuthorizationProof(record),
      ).length,
      enabledLinkCount: resource.cloudLinks.filter(isEnabledLink).length,
    });
    if (resource.reviewStatus !== 'approved' || !gate.ok) {
      throw new HttpError(
        409,
        'PUBLICATION_GATE_FAILED',
        gate.ok ? 'review_not_approved' : gate.reasons.join(','),
      );
    }
    const write = await tx.resource.updateMany({
      where: { id: resourceId, version: expectedVersion },
      data: {
        publicationStatus: 'published',
        publishedAt: resource.publishedAt ?? now,
        version: { increment: 1 },
      },
    });
    if (write.count !== 1) {
      throw new HttpError(409, 'VERSION_CONFLICT', 'Resource has been modified');
    }
    const updated = await tx.resource.findUniqueOrThrow({ where: { id: resourceId } });
    await tx.outboxEvent.create({
      data: {
        id: uuidv7(),
        aggregateType: 'resource',
        aggregateId: resourceId,
        eventType: 'resource_index_requested',
        payloadVersion: 1,
        payloadJson: { resourceId },
      },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'resource.publish',
        targetType: 'resource',
        targetId: resourceId,
        requestId: id,
        success: true,
        changedFieldsSummary: { changed: ['publication_status', 'published_at'] },
      },
    });
    return updated;
  });
}

export async function getPublicResourceBySlug(slug: string) {
  const now = new Date();
  const resource = await getPrisma().resource.findFirst({
    where: {
      slug,
      deletedAt: null,
      reviewStatus: 'approved',
      publicationStatus: 'published',
      complaintStatus: { in: ['none', 'restored'] },
      rightsStatus: { in: ['owned', 'authorized', 'open_licensed', 'public_domain'] },
      sources: { some: { isPublic: true } },
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
        },
      },
    },
    include: {
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      sources: { where: { isPublic: true } },
      authorizations: {
        where: {
          status: 'active',
          OR: [
            { licenseUrl: { not: null } },
            { evidence: { some: { verificationStatus: 'verified', deletedAt: null } } },
          ],
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
      },
      filesSummary: true,
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
  if (!resource) return null;
  return resource;
}

export async function getPublicResourceById(id: string) {
  const now = new Date();
  return getPrisma().resource.findFirst({
    where: {
      id,
      deletedAt: null,
      reviewStatus: 'approved',
      publicationStatus: 'published',
      complaintStatus: { in: ['none', 'restored'] },
      rightsStatus: { in: ['owned', 'authorized', 'open_licensed', 'public_domain'] },
      sources: { some: { isPublic: true } },
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
        },
      },
    },
    include: {
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
}

export function publicResourceDto(
  resource: NonNullable<Awaited<ReturnType<typeof getPublicResourceBySlug>>>,
) {
  return {
    id: resource.id,
    slug: resource.slug,
    title: resource.title,
    summary: resource.summary,
    rightsStatus: resource.rightsStatus,
    publishedAt: resource.publishedAt?.toISOString() ?? null,
    updatedAt: resource.updatedAt.toISOString(),
    categories: resource.categories.map(({ category }) => ({
      slug: category.slug,
      name: category.name,
    })),
    tags: resource.tags.map(({ tag }) => ({ slug: tag.slug, name: tag.name })),
    sources: resource.sources.map((source) => ({
      name: source.sourceName,
      url: source.sourceUrl,
      type: source.sourceType,
    })),
    license: resource.authorizations.map((record) => ({
      name: record.licenseName,
      version: record.licenseVersion,
      url: record.licenseUrl,
      allowsCommercialPromotion: record.allowsCommercialPromotion,
      endsAt: record.endsAt?.toISOString() ?? null,
    })),
    filesSummary: resource.filesSummary
      ? {
          directorySummary: resource.filesSummary.directorySummary,
          fileCount: resource.filesSummary.fileCount?.toString() ?? null,
          totalBytes: resource.filesSummary.totalBytes?.toString() ?? null,
          observedAt: resource.filesSummary.observedAt?.toISOString() ?? null,
        }
      : null,
    links: resource.cloudLinks.map((link) => ({
      provider: link.provider.slug,
      providerName: link.provider.displayName,
      status: link.currentStatus,
      lastCheckedAt: link.lastCheckedAt?.toISOString() ?? null,
      hasPasscode: Boolean(link.passcodeCiphertext),
    })),
  };
}

export function evidenceChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
