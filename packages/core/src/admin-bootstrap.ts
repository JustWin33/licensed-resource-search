/* eslint-disable no-console -- startup command must report bootstrap status to deployment logs */
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { v7 as uuidv7 } from 'uuid';
import { getPrisma } from '@platform/db';
import { adminPasswordViolations } from './password-policy.js';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

const prisma = getPrisma();

async function main() {
  const username = normalize(process.env.BOOTSTRAP_ADMIN_USERNAME ?? '');
  const email = normalize(process.env.BOOTSTRAP_ADMIN_EMAIL ?? '');
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';

  if (!username || !password) {
    throw new Error('BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD are required');
  }
  if (username.length < 3) throw new Error('Bootstrap administrator username is too short');
  const violations = adminPasswordViolations(password, [username, email]);
  if (violations.length)
    throw new Error(`Bootstrap administrator password rejected: ${violations.join('; ')}`);

  const existingCount = await prisma.adminUser.count();
  if (existingCount > 0) {
    console.log('Administrator bootstrap skipped: an administrator already exists');
    return;
  }

  const adminRole = await prisma.role.findUnique({ where: { slug: 'admin' } });
  if (!adminRole) throw new Error('Administrator role is missing; run the database seed first');

  const user = await prisma.adminUser.create({
    data: {
      id: uuidv7(),
      usernameNormalized: username,
      emailNormalized: email || null,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      passwordHashVersion: 'argon2id-v1',
      roles: { create: { roleId: adminRole.id } },
    },
  });

  const requestId = randomBytes(16).toString('hex');
  await prisma.auditLog.create({
    data: {
      id: uuidv7(),
      actorType: 'system',
      action: 'admin.bootstrap',
      targetType: 'admin_user',
      targetId: user.id,
      requestId: createHash('sha256').update(requestId).digest('hex'),
      success: true,
      changedFieldsSummary: { changed: ['username', 'email', 'role'] },
    },
  });
  console.log('Bootstrap administrator created');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Administrator bootstrap failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
