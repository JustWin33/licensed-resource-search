'use client';

import { useState } from 'react';

export function AnalyticsChoice() {
  const [message, setMessage] = useState<string | null>(null);
  async function choose(enabled: boolean) {
    const csrfResponse = await fetch('/api/v1/public/csrf', { cache: 'no-store' });
    const csrf = await csrfResponse.json();
    const response = await fetch('/api/v1/privacy/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.data.token },
      body: JSON.stringify({ enabled }),
    });
    setMessage(
      response.ok ? (enabled ? '已允许必要之外的匿名分析' : '已拒绝非必要分析') : '保存失败',
    );
  }
  return (
    <div className="actions">
      <button type="button" onClick={() => void choose(false)}>
        拒绝非必要分析
      </button>
      <button className="secondary" type="button" onClick={() => void choose(true)}>
        允许匿名分析
      </button>
      {message ? <span aria-live="polite">{message}</span> : null}
    </div>
  );
}
