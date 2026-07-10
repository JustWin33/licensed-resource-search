'use client';

import { useState } from 'react';

type Mode = 'submission' | 'report' | 'takedown' | 'counter-notice';

const endpoint: Record<Mode, string> = {
  submission: '/api/v1/submissions',
  report: '/api/v1/reports',
  takedown: '/api/v1/takedowns',
  'counter-notice': '/api/v1/counter-notices',
};

export function CaseForm({ mode, resourceId = '' }: { mode: Mode; resourceId?: string }) {
  const [startedAt] = useState(() => new Date().toISOString());
  const [result, setResult] = useState<{ ticketToken?: string; status?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError(null);
    const form = new FormData(formElement);
    const body = Object.fromEntries(form.entries()) as Record<string, unknown>;
    for (const key of ['passcode', 'contact', 'evidenceReference']) {
      if (body[key] === '') delete body[key];
    }
    body.website = '';
    body.formStartedAt = startedAt;
    if (mode === 'submission' || mode === 'takedown') body.truthfulnessAccepted = true;
    const csrfResponse = await fetch('/api/v1/public/csrf', { cache: 'no-store' });
    const csrf = await csrfResponse.json();
    const response = await fetch(endpoint[mode], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.data.token },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (response.ok) {
      setResult(payload.data);
      formElement.reset();
    } else {
      setError(payload.error?.message ?? '提交失败');
    }
    setBusy(false);
  }

  if (result) {
    return (
      <div className="notice stack" role="status">
        <h2>提交成功</h2>
        <p>当前状态：{result.status ?? 'received'}。提交成功不代表资源会公开发布。</p>
        {result.ticketToken ? (
          <>
            <p>请立即保存下面的工单查询令牌；页面关闭后无法再次显示。</p>
            <code>{result.ticketToken}</code>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <input name="website" tabIndex={-1} autoComplete="off" className="honeypot" />
      {mode === 'submission' ? (
        <>
          <label>
            标题
            <input name="title" required minLength={2} maxLength={300} />
          </label>
          <label>
            简介
            <textarea name="summary" required minLength={20} maxLength={10000} />
          </label>
          <label>
            原始来源（HTTPS）
            <input name="sourceUrl" type="url" required />
          </label>
          <label>
            网盘
            <select name="providerHint" required>
              <option value="quark">夸克网盘</option>
              <option value="baidu">百度网盘</option>
            </select>
          </label>
          <label>
            网盘分享链接（HTTPS）
            <input name="cloudUrl" type="url" required />
          </label>
          <label>
            提取码（可选）
            <input name="passcode" maxLength={32} />
          </label>
          <label>
            权利类型
            <select name="rightsType" required>
              <option value="owned">本人所有</option>
              <option value="authorized">已获明确授权</option>
              <option value="open_licensed">开放许可</option>
              <option value="public_domain">公有领域</option>
            </select>
          </label>
          <label>
            许可或授权说明
            <textarea name="rightsStatement" required minLength={20} maxLength={5000} />
          </label>
          <label>
            联系方式（仅审核人员可见）
            <input name="contact" required maxLength={320} />
          </label>
        </>
      ) : null}
      {mode === 'report' ? (
        <>
          <ResourceIdField value={resourceId} />
          <label>
            举报原因
            <select name="reasonCode" required>
              <option value="broken_link">链接失效</option>
              <option value="misleading">描述误导</option>
              <option value="prohibited_content">疑似禁止内容</option>
              <option value="privacy">涉及隐私</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label>
            详细说明
            <textarea name="description" required minLength={10} maxLength={5000} />
          </label>
          <label>
            联系方式（可选，仅审核人员可见）
            <input name="contact" maxLength={320} />
          </label>
        </>
      ) : null}
      {mode === 'takedown' ? (
        <>
          <ResourceIdField value={resourceId} />
          <label>
            通知人身份或代表关系
            <textarea name="noticeIdentity" required minLength={2} maxLength={500} />
          </label>
          <label>
            联系方式
            <input name="contact" required maxLength={320} />
          </label>
          <label>
            权利作品或原始来源
            <textarea name="workOrSource" required minLength={10} maxLength={5000} />
          </label>
          <label>
            具体请求
            <textarea name="request" required minLength={10} maxLength={5000} />
          </label>
          <label>
            初步权利证明引用（可选，不要填写密码或密钥）
            <input name="evidenceReference" maxLength={200} />
          </label>
        </>
      ) : null}
      {mode === 'counter-notice' ? (
        <>
          <label>
            原侵权工单查询令牌
            <input name="ticketToken" required minLength={20} maxLength={200} />
          </label>
          <label>
            联系方式
            <input name="contact" required maxLength={320} />
          </label>
          <label>
            不侵权说明或恢复理由
            <textarea name="statement" required minLength={20} maxLength={5000} />
          </label>
          <label>
            证据引用（可选）
            <input name="evidenceReference" maxLength={200} />
          </label>
        </>
      ) : null}
      {mode === 'submission' || mode === 'takedown' ? (
        <label>
          <input type="checkbox" required /> 我确认信息真实、完整，并愿意承担虚假陈述的责任
        </label>
      ) : null}
      <button type="submit" disabled={busy}>
        {busy ? '正在提交…' : '提交'}
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function ResourceIdField({ value }: { value: string }) {
  return (
    <label>
      被举报资源 ID
      <input name="resourceId" required defaultValue={value} pattern="[0-9a-fA-F-]{36}" />
    </label>
  );
}
