'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfToken } from '@web/src/client/csrf';

type Option = { id: string; name: string };

export function ResourceForm({ categories, tags }: { categories: Option[]; tags: Option[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/v1/admin/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({
        title: form.get('title'),
        summary: form.get('summary'),
        ownerType: form.get('ownerType'),
        rightsStatus: form.get('rightsStatus'),
        categoryIds: form.getAll('categoryIds'),
        tagIds: form.getAll('tagIds'),
        source: {
          url: form.get('sourceUrl'),
          name: form.get('sourceName'),
          type: form.get('sourceType'),
        },
        authorization: {
          licenseName: form.get('licenseName') || undefined,
          licenseUrl: form.get('licenseUrl') || undefined,
          verificationBasis: form.get('verificationBasis'),
          allowsCommercialPromotion: form.get('allowsCommercialPromotion') === 'on',
        },
        link: {
          provider: form.get('provider'),
          url: form.get('cloudUrl'),
          passcode: form.get('passcode') || undefined,
          isPrimary: true,
        },
      }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) return setError(payload.error?.message ?? '创建失败');
    router.replace('/admin');
    router.refresh();
  }
  return (
    <form className="panel form-grid" onSubmit={submit}>
      <label>
        标题
        <input name="title" minLength={2} maxLength={300} required />
      </label>
      <label>
        简介
        <textarea name="summary" minLength={10} maxLength={10000} required />
      </label>
      <div className="grid">
        <label>
          所有者类型
          <select name="ownerType">
            <option value="deployer">部署者自有</option>
            <option value="authorized_submitter">提交者授权</option>
            <option value="third_party_rightsholder">第三方权利人</option>
          </select>
        </label>
        <label>
          权利状态
          <select name="rightsStatus">
            <option value="owned">自有</option>
            <option value="authorized">已授权</option>
            <option value="open_licensed">开放许可</option>
            <option value="public_domain">公有领域</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend>分类</legend>
        <div className="chips">
          {categories.map((category) => (
            <label className="chip" key={category.id}>
              <input name="categoryIds" type="checkbox" value={category.id} /> {category.name}
            </label>
          ))}
          {categories.length === 0 ? <span className="muted">请先在后台创建分类</span> : null}
        </div>
      </fieldset>
      <fieldset>
        <legend>标签</legend>
        <div className="chips">
          {tags.map((tag) => (
            <label className="chip" key={tag.id}>
              <input name="tagIds" type="checkbox" value={tag.id} /> {tag.name}
            </label>
          ))}
        </div>
      </fieldset>
      <h2>来源</h2>
      <label>
        来源名称
        <input name="sourceName" required />
      </label>
      <label>
        来源 URL
        <input name="sourceUrl" type="url" required placeholder="https://..." />
      </label>
      <label>
        来源类型
        <select name="sourceType">
          <option value="official_site">官方网站</option>
          <option value="author_page">作者页面</option>
          <option value="license_registry">许可登记</option>
          <option value="public_archive">公共档案</option>
          <option value="user_submitted">用户提交</option>
          <option value="other">其他</option>
        </select>
      </label>
      <h2>授权依据</h2>
      <p className="muted">审核通过前，必须提供公开许可原文 URL，或上传一份私有授权证据。</p>
      <label>
        许可名称
        <input name="licenseName" />
      </label>
      <label>
        许可原文 URL
        <input name="licenseUrl" type="url" />
      </label>
      <label>
        核验依据
        <textarea name="verificationBasis" minLength={10} required />
      </label>
      <label>
        <input name="allowsCommercialPromotion" type="checkbox" /> 允许商业推广
      </label>
      <h2>网盘链接</h2>
      <label>
        平台
        <select name="provider">
          <option value="quark">夸克网盘</option>
          <option value="baidu">百度网盘</option>
        </select>
      </label>
      <label>
        分享链接
        <input name="cloudUrl" type="url" required />
      </label>
      <label>
        提取码
        <input name="passcode" maxLength={32} autoComplete="off" />
      </label>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button disabled={busy} type="submit">
        {busy ? '创建中…' : '创建并提交审核'}
      </button>
    </form>
  );
}
