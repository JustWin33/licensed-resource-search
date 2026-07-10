'use client';

import { useState } from 'react';

export function PasscodeReveal({ slug, provider }: { slug: string; provider: string }) {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function reveal() {
    setError(null);
    const response = await fetch(`/api/v1/resources/${encodeURIComponent(slug)}/passcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error?.message ?? '无法读取提取码');
    setPasscode(payload.data.passcode);
  }
  if (passcode)
    return (
      <button
        className="secondary"
        type="button"
        onClick={() => void navigator.clipboard.writeText(passcode)}
      >
        提取码：{passcode}（点击复制）
      </button>
    );
  return (
    <>
      <button className="secondary" type="button" onClick={reveal}>
        查看提取码
      </button>
      {error ? <span className="error">{error}</span> : null}
    </>
  );
}
