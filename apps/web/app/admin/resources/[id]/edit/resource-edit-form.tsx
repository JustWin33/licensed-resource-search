'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfToken } from '@web/src/client/csrf';

type Option = { id: string; name: string };
type Resource = {
  id: string;
  title: string;
  summary: string;
  ownerType: string;
  rightsStatus: string;
  version: number;
  categoryIds: string[];
  tagIds: string[];
};

export function ResourceEditForm({
  resource,
  categories,
  tags,
}: {
  resource: Resource;
  categories: Option[];
  tags: Option[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/admin/resources/${resource.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({
        title: form.get('title'),
        summary: form.get('summary'),
        ownerType: form.get('ownerType'),
        rightsStatus: form.get('rightsStatus'),
        categoryIds: form.getAll('categoryIds'),
        tagIds: form.getAll('tagIds'),
        expectedVersion: resource.version,
      }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) return setError(payload.error?.message ?? '保存失败');
    router.replace('/admin');
    router.refresh();
  }
  return (
    <form className="panel form-grid" onSubmit={submit}>
      <p className="notice">任何编辑都会让资源退出公开状态并重新进入审核。</p>
      <label>
        标题
        <input name="title" defaultValue={resource.title} minLength={2} maxLength={300} required />
      </label>
      <label>
        简介
        <textarea
          name="summary"
          defaultValue={resource.summary}
          minLength={10}
          maxLength={10000}
          required
        />
      </label>
      <div className="grid">
        <label>
          所有者类型
          <select name="ownerType" defaultValue={resource.ownerType}>
            <option value="deployer">部署者自有</option>
            <option value="authorized_submitter">提交者授权</option>
            <option value="third_party_rightsholder">第三方权利人</option>
          </select>
        </label>
        <label>
          权利状态
          <select name="rightsStatus" defaultValue={resource.rightsStatus}>
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
              <input
                type="checkbox"
                name="categoryIds"
                value={category.id}
                defaultChecked={resource.categoryIds.includes(category.id)}
              />{' '}
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>标签</legend>
        <div className="chips">
          {tags.map((tag) => (
            <label className="chip" key={tag.id}>
              <input
                type="checkbox"
                name="tagIds"
                value={tag.id}
                defaultChecked={resource.tagIds.includes(tag.id)}
              />{' '}
              {tag.name}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? <p className="error">{error}</p> : null}
      <button disabled={busy} type="submit">
        {busy ? '保存中…' : '保存并重新提交审核'}
      </button>
    </form>
  );
}
