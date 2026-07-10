import Link from 'next/link';
import { searchPublicResources } from '@web/src/server/search-service';
import { listTaxonomy } from '@web/src/server/taxonomy-service';

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
  const rights = ['owned', 'authorized', 'open_licensed', 'public_domain'].includes(
    String(params.rights),
  )
    ? (params.rights as 'owned' | 'authorized' | 'open_licensed' | 'public_domain')
    : undefined;
  const linkStatus = [
    'pending',
    'available',
    'need_password',
    'risk_controlled',
    'unknown',
  ].includes(String(params.linkStatus))
    ? (params.linkStatus as
        | 'pending'
        | 'available'
        | 'need_password'
        | 'risk_controlled'
        | 'unknown')
    : undefined;
  const sort = ['relevance', 'newest', 'popular'].includes(String(params.sort))
    ? (params.sort as 'relevance' | 'newest' | 'popular')
    : 'relevance';
  const taxonomy = await listTaxonomy();
  const category = taxonomy.categories.some((item) => item.slug === params.category)
    ? String(params.category)
    : undefined;
  let data: Awaited<ReturnType<typeof searchPublicResources>> = { hits: [], estimatedTotalHits: 0 };
  let error: string | null = null;
  if (q) {
    try {
      data = await searchPublicResources({
        q,
        provider,
        category,
        rights,
        linkStatus,
        sort,
        limit: 20,
      });
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
        <div className="filter-grid">
          <label>
            网盘
            <select name="provider" defaultValue={provider ?? ''}>
              <option value="">全部网盘</option>
              <option value="quark">夸克网盘</option>
              <option value="baidu">百度网盘</option>
              <option value="generic">通用外链</option>
            </select>
          </label>
          <label>
            分类
            <select name="category" defaultValue={category ?? ''}>
              <option value="">全部分类</option>
              {taxonomy.categories.map((item) => (
                <option value={item.slug} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            授权类型
            <select name="rights" defaultValue={rights ?? ''}>
              <option value="">全部授权</option>
              <option value="owned">自有</option>
              <option value="authorized">明确授权</option>
              <option value="open_licensed">开放许可</option>
              <option value="public_domain">公有领域</option>
            </select>
          </label>
          <label>
            链接状态
            <select name="linkStatus" defaultValue={linkStatus ?? ''}>
              <option value="">全部状态</option>
              <option value="available">可用</option>
              <option value="need_password">需要提取码</option>
              <option value="pending">待检查</option>
              <option value="unknown">未知</option>
              <option value="risk_controlled">平台风控</option>
            </select>
          </label>
          <label>
            排序
            <select name="sort" defaultValue={sort}>
              <option value="relevance">相关度</option>
              <option value="newest">最近发布</option>
              <option value="popular">热门</option>
            </select>
          </label>
        </div>
      </form>
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
