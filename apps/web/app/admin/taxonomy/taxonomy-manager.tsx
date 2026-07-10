'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfToken } from '@web/src/client/csrf';

type Category = {
  id: string;
  name: string;
  slug: string;
  isEnabled: boolean;
  parent: { id: string; name: string } | null;
};
type Tag = { id: string; name: string; slug: string };

export function TaxonomyManager({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(path: string, body: unknown, method = 'POST') {
    setMessage(null);
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setMessage(response.ok ? '保存成功' : (payload.error?.message ?? '保存失败'));
    if (response.ok) router.refresh();
  }

  return (
    <div className="grid">
      <section className="panel stack">
        <h2>分类</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void submit('/api/v1/admin/categories', {
              name: form.get('name'),
              slug: form.get('slug') || undefined,
              parentId: form.get('parentId') || null,
            });
            event.currentTarget.reset();
          }}
        >
          <label>
            分类名称
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Slug（可留空）
            <input name="slug" maxLength={120} />
          </label>
          <label>
            上级分类
            <select name="parentId">
              <option value="">无</option>
              {categories
                .filter((category) => category.isEnabled)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit">添加分类</button>
        </form>
        <div className="stack">
          {categories.map((category) => (
            <div className="card actions" key={category.id}>
              <span>
                {category.name} <span className="muted">/{category.slug}</span>
                {category.parent ? ` · ${category.parent.name}` : ''}
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  void submit(
                    `/api/v1/admin/categories/${category.id}`,
                    { isEnabled: !category.isEnabled },
                    'PATCH',
                  )
                }
              >
                {category.isEnabled ? '停用' : '启用'}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="panel stack">
        <h2>标签</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void submit('/api/v1/admin/tags', {
              name: form.get('name'),
              slug: form.get('slug') || undefined,
            });
            event.currentTarget.reset();
          }}
        >
          <label>
            标签名称
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Slug（可留空）
            <input name="slug" maxLength={120} />
          </label>
          <button type="submit">添加标签</button>
        </form>
        <div className="chips">
          {tags.map((tag) => (
            <span className="chip" key={tag.id}>
              {tag.name} · {tag.slug}
            </span>
          ))}
        </div>
      </section>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
