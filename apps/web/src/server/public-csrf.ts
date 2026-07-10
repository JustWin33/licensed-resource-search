import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { randomToken } from '@platform/core';
import { HttpError } from './http';

export const PUBLIC_CSRF_COOKIE = 'lrs_public_csrf';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newPublicCsrfToken(): string {
  return randomToken(32);
}

export async function requirePublicCsrf(request: Request): Promise<void> {
  const cookie = (await cookies()).get(PUBLIC_CSRF_COOKIE)?.value;
  const header = request.headers.get('x-csrf-token');
  if (!cookie || !header || !safeEqual(cookie, header)) {
    throw new HttpError(403, 'CSRF_INVALID', 'Form protection token is invalid');
  }
}
