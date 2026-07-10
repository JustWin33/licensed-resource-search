import Link from 'next/link';
import { searchPublicResources } from '@web/src/server/search-service';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const provider = ['quark', 'baidu', 'generic'].includes(String(params.provider))
    ? (params.provider as 'quark' | 'baidu' | 'generic')
    : undefined;
  let data: Awaited<ReturnType<typeof searchPublicResources>> = { hits: [], estimatedTotalHits: 0 };
  let error: string | null = null;
  if (q) {
    try {
      data = await searchPublicResources({ q, provider, sort: 'relevance', limit: 20 });
    } catch {
      error = '搜索服务暂时不可用，请稍后再试。';
    }
  }
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
      </header>
      <form action="/search" className="search-form">
        <input name="q" defaultValue={q} required maxLength={200} aria-label="搜索资料" />
        <button type="submit">搜索</button>
      </form>
      <div className="actions" style={{ margin: '1rem 0' }}>
        <span className="muted">筛选：</span>
        {['', 'quark', 'baidu', 'generic'].map((value) => (
          <Link
            key={value || 'all'}
            href={`/search?q=${encodeURIComponent(q)}${value ? `&provider=${value}` : ''}`}
          >
            {value || '全部'}
          </Link>
        ))}
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && q ? <p className="muted">约 {data.estimatedTotalHits} 条结果</p> : null}
      <section className="results" aria-live="polite">
        {data.hits.map((resource) => (
          <article className="card" key={resource.id}>
            <h2>
              <Link href={`/resources/${resource.slug}`}>{resource.title}</Link>
            </h2>
            <p>{resource.summary}</p>
            <div className="chips">
              <span className="chip">{resource.rightsStatus}</span>
              {resource.tags.map((tag) => (
                <span className="chip" key={tag}>
                  {tag}
                </span>
              ))}
              {resource.links.map((link) => (
                <span className="chip" key={link.provider}>
                  {link.providerName} · {link.status}
                </span>
              ))}
            </div>
          </article>
        ))}
        {!error && q && data.hits.length === 0 ? (
          <div className="notice">没有找到已审核的匹配资料。</div>
        ) : null}
      </section>
    </main>
  );
}
