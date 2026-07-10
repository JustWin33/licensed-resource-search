'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfToken } from '@web/src/client/csrf';

type Batch = {
  id: string;
  idempotencyKey: string;
  format: string;
  status: string;
  rowCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  rows: Array<{
    id: string;
    rowNumber: number;
    status: string;
    errorCode: string | null;
    errorDetail: string | null;
    resourceId: string | null;
  }>;
};

export function ImportManager({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function request(path: string, body: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setMessage(response.ok ? '操作完成' : (payload.error?.message ?? '操作失败'));
    if (response.ok) router.refresh();
  }
  return (
    <div className="stack">
      <section className="panel stack">
        <h2>创建预览批次</h2>
        <p className="muted">
          最多 200 行、1
          MiB。预览只校验并保存待确认行；点击确认后才逐行创建草稿资源，失败行不会删除既有数据。
        </p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void request('/api/v1/admin/imports', {
              format: form.get('format'),
              idempotencyKey: form.get('idempotencyKey'),
              content: form.get('content'),
            });
          }}
        >
          <label>
            格式
            <select name="format">
              <option value="csv">CSV</option>
              <option value="markdown">Markdown Frontmatter</option>
            </select>
          </label>
          <label>
            幂等键
            <input
              name="idempotencyKey"
              required
              minLength={8}
              placeholder="release-2026-07-10-01"
            />
          </label>
          <label>
            导入内容
            <textarea
              name="content"
              required
              rows={14}
              placeholder="title,summary,rights_status,source_url,verification_basis,provider,cloud_url"
            />
          </label>
          <button type="submit">解析并预览</button>
        </form>
      </section>
      <section className="panel stack">
        <h2>导入批次</h2>
        {batches.map((batch) => (
          <article className="card stack" key={batch.id}>
            <div className="actions">
              <strong>{batch.idempotencyKey}</strong>
              <span className="chip">{batch.format}</span>
              <span className="chip">{batch.status}</span>
            </div>
            <p>
              总行数 {batch.rowCount} · 成功 {batch.successCount} · 失败 {batch.failureCount}
            </p>
            <details>
              <summary>逐行结果</summary>
              <ul>
                {batch.rows.map((row) => (
                  <li key={row.id}>
                    第 {row.rowNumber} 行 · {row.status}
                    {row.errorCode ? ` · ${row.errorCode}: ${row.errorDetail}` : ''}
                  </li>
                ))}
              </ul>
            </details>
            {batch.status === 'preview' ? (
              <button
                type="button"
                onClick={() => void request(`/api/v1/admin/imports/${batch.id}/confirm`, {})}
              >
                确认写入
              </button>
            ) : null}
          </article>
        ))}
        {batches.length === 0 ? <p>暂无导入批次。</p> : null}
      </section>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
