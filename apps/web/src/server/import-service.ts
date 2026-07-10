import 'server-only';
import { Prisma } from '@prisma/client';
import { decryptSensitive, encryptSensitive, hmacValue } from '@platform/core';
import { getPrisma } from '@platform/db';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { getServerEnv } from '../server-env';
import type { AdminIdentity } from './auth';
import { HttpError } from './http';
import { parseImport } from './import-parser';
import { createResource, createResourceSchema, type CreateResourceInput } from './resource-service';

export const previewImportSchema = z.object({
  format: z.enum(['csv', 'markdown']),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(255)
    .regex(/^[A-Za-z0-9._:-]+$/),
  content: z.string().min(1).max(1_048_576),
});

function securePayload(payload: CreateResourceInput): Prisma.InputJsonValue {
  const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const link = clone.link as Record<string, unknown>;
  if (typeof link.passcode === 'string') {
    link.passcodeCiphertext = encryptSensitive(link.passcode, getServerEnv().ENCRYPTION_KEY);
    delete link.passcode;
  }
  return clone as Prisma.InputJsonValue;
}

function restorePayload(value: Prisma.JsonValue): CreateResourceInput {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('import_payload_invalid');
  }
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const link = clone.link as Record<string, unknown>;
  if (typeof link.passcodeCiphertext === 'string') {
    link.passcode = decryptSensitive(link.passcodeCiphertext, getServerEnv().ENCRYPTION_KEY);
    delete link.passcodeCiphertext;
  }
  return createResourceSchema.parse(clone);
}

function batchDto(batch: Awaited<ReturnType<typeof findBatch>>) {
  if (!batch) throw new HttpError(404, 'IMPORT_NOT_FOUND', 'Import batch not found');
  return {
    id: batch.id,
    idempotencyKey: batch.idempotencyKey,
    format: batch.format,
    status: batch.status,
    rowCount: batch.rowCount,
    successCount: batch.successCount,
    failureCount: batch.failureCount,
    createdAt: batch.createdAt.toISOString(),
    confirmedAt: batch.confirmedAt?.toISOString() ?? null,
    rows: batch.rows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      status: row.status,
      errorCode: row.errorCode,
      errorDetail: row.errorDetailRedacted,
      resourceId: row.resourceId,
    })),
  };
}

function findBatch(id: string) {
  return getPrisma().importBatch.findUnique({
    where: { id },
    include: { rows: { orderBy: { rowNumber: 'asc' } } },
  });
}

export async function previewImport(
  input: z.infer<typeof previewImportSchema>,
  actor: AdminIdentity,
  requestId: string,
) {
  const prisma = getPrisma();
  const existing = await prisma.importBatch.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return batchDto(await findBatch(existing.id));
  let parsed;
  try {
    parsed = parseImport(input.format, input.content);
  } catch (error) {
    throw new HttpError(
      422,
      'IMPORT_PARSE_FAILED',
      error instanceof Error ? error.message : 'Import parsing failed',
    );
  }
  const batchId = uuidv7();
  const failed = parsed.filter((row) => !row.payload).length;
  await prisma.$transaction(async (tx) => {
    await tx.importBatch.create({
      data: {
        id: batchId,
        idempotencyKey: input.idempotencyKey,
        format: input.format,
        requestedBy: actor.id,
        rowCount: parsed.length,
        failureCount: failed,
      },
    });
    for (const row of parsed) {
      const payload = row.payload ? securePayload(row.payload) : undefined;
      const hashInput = row.payload
        ? JSON.stringify({
            ...row.payload,
            link: { ...row.payload.link, passcode: Boolean(row.payload.link.passcode) },
          })
        : `invalid:${row.rowNumber}:${row.errorDetail}`;
      await tx.importRow.create({
        data: {
          id: uuidv7(),
          batchId,
          rowNumber: row.rowNumber,
          sourceHash: hmacValue(hashInput, getServerEnv().URL_HASH_SECRET),
          payloadJson: payload,
          status: row.payload ? 'pending' : 'failed',
          errorCode: row.errorCode,
          errorDetailRedacted: row.errorDetail,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'import.preview.create',
        targetType: 'import_batch',
        targetId: batchId,
        requestId,
        success: true,
        changedFieldsSummary: { format: input.format, rows: parsed.length, invalidRows: failed },
      },
    });
  });
  return batchDto(await findBatch(batchId));
}

export async function confirmImport(batchId: string, actor: AdminIdentity, requestId: string) {
  const prisma = getPrisma();
  const batch = await findBatch(batchId);
  if (!batch) throw new HttpError(404, 'IMPORT_NOT_FOUND', 'Import batch not found');
  if (!['preview', 'processing'].includes(batch.status)) {
    throw new HttpError(409, 'IMPORT_ALREADY_CONFIRMED', 'Import batch was already confirmed');
  }
  if (batch.status === 'preview') {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status: 'processing', confirmedBy: actor.id, confirmedAt: new Date() },
    });
  }
  for (const row of batch.rows.filter((item) => item.status === 'pending')) {
    try {
      if (!row.payloadJson) throw new Error('import_payload_missing');
      const resource = await createResource(
        restorePayload(row.payloadJson),
        actor,
        `${requestId}:${row.rowNumber}`,
      );
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: 'succeeded', resourceId: resource.resource.id },
      });
    } catch (error) {
      const code = error instanceof HttpError ? error.code : 'row_write_failed';
      await prisma.importRow.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          errorCode: code,
          errorDetailRedacted:
            error instanceof Error ? error.message.slice(0, 300) : 'unknown_error',
        },
      });
    }
  }
  const counts = await prisma.importRow.groupBy({
    by: ['status'],
    where: { batchId },
    _count: { _all: true },
  });
  const count = new Map(counts.map((item) => [item.status, item._count._all]));
  const successCount = count.get('succeeded') ?? 0;
  const failureCount = count.get('failed') ?? 0;
  const status =
    failureCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial_failure';
  await prisma.$transaction(async (tx) => {
    await tx.importBatch.update({
      where: { id: batchId },
      data: { status, successCount, failureCount },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: actor.id,
        action: 'import.confirm',
        targetType: 'import_batch',
        targetId: batchId,
        requestId,
        success: status !== 'failed',
        changedFieldsSummary: { status, successCount, failureCount },
      },
    });
  });
  return batchDto(await findBatch(batchId));
}

export async function listImports() {
  const batches = await getPrisma().importBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { rows: { orderBy: { rowNumber: 'asc' } } },
  });
  return batches.map((batch) => batchDto(batch));
}
