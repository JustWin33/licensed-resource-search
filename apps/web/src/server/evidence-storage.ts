import 'server-only';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { getPrisma } from '@platform/db';
import { getServerEnv } from '../server-env';
import type { AdminIdentity } from './auth';
import { HttpError } from './http';
import { evidenceChecksum } from './resource-service';

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const allowedTypes: Readonly<Record<string, { extension: string; signature?: readonly number[] }>> =
  {
    'application/pdf': { extension: '.pdf', signature: [0x25, 0x50, 0x44, 0x46] },
    'image/png': { extension: '.png', signature: [0x89, 0x50, 0x4e, 0x47] },
    'image/jpeg': { extension: '.jpg', signature: [0xff, 0xd8, 0xff] },
    'text/plain': { extension: '.txt' },
  };

function assertSignature(buffer: Buffer, signature?: readonly number[]) {
  if (signature && !signature.every((byte, index) => buffer[index] === byte)) {
    throw new HttpError(
      422,
      'EVIDENCE_SIGNATURE_INVALID',
      'Evidence file signature does not match MIME type',
    );
  }
}

export async function storeAuthorizationEvidence(
  authorizationId: string,
  file: File,
  actor: AdminIdentity,
  requestId: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(authorizationId)) {
    throw new HttpError(400, 'AUTHORIZATION_ID_INVALID', 'Authorization identifier is invalid');
  }
  const env = getServerEnv();
  if (env.EVIDENCE_STORAGE_DRIVER !== 'local_private') {
    throw new HttpError(
      503,
      'EVIDENCE_STORAGE_UNAVAILABLE',
      'S3 evidence adapter is not configured in this build',
    );
  }
  const type = allowedTypes[file.type];
  if (!type) throw new HttpError(422, 'EVIDENCE_TYPE_INVALID', 'Unsupported evidence file type');
  if (file.size < 1 || file.size > MAX_EVIDENCE_BYTES) {
    throw new HttpError(
      422,
      'EVIDENCE_SIZE_INVALID',
      'Evidence file must be between 1 byte and 5 MiB',
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  assertSignature(buffer, type.signature);
  const prisma = getPrisma();
  const authorization = await prisma.authorizationRecord.findUnique({
    where: { id: authorizationId },
  });
  if (!authorization)
    throw new HttpError(404, 'AUTHORIZATION_NOT_FOUND', 'Authorization record not found');

  const root = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    'private-data',
    env.LOCAL_EVIDENCE_ROOT,
  );
  const objectRef = path.join(authorizationId, `${uuidv7()}${type.extension}`);
  const objectPath = path.join(/*turbopackIgnore: true*/ root, objectRef);
  if (!objectPath.startsWith(`${root}${path.sep}`))
    throw new HttpError(500, 'EVIDENCE_PATH_INVALID', 'Evidence path invalid');
  await mkdir(path.join(/*turbopackIgnore: true*/ root, authorizationId), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(objectPath, buffer, { mode: 0o600, flag: 'wx' });

  try {
    return await prisma.$transaction(async (tx) => {
      const evidence = await tx.authorizationEvidence.create({
        data: {
          id: uuidv7(),
          authorizationRecordId: authorizationId,
          objectRefPrivate: objectRef,
          sha256: evidenceChecksum(buffer),
          mimeType: file.type,
          byteSize: BigInt(buffer.byteLength),
          originalFilenameRedacted: `evidence${path.extname(file.name).toLowerCase().slice(0, 10)}`,
          uploadedBy: actor.id,
          verificationStatus: 'pending',
        },
      });
      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          actorType: 'admin_user',
          actorId: actor.id,
          action: 'authorization.evidence.upload',
          targetType: 'authorization_evidence',
          targetId: evidence.id,
          requestId,
          success: true,
          changedFieldsSummary: { changed: ['object_ref', 'sha256', 'mime_type', 'byte_size'] },
        },
      });
      return {
        id: evidence.id,
        sha256: evidence.sha256,
        mimeType: evidence.mimeType,
        byteSize: evidence.byteSize.toString(),
      };
    });
  } catch (error) {
    await unlink(objectPath).catch(() => undefined);
    throw error;
  }
}
