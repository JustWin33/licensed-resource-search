'use client';

import { useRouter } from 'next/navigation';
import { csrfToken } from '@web/src/client/csrf';

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/v1/admin/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken() },
    });
    router.replace('/admin/login');
    router.refresh();
  }
  return (
    <button type="button" className="secondary" onClick={logout}>
      退出
    </button>
  );
}
