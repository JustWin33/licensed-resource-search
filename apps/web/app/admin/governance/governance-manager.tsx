'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfToken } from '@web/src/client/csrf';

type Submission = {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  cloudUrl: string;
  providerHint: string | null;
  rightsType: string;
  rightsStatement: string;
  contact: string;
  status: string;
  createdAt: string;
};
type Report = {
  id: string;
  resourceTitle: string;
  reasonCode: string;
  description: string;
  contact: string | null;
  status: string;
  createdAt: string;
};
type Takedown = {
  id: string;
  resourceTitle: string;
  noticeIdentity: string;
  contact: string;
  workOrSource: string;
  request: string;
  evidenceReference: string | null;
  status: string;
  receivedAt: string;
  counterNotices: Array<{ id: string; contact: string; statement: string; status: string }>;
};
type BlocklistEntry = {
  id: string;
  kind: string;
  value: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
};

export function GovernanceManager({
  submissions,
  reports,
  takedowns,
  blocklist,
}: {
  submissions: Submission[];
  reports: Report[];
  takedowns: Takedown[];
  blocklist: BlocklistEntry[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function update(path: string, body: unknown) {
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setMessage(response.ok ? '处理结果已保存' : (payload.error?.message ?? '处理失败'));
    if (response.ok) router.refresh();
  }
  return (
    <div className="stack">
      <section className="panel stack">
        <h2>资源投稿</h2>
        {submissions.map((item) => (
          <article className="card stack" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <p>
              <a href={item.sourceUrl} rel="noreferrer">
                原始来源
              </a>{' '}
              ·{' '}
              <a href={item.cloudUrl} rel="noreferrer">
                网盘链接
              </a>{' '}
              · {item.rightsType}
            </p>
            <p>
              <strong>授权说明：</strong>
              {item.rightsStatement}
            </p>
            <p>
              <strong>联系方式：</strong>
              {item.contact}
            </p>
            <select
              value={item.status}
              onChange={(event) =>
                void update(`/api/v1/admin/governance/submissions/${item.id}`, {
                  status: event.target.value,
                })
              }
            >
              <option value="pending">待处理</option>
              <option value="needs_info">需补充</option>
              <option value="approved">通过（仍需手动建资源）</option>
              <option value="rejected">拒绝</option>
              <option value="withdrawn">撤回</option>
            </select>
          </article>
        ))}
        {submissions.length === 0 ? <p>暂无投稿。</p> : null}
      </section>
      <section className="panel stack">
        <h2>一般举报</h2>
        {reports.map((item) => (
          <article className="card stack" key={item.id}>
            <h3>{item.resourceTitle}</h3>
            <p>
              {item.reasonCode} · {item.description}
            </p>
            <p>联系方式：{item.contact ?? '未提供'}</p>
            <select
              value={item.status}
              onChange={(event) =>
                void update(`/api/v1/admin/governance/reports/${item.id}`, {
                  status: event.target.value,
                })
              }
            >
              <option value="open">待处理</option>
              <option value="triaged">已分流</option>
              <option value="resolved">已解决</option>
              <option value="dismissed">不成立</option>
            </select>
          </article>
        ))}
        {reports.length === 0 ? <p>暂无举报。</p> : null}
      </section>
      <section className="panel stack">
        <h2>侵权通知与恢复</h2>
        {takedowns.map((item) => (
          <article className="card stack" key={item.id}>
            <h3>{item.resourceTitle}</h3>
            <p>
              <strong>通知人：</strong>
              {item.noticeIdentity} · {item.contact}
            </p>
            <p>
              <strong>权利作品/来源：</strong>
              {item.workOrSource}
            </p>
            <p>
              <strong>请求：</strong>
              {item.request}
            </p>
            {item.evidenceReference ? (
              <p>
                <strong>证据引用：</strong>
                {item.evidenceReference}
              </p>
            ) : null}
            {item.counterNotices.map((counter) => (
              <div className="notice" key={counter.id}>
                <strong>恢复申请：</strong>
                {counter.statement} · {counter.contact}
              </div>
            ))}
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void update(`/api/v1/admin/governance/takedowns/${item.id}`, {
                  status: form.get('status'),
                  reason: form.get('reason'),
                });
              }}
            >
              <label>
                处理结果
                <select name="status" defaultValue={item.status}>
                  <option value="received">已收到</option>
                  <option value="temporarily_hidden">临时隐藏</option>
                  <option value="awaiting_response">等待回应</option>
                  <option value="restored">恢复发布</option>
                  <option value="permanently_removed">永久下架</option>
                  <option value="closed">关闭</option>
                </select>
              </label>
              <label>
                内部处理理由
                <textarea name="reason" required minLength={5} maxLength={5000} />
              </label>
              <button type="submit">确认处理</button>
            </form>
          </article>
        ))}
        {takedowns.length === 0 ? <p>暂无侵权通知。</p> : null}
      </section>
      <section className="panel stack">
        <h2>重复侵权来源黑名单</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void (async () => {
              const response = await fetch('/api/v1/admin/governance/blocklist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
                body: JSON.stringify({
                  kind: form.get('kind'),
                  value: form.get('value'),
                  reason: form.get('reason'),
                }),
              });
              const payload = await response.json();
              setMessage(response.ok ? '黑名单已添加' : (payload.error?.message ?? '添加失败'));
              if (response.ok) router.refresh();
            })();
          }}
        >
          <label>
            类型
            <select name="kind">
              <option value="source_host">来源域名</option>
              <option value="source_url">来源 URL</option>
              <option value="cloud_host">网盘域名</option>
              <option value="cloud_url">网盘 URL</option>
            </select>
          </label>
          <label>
            值
            <input name="value" required />
          </label>
          <label>
            内部理由
            <textarea name="reason" required minLength={5} maxLength={5000} />
          </label>
          <button type="submit">添加黑名单</button>
        </form>
        {blocklist.map((entry) => (
          <div className="card stack" key={entry.id}>
            <p>
              {entry.kind} · {entry.value} · {entry.reason}
            </p>
            <button
              className="secondary"
              type="button"
              disabled={Boolean(entry.expiresAt && new Date(entry.expiresAt) <= new Date())}
              onClick={() => void update(`/api/v1/admin/governance/blocklist/${entry.id}`, {})}
            >
              终止拦截
            </button>
          </div>
        ))}
      </section>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
