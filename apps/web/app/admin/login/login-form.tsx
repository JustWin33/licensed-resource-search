'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) return setError(payload.error?.message ?? '登录失败');
    router.replace('/admin');
    router.refresh();
  }
  return (
    <form className="panel form-grid" onSubmit={submit}>
      <label>
        用户名或邮箱
        <input name="identifier" autoComplete="username" minLength={3} required />
      </label>
      <label>
        密码
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={12}
          required
        />
      </label>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button disabled={busy} type="submit">
        {busy ? '登录中…' : '登录'}
      </button>
    </form>
  );
}
