'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfToken } from '@web/src/client/csrf';

export function ResourceActions({
  id,
  version,
  authorizationId,
  canReview,
  canPublish,
}: {
  id: string;
  version: number;
  authorizationId?: string;
  canReview: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState('已核验来源、权利依据和链接');
  const [message, setMessage] = useState<string | null>(null);
  async function command(path: string, body?: unknown) {
    setMessage(null);
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error?.message ?? '操作失败');
    setMessage('操作成功');
    router.refresh();
  }
  async function upload(file: File) {
    if (!authorizationId) return;
    const form = new FormData();
    form.set('file', file);
    const response = await fetch(`/api/v1/admin/authorizations/${authorizationId}/evidence`, {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken() },
      body: form,
    });
    const payload = await response.json();
    setMessage(response.ok ? '证据上传成功' : (payload.error?.message ?? '上传失败'));
    if (response.ok) router.refresh();
  }
  return (
    <div className="stack">
      {canReview ? (
        <>
          <label>
            审核备注
            <textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="actions">
            <button
              type="button"
              onClick={() =>
                command(`/api/v1/admin/resources/${id}/review`, {
                  decision: 'approved',
                  note,
                  expectedVersion: version,
                })
              }
            >
              审核通过
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() =>
                command(`/api/v1/admin/resources/${id}/review`, {
                  decision: 'needs_changes',
                  note,
                  expectedVersion: version,
                })
              }
            >
              要求修改
            </button>
            <button
              className="danger"
              type="button"
              onClick={() =>
                command(`/api/v1/admin/resources/${id}/review`, {
                  decision: 'rejected',
                  note,
                  expectedVersion: version,
                })
              }
            >
              拒绝
            </button>
          </div>
        </>
      ) : null}
      {canPublish ? (
        <button
          type="button"
          onClick={() =>
            command(`/api/v1/admin/resources/${id}/publish`, { expectedVersion: version })
          }
        >
          发布
        </button>
      ) : null}
      {authorizationId ? (
        <label>
          授权证据（PDF/PNG/JPEG/TXT，最大 5 MiB）
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      ) : null}
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
