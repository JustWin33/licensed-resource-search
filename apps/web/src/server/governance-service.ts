import 'server-only';
import { normalizeCloudDriveUrl, validatePublicHttpsUrl } from '@platform/cloud-drives';
import { decryptSensitive, encryptSensitive, hmacValue, randomToken } from '@platform/core';
import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { getServerEnv } from '../server-env';
import type { AdminIdentity } from './auth';
import { HttpError } from './http';

const botFields = z.object({
  website: z.string().max(0),
  formStartedAt: z.string().datetime(),
});
const truthful = z.literal(true);

export const submissionSchema = botFields.extend({
  title: z.string().trim().min(2).max(300),
  summary: z.string().trim().min(20).max(10_000),
  sourceUrl: z.string().url().max(2_000),
  cloudUrl: z.string().url().max(2_000),
  providerHint: z.enum(['quark', 'baidu']),
  passcode: z.string().trim().min(1).max(32).optional(),
  rightsType: z.enum(['owned', 'authorized', 'open_licensed', 'public_domain']),
  rightsStatement: z.string().trim().min(20).max(5_000),
  contact: z.string().trim().min(3).max(320),
  truthfulnessAccepted: truthful,
});

export const reportSchema = botFields.extend({
  resourceId: z.string().uuid(),
  reasonCode: z.enum(['broken_link', 'misleading', 'prohibited_content', 'privacy', 'other']),
  description: z.string().trim().min(10).max(5_000),
  contact: z.string().trim().max(320).optional(),
});

export const takedownSchema = botFields.extend({
  resourceId: z.string().uuid(),
  noticeIdentity: z.string().trim().min(2).max(500),
  contact: z.string().trim().min(3).max(320),
  workOrSource: z.string().trim().min(10).max(5_000),
  request: z.string().trim().min(10).max(5_000),
  evidenceReference: z.string().trim().max(200).optional(),
  truthfulnessAccepted: truthful,
});

export const counterNoticeSchema = botFields.extend({
  ticketToken: z.string().min(20).max(200),
  contact: z.string().trim().min(3).max(320),
  statement: z.string().trim().min(20).max(5_000),
  evidenceReference: z.string().trim().max(200).optional(),
});

export const updateSubmissionStatusSchema = z.object({
  status: z.enum(['pending', 'needs_info', 'approved', 'rejected', 'withdrawn']),
});
export const updateReportStatusSchema = z.object({
  status: z.enum(['open', 'triaged', 'resolved', 'dismissed']),
});
export const updateTakedownStatusSchema = z.object({
  status: z.enum([
    'received',
    'temporarily_hidden',
    'awaiting_response',
    'restored',
    'permanently_removed',
    'closed',
  ]),
  reason: z.string().trim().min(5).max(5_000),
});
export const createBlocklistSchema = z.object({
  kind: z.enum(['source_host', 'source_url', 'cloud_host', 'cloud_url']),
  value: z.string().trim().min(2).max(2_000),
  reason: z.string().trim().min(5).max(5_000),
  expiresAt: z.string().datetime().optional(),
});

function assertHumanStartedAt(value: string) {
  const startedAt = new Date(value).getTime();
  const age = Date.now() - startedAt;
  if (age < 1_500 || age > 2 * 60 * 60_000) {
    throw new HttpError(422, 'FORM_TIMING_INVALID', 'Please reload the form and try again');
  }
}

function ticketHash(token: string): string {
  return hmacValue(`case:${token}`, getServerEnv().URL_HASH_SECRET);
}

function encrypt(value: string): string {
  return encryptSensitive(value, getServerEnv().ENCRYPTION_KEY);
}

async function assertResourceExists(resourceId: string) {
  const resource = await getPrisma().resource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: { id: true },
  });
  if (!resource) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
}

async function assertNotBlocked(values: Array<{ kind: string; value: string }>) {
  const now = new Date();
  const blocked = await getPrisma().sourceBlocklist.findFirst({
    where: {
      OR: values.map(({ kind, value }) => ({ kind, normalizedValue: value.toLowerCase() })),
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    select: { id: true },
  });
  if (blocked) throw new HttpError(422, 'SUBMISSION_BLOCKED', 'This source cannot be submitted');
}

export async function createSubmission(input: z.infer<typeof submissionSchema>) {
  assertHumanStartedAt(input.formStartedAt);
  const source = new URL(input.sourceUrl);
  const sourceValidation = validatePublicHttpsUrl(source);
  if (!sourceValidation.ok) {
    throw new HttpError(422, 'SOURCE_URL_INVALID', sourceValidation.reason ?? 'Invalid source URL');
  }
  source.hash = '';
  const cloud = normalizeCloudDriveUrl(new URL(input.cloudUrl), input.providerHint);
  await assertNotBlocked([
    { kind: 'source_host', value: source.hostname },
    { kind: 'source_url', value: source.toString() },
    { kind: 'cloud_host', value: cloud.hostname },
    { kind: 'cloud_url', value: cloud.toString() },
  ]);
  const token = randomToken(32);
  const row = await getPrisma().submission.create({
    data: {
      id: uuidv7(),
      ticketTokenHash: ticketHash(token),
      title: input.title,
      summary: input.summary,
      sourceUrl: source.toString(),
      cloudUrl: cloud.toString(),
      providerHint: input.providerHint,
      passcodeCiphertext: input.passcode ? encrypt(input.passcode) : null,
      rightsType: input.rightsType,
      rightsStatementPrivate: encrypt(input.rightsStatement),
      contactPrivate: encrypt(input.contact),
      truthfulnessAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
    },
  });
  return { id: row.id, ticketToken: token, status: row.status };
}

export async function createReport(input: z.infer<typeof reportSchema>) {
  assertHumanStartedAt(input.formStartedAt);
  await assertResourceExists(input.resourceId);
  const token = randomToken(32);
  const row = await getPrisma().report.create({
    data: {
      id: uuidv7(),
      ticketTokenHash: ticketHash(token),
      resourceId: input.resourceId,
      reasonCode: input.reasonCode,
      descriptionPrivate: encrypt(input.description),
      contactPrivate: input.contact ? encrypt(input.contact) : null,
    },
  });
  return { id: row.id, ticketToken: token, status: row.status };
}

export async function createTakedown(input: z.infer<typeof takedownSchema>) {
  assertHumanStartedAt(input.formStartedAt);
  await assertResourceExists(input.resourceId);
  const token = randomToken(32);
  const row = await getPrisma().takedownRequest.create({
    data: {
      id: uuidv7(),
      ticketTokenHash: ticketHash(token),
      resourceId: input.resourceId,
      noticeIdentityPrivate: encrypt(input.noticeIdentity),
      contactPrivate: encrypt(input.contact),
      workOrSourcePrivate: encrypt(input.workOrSource),
      requestPrivate: encrypt(input.request),
      evidenceRefPrivate: input.evidenceReference ? encrypt(input.evidenceReference) : null,
      truthfulnessAcceptedAt: new Date(),
    },
  });
  return { id: row.id, ticketToken: token, status: row.status };
}

export async function createCounterNotice(input: z.infer<typeof counterNoticeSchema>) {
  assertHumanStartedAt(input.formStartedAt);
  const takedown = await getPrisma().takedownRequest.findUnique({
    where: { ticketTokenHash: ticketHash(input.ticketToken) },
  });
  if (!takedown) throw new HttpError(404, 'CASE_NOT_FOUND', 'Case not found');
  const row = await getPrisma().$transaction(async (tx) => {
    const created = await tx.counterNotice.create({
      data: {
        id: uuidv7(),
        takedownRequestId: takedown.id,
        submitterContactPrivate: encrypt(input.contact),
        statementPrivate: encrypt(input.statement),
        evidenceRefPrivate: input.evidenceReference ? encrypt(input.evidenceReference) : null,
      },
    });
    await tx.takedownRequest.update({
      where: { id: takedown.id },
      data: { status: 'awaiting_response' },
    });
    return created;
  });
  return { id: row.id, status: row.status };
}

export async function getCaseStatus(token: string) {
  const hash = ticketHash(token);
  const prisma = getPrisma();
  const [submission, report, takedown] = await Promise.all([
    prisma.submission.findUnique({ where: { ticketTokenHash: hash } }),
    prisma.report.findUnique({ where: { ticketTokenHash: hash } }),
    prisma.takedownRequest.findUnique({ where: { ticketTokenHash: hash } }),
  ]);
  if (submission) {
    return { kind: 'submission', status: submission.status, updatedAt: submission.updatedAt };
  }
  if (report) return { kind: 'report', status: report.status, updatedAt: report.updatedAt };
  if (takedown) return { kind: 'takedown', status: takedown.status, updatedAt: takedown.updatedAt };
  throw new HttpError(404, 'CASE_NOT_FOUND', 'Case not found');
}

export async function listGovernanceCases() {
  const prisma = getPrisma();
  const [submissions, reports, takedowns, blocklist] = await Promise.all([
    prisma.submission.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { resource: { select: { title: true } } },
    }),
    prisma.takedownRequest.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 100,
      include: {
        resource: { select: { title: true } },
        counterNotices: { orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.sourceBlocklist.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const secret = getServerEnv().ENCRYPTION_KEY;
  return {
    submissions: submissions.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      sourceUrl: item.sourceUrl,
      cloudUrl: item.cloudUrl,
      providerHint: item.providerHint,
      rightsType: item.rightsType,
      rightsStatement: decryptSensitive(item.rightsStatementPrivate, secret),
      contact: decryptSensitive(item.contactPrivate, secret),
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    })),
    reports: reports.map((item) => ({
      id: item.id,
      resourceTitle: item.resource.title,
      reasonCode: item.reasonCode,
      description: decryptSensitive(item.descriptionPrivate, secret),
      contact: item.contactPrivate ? decryptSensitive(item.contactPrivate, secret) : null,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    })),
    takedowns: takedowns.map((item) => ({
      id: item.id,
      resourceTitle: item.resource.title,
      noticeIdentity: decryptSensitive(item.noticeIdentityPrivate, secret),
      contact: decryptSensitive(item.contactPrivate, secret),
      workOrSource: decryptSensitive(item.workOrSourcePrivate, secret),
      request: decryptSensitive(item.requestPrivate, secret),
      evidenceReference: item.evidenceRefPrivate
        ? decryptSensitive(item.evidenceRefPrivate, secret)
        : null,
      status: item.status,
      receivedAt: item.receivedAt.toISOString(),
      counterNotices: item.counterNotices.map((counter) => ({
        id: counter.id,
        contact: decryptSensitive(counter.submitterContactPrivate, secret),
        statement: decryptSensitive(counter.statementPrivate, secret),
        status: counter.status,
      })),
    })),
    blocklist: blocklist.map((item) => ({
      id: item.id,
      kind: item.kind,
      value: item.normalizedValue,
      reason: decryptSensitive(item.reasonPrivate, secret),
      expiresAt: item.expiresAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function createBlocklistEntry(
  input: z.infer<typeof createBlocklistSchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  let normalizedValue = input.value.toLowerCase();
  if (input.kind.endsWith('_url')) {
    const url = new URL(input.value);
    const validation = validatePublicHttpsUrl(url);
    if (!validation.ok)
      throw new HttpError(422, 'BLOCKLIST_URL_INVALID', 'Blocklist URL is invalid');
    url.hash = '';
    normalizedValue = url.toString().toLowerCase();
  } else if (!/^[a-z0-9.-]+$/i.test(input.value) || input.value.includes('..')) {
    throw new HttpError(422, 'BLOCKLIST_HOST_INVALID', 'Blocklist host is invalid');
  }
  const prisma = getPrisma();
  const existing = await prisma.sourceBlocklist.findUnique({
    where: { kind_normalizedValue: { kind: input.kind, normalizedValue } },
  });
  if (existing) throw new HttpError(409, 'BLOCKLIST_CONFLICT', 'Blocklist entry already exists');
  return prisma.$transaction(async (tx) => {
    const entry = await tx.sourceBlocklist.create({
      data: {
        id: uuidv7(),
        kind: input.kind,
        normalizedValue,
        reasonPrivate: encrypt(input.reason),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdBy: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'blocklist.create',
        targetType: 'source_blocklist',
        targetId: entry.id,
        requestId,
        success: true,
        changedFieldsSummary: { kind: input.kind },
      },
    });
    return entry;
  });
}

export async function expireBlocklistEntry(id: string, actor: AdminIdentity, requestId: string) {
  const prisma = getPrisma();
  const entry = await prisma.sourceBlocklist.findUnique({ where: { id } });
  if (!entry) throw new HttpError(404, 'BLOCKLIST_NOT_FOUND', 'Blocklist entry not found');
  return prisma.$transaction(async (tx) => {
    const updated = await tx.sourceBlocklist.update({
      where: { id },
      data: { expiresAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'blocklist.expire',
        targetType: 'source_blocklist',
        targetId: id,
        requestId,
        success: true,
        changedFieldsSummary: { changed: ['expires_at'] },
      },
    });
    return updated;
  });
}

export async function updateSubmissionStatus(
  id: string,
  status: z.infer<typeof updateSubmissionStatusSchema>['status'],
  actor: AdminIdentity,
  requestId: string,
) {
  const row = await getPrisma().submission.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  return getPrisma().$transaction(async (tx) => {
    const updated = await tx.submission.update({
      where: { id },
      data: { status, reviewerId: actor.id },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: `submission.status.${status}`,
        targetType: 'submission',
        targetId: id,
        requestId,
        success: true,
        changedFieldsSummary: { from: row.status, to: status },
      },
    });
    return updated;
  });
}

export async function updateReportStatus(
  id: string,
  status: z.infer<typeof updateReportStatusSchema>['status'],
  actor: AdminIdentity,
  requestId: string,
) {
  const row = await getPrisma().report.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, 'REPORT_NOT_FOUND', 'Report not found');
  return getPrisma().$transaction(async (tx) => {
    const updated = await tx.report.update({
      where: { id },
      data: { status, handledBy: actor.id },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: `report.status.${status}`,
        targetType: 'report',
        targetId: id,
        requestId,
        success: true,
        changedFieldsSummary: { from: row.status, to: status },
      },
    });
    return updated;
  });
}

export async function updateTakedownStatus(
  id: string,
  input: z.infer<typeof updateTakedownStatusSchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.takedownRequest.findUnique({
    where: { id },
    include: { resource: true },
  });
  if (!row) throw new HttpError(404, 'TAKEDOWN_NOT_FOUND', 'Takedown request not found');
  if (
    input.status === 'restored' &&
    (!row.resource.publishedAt || row.resource.reviewStatus !== 'approved')
  ) {
    throw new HttpError(409, 'RESOURCE_NOT_RESTORABLE', 'Resource is not eligible for restoration');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.takedownRequest.update({
      where: { id },
      data: { status: input.status, handledBy: actor.id },
    });
    const hide = input.status === 'temporarily_hidden';
    const restore = input.status === 'restored';
    const remove = input.status === 'permanently_removed';
    if (hide || restore || remove) {
      await tx.resource.update({
        where: { id: row.resourceId },
        data: hide
          ? { publicationStatus: 'temporarily_hidden', complaintStatus: 'temporarily_hidden' }
          : restore
            ? { publicationStatus: 'published', complaintStatus: 'restored' }
            : { publicationStatus: 'archived', complaintStatus: 'permanently_removed' },
      });
      await tx.moderationAction.create({
        data: {
          id: uuidv7(),
          resourceId: row.resourceId,
          caseId: row.id,
          action: `takedown.${input.status}`,
          fromStatus: row.resource.complaintStatus,
          toStatus: input.status,
          reasonPrivate: encrypt(input.reason),
          actorId: actor.id,
          requestId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: uuidv7(),
          aggregateType: 'resource',
          aggregateId: row.resourceId,
          eventType: restore ? 'resource_index_requested' : 'resource_index_removed',
          payloadVersion: 1,
          payloadJson: { resourceId: row.resourceId, caseId: row.id },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: `takedown.status.${input.status}`,
        targetType: 'takedown_request',
        targetId: id,
        requestId,
        success: true,
        changedFieldsSummary: { from: row.status, to: input.status },
      },
    });
    return updated;
  });
}
