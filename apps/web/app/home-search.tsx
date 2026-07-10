'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const HISTORY_KEY = 'licensed-resource-search-history';

export function HomeSearch({ suggestions }: { suggestions: string[] }) {
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
      if (Array.isArray(value))
        setHistory(value.filter((item): item is string => typeof item === 'string').slice(0, 8));
    } catch {
      localStorage.removeItem(HISTORY_KEY);
    }
  }, []);
  return (
    <div className="stack">
      <form
        action="/search"
        className="search-form"
        onSubmit={(event) => {
          const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
          if (!query) return;
          const next = [query, ...history.filter((item) => item !== query)].slice(0, 8);
          setHistory(next);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        }}
      >
        <label htmlFor="q" className="sr-only">
          搜索资料
        </label>
        <input
          id="q"
          name="q"
          minLength={1}
          maxLength={200}
          required
          placeholder="搜索有明确来源和授权依据的资料"
        />
        <button type="submit">搜索</button>
        <select name="provider" aria-label="网盘筛选" defaultValue="">
          <option value="">全部网盘</option>
          <option value="quark">夸克网盘</option>
          <option value="baidu">百度网盘</option>
          <option value="generic">通用外链</option>
        </select>
      </form>
      {suggestions.length ? (
        <div className="chips" aria-label="热门搜索">
          {suggestions.map((term) => (
            <Link className="chip" href={`/search?q=${encodeURIComponent(term)}`} key={term}>
              {term}
            </Link>
          ))}
        </div>
      ) : null}
      {history.length ? (
        <div className="stack">
          <div className="actions">
            <span className="muted">本机搜索历史</span>
            <button
              className="link-button"
              type="button"
              onClick={() => {
                localStorage.removeItem(HISTORY_KEY);
                setHistory([]);
              }}
            >
              清除
            </button>
          </div>
          <div className="chips">
            {history.map((term) => (
              <Link className="chip" href={`/search?q=${encodeURIComponent(term)}`} key={term}>
                {term}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
