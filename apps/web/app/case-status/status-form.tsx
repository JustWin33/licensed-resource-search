'use client';

import { useState } from 'react';

export function StatusForm() {
  const [result, setResult] = useState<{ kind: string; status: string; updatedAt: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="panel form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        const token = String(new FormData(event.currentTarget).get('token') ?? '');
        const csrfResponse = await fetch('/api/v1/public/csrf', { cache: 'no-store' });
        const csrf = await csrfResponse.json();
        const response = await fetch('/api/v1/cases/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.data.token },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        });
        const payload = await response.json();
        if (response.ok) {
          setResult(payload.data);
          setError(null);
        } else {
          setResult(null);
          setError(payload.error?.message ?? '查询失败');
        }
      }}
    >
      <label>
        工单查询令牌
        <input name="token" required minLength={20} maxLength={200} />
      </label>
      <button type="submit">查询</button>
      {result ? (
        <p>
          类型：{result.kind} · 状态：{result.status} · 更新时间：
          {new Date(result.updatedAt).toLocaleString()}
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
