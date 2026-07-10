'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { csrfToken } from '@web/src/client/csrf';

type Synonym = { id: string; terms: string[]; isEnabled: boolean };
type Suggestion = { id: string; term: string; source: string; isEnabled: boolean };

export function SearchSettingsManager({
  synonyms,
  suggestions,
}: {
  synonyms: Synonym[];
  suggestions: Suggestion[];
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
    setMessage(
      response.ok ? '保存成功；重建索引后同义词生效' : (payload.error?.message ?? '保存失败'),
    );
    if (response.ok) router.refresh();
  }
  return (
    <div className="grid">
      <section className="panel stack">
        <h2>同义词</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const terms = String(form.get('terms') ?? '')
              .split(/[，,\n]/)
              .map((term) => term.trim())
              .filter(Boolean);
            void command('/api/v1/admin/synonyms', { terms });
            event.currentTarget.reset();
          }}
        >
          <label>
            词组（逗号分隔）
            <textarea name="terms" required placeholder="Claude Code, CC, Claude CLI" />
          </label>
          <button type="submit">添加同义词组</button>
        </form>
        {synonyms.map((synonym) => (
          <div className="card actions" key={synonym.id}>
            <span>{synonym.terms.join(' ↔ ')}</span>
            <button
              className="secondary"
              type="button"
              onClick={() =>
                void command(
                  `/api/v1/admin/synonyms/${synonym.id}`,
                  { isEnabled: !synonym.isEnabled },
                  'PATCH',
                )
              }
            >
              {synonym.isEnabled ? '停用' : '启用'}
            </button>
          </div>
        ))}
      </section>
      <section className="panel stack">
        <h2>热门搜索词</h2>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void command('/api/v1/admin/suggestions', { term: form.get('term') });
            event.currentTarget.reset();
          }}
        >
          <label>
            搜索词
            <input name="term" required maxLength={300} />
          </label>
          <button type="submit">添加热门词</button>
        </form>
        <div className="chips">
          {suggestions.map((suggestion) => (
            <span className="chip" key={suggestion.id}>
              {suggestion.term}
            </span>
          ))}
        </div>
      </section>
      {message ? <p aria-live="polite">{message}</p> : null}
    </div>
  );
}
