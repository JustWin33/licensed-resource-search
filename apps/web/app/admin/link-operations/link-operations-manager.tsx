'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfToken } from '@web/src/client/csrf';

type Provider = { id: string; slug: string; displayName: string };
type Channel = {
  id: string;
  slug: string;
  displayName: string;
  providerId: string;
  providerName: string;
  template: string;
  allowedPlaceholders: string[];
  isEnabled: boolean;
};
type LinkRow = {
  id: string;
  resourceTitle: string;
  providerId: string;
  provider: string;
  providerName: string;
  normalizedUrl: string;
  currentStatus: string;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  redirectChannelId: string | null;
  redirectChannelName: string | null;
  history: Array<{
    id: string;
    status: string;
    httpResultClass: string;
    errorCategory: string | null;
    durationMs: number | null;
    checkedAt: string;
  }>;
};

export function LinkOperationsManager({
  providers,
  channels,
  links,
}: {
  providers: Provider[];
  channels: Channel[];
  links: LinkRow[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function command(path: string, body: unknown, method = 'POST') {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setMessage(response.ok ? '操作已提交' : (payload.error?.message ?? '操作失败'));
    if (response.ok) router.refresh();
  }
  return (
    <div className="stack">
      <section className="panel stack">
        <h2>新增推广渠道模板</h2>
        <p className="muted">
          模板目标域名必须属于所选网盘的审核白名单；不接受访客传入的任意参数。
        </p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const allowedPlaceholders = ['target_url', 'resource_id', 'provider'].filter(
              (name) => form.get(name) === 'on',
            );
            void command('/api/v1/admin/redirect-channels', {
              providerId: form.get('providerId'),
              slug: form.get('slug'),
              displayName: form.get('displayName'),
              template: form.get('template'),
              allowedPlaceholders,
            });
            event.currentTarget.reset();
          }}
        >
          <label>
            网盘
            <select name="providerId" required>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            渠道标识
            <input name="slug" required placeholder="official-campaign" />
          </label>
          <label>
            展示名称
            <input name="displayName" required placeholder="官方活动渠道" />
          </label>
          <label>
            HTTPS 模板
            <input
              name="template"
              required
              placeholder="https://pan.example/share?target={target_url}"
            />
          </label>
          <fieldset>
            <legend>允许占位符</legend>
            <label>
              <input type="checkbox" name="target_url" defaultChecked /> target_url
            </label>
            <label>
              <input type="checkbox" name="resource_id" /> resource_id
            </label>
            <label>
              <input type="checkbox" name="provider" /> provider
            </label>
          </fieldset>
          <button type="submit">创建渠道</button>
        </form>
        {channels.map((channel) => (
          <div className="card stack" key={channel.id}>
            <div className="actions">
              <strong>{channel.displayName}</strong>
              <span className="chip">{channel.providerName}</span>
              <span className="chip">{channel.isEnabled ? '启用' : '停用'}</span>
            </div>
            <code>{channel.template}</code>
            <button
              className="secondary"
              type="button"
              onClick={() =>
                void command(
                  `/api/v1/admin/redirect-channels/${channel.id}`,
                  { isEnabled: !channel.isEnabled },
                  'PATCH',
                )
              }
            >
              {channel.isEnabled ? '停用渠道' : '启用渠道'}
            </button>
          </div>
        ))}
      </section>
      <section className="panel stack">
        <h2>链接健康与检查历史</h2>
        {links.map((link) => (
          <article className="card stack" key={link.id}>
            <div>
              <strong>{link.resourceTitle}</strong>
              <p className="muted">
                {link.providerName} · {link.currentStatus} · 最近检查：
                {link.lastCheckedAt ? new Date(link.lastCheckedAt).toLocaleString() : '尚未检查'}
              </p>
              <code>{link.normalizedUrl}</code>
            </div>
            <div className="actions">
              <button
                type="button"
                onClick={() => void command(`/api/v1/admin/links/${link.id}/check`, {})}
              >
                立即检查
              </button>
              <select
                aria-label="默认推广渠道"
                value={link.redirectChannelId ?? ''}
                onChange={(event) =>
                  void command(
                    `/api/v1/admin/links/${link.id}`,
                    { redirectChannelId: event.target.value || null },
                    'PATCH',
                  )
                }
              >
                <option value="">不使用推广渠道</option>
                {channels
                  .filter((channel) => channel.providerId === link.providerId && channel.isEnabled)
                  .map((channel) => (
                    <option value={channel.id} key={channel.id}>
                      {channel.displayName}
                    </option>
                  ))}
              </select>
            </div>
            <details>
              <summary>最近 {link.history.length} 次检查</summary>
              <ul>
                {link.history.map((record) => (
                  <li key={record.id}>
                    {new Date(record.checkedAt).toLocaleString()} · {record.status} ·{' '}
                    {record.httpResultClass} · {record.durationMs ?? 0}ms
                    {record.errorCategory ? ` · ${record.errorCategory}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
        {links.length === 0 ? <p className="notice">还没有可检查的链接。</p> : null}
      </section>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
