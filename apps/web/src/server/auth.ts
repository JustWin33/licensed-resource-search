import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { cookies } from 'next/headers';
import { v7 as uuidv7 } from 'uuid';
import { hmacValue, randomToken } from '@platform/core';
import { getPrisma } from '@platform/db';
import { getServerEnv } from '../server-env';
import { HttpError } from './http';

const SESSION_COOKIE = 'lrs_admin_session';
const CSRF_COOKIE = 'lrs_admin_csrf';
const SESSION_HOURS = 12;

export type AdminIdentity = {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
};

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionHash(token: string): string {
  return hmacValue(token, getServerEnv().SESSION_SECRET);
}

function csrfFor(token: string): string {
  return hmacValue(`csrf:${token}`, getServerEnv().SESSION_SECRET);
}

function identityFromSession(
  session: Awaited<ReturnType<typeof findSession>>,
): AdminIdentity | null {
  if (!session) return null;
  const roles = session.adminUser.roles.map(({ role }) => role.slug);
  const permissions = [
    ...new Set(
      session.adminUser.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.slug),
      ),
    ),
  ];
  return {
    id: session.adminUser.id,
    username: session.adminUser.usernameNormalized,
    roles,
    permissions,
    sessionId: session.id,
  };
}

async function findSession(token: string) {
  return getPrisma().adminSession.findUnique({
    where: { tokenHash: sessionHash(token) },
    include: {
      adminUser: {
        include: {
          roles: {
            include: {
              role: { include: { permissions: { include: { permission: true } } } },
            },
          },
        },
      },
    },
  });
}

export async function currentAdmin(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.adminUser.isDisabled ||
    (session.adminUser.lockedUntil && session.adminUser.lockedUntil > new Date())
  ) {
    return null;
  }
  return identityFromSession(session);
}

export async function requireAdmin(permission?: string): Promise<AdminIdentity> {
  const identity = await currentAdmin();
  if (!identity) throw new HttpError(401, 'AUTH_REQUIRED', 'Administrator authentication required');
  if (permission && !identity.permissions.includes(permission)) {
    throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
  }
  return identity;
}

export async function requireCsrf(request: Request): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  const csrfCookie = cookieStore.get(CSRF_COOKIE)?.value;
  const csrfHeader = request.headers.get('x-csrf-token');
  if (!sessionToken || !csrfCookie || !csrfHeader) {
    throw new HttpError(403, 'CSRF_REQUIRED', 'CSRF token required');
  }
  const expected = csrfFor(sessionToken);
  if (!safeEqual(expected, csrfCookie) || !safeEqual(expected, csrfHeader)) {
    throw new HttpError(403, 'CSRF_INVALID', 'CSRF token invalid');
  }
}

export async function loginAdmin(
  identifier: string,
  password: string,
  id: string,
): Promise<AdminIdentity> {
  const prisma = getPrisma();
  const normalized = identifier.trim().toLowerCase();
  const user = await prisma.adminUser.findFirst({
    where: { OR: [{ usernameNormalized: normalized }, { emailNormalized: normalized }] },
  });
  const now = new Date();
  const valid =
    user &&
    !user.isDisabled &&
    (!user.lockedUntil || user.lockedUntil <= now) &&
    (await argon2.verify(user.passwordHash, password));

  if (!valid || !user) {
    if (user) {
      const failures = user.failedLoginCount + 1;
      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failures,
          lockedUntil: failures >= 5 ? new Date(now.getTime() + 15 * 60_000) : user.lockedUntil,
        },
      });
    }
    await prisma.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'system',
        action: 'auth.login.failed',
        targetType: 'admin_user',
        targetId: user?.id ?? null,
        requestId: id,
        success: false,
        changedFieldsSummary: { result: 'invalid_credentials' },
      },
    });
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  const token = randomToken();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60_000);
  const session = await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    });
    const created = await tx.adminSession.create({
      data: {
        id: uuidv7(),
        adminUserId: user.id,
        tokenHash: sessionHash(token),
        expiresAt,
      },
      include: {
        adminUser: {
          include: {
            roles: {
              include: {
                role: { include: { permissions: { include: { permission: true } } } },
              },
            },
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        actorType: 'admin_user',
        actorId: user.id,
        action: 'auth.login.succeeded',
        targetType: 'admin_session',
        targetId: created.id,
        requestId: id,
        success: true,
        changedFieldsSummary: { changed: ['last_login_at', 'session'] },
      },
    });
    return created;
  });

  const secure = getServerEnv().APP_ENV === 'production';
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
  cookieStore.set(CSRF_COOKIE, csrfFor(token), {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
  return identityFromSession(session)!;
}

export async function logoutAdmin(id: string): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await findSession(token);
    if (session && !session.revokedAt) {
      await getPrisma().$transaction([
        getPrisma().adminSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        }),
        getPrisma().auditLog.create({
          data: {
            id: uuidv7(),
            actorType: 'admin_user',
            actorId: session.adminUserId,
            action: 'auth.logout',
            targetType: 'admin_session',
            targetId: session.id,
            requestId: id,
            success: true,
            changedFieldsSummary: { changed: ['revoked_at'] },
          },
        }),
      ]);
    }
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export function publicIdentity(identity: AdminIdentity) {
  return {
    id: identity.id,
    username: identity.username,
    roles: identity.roles,
    permissions: identity.permissions,
  };
}
