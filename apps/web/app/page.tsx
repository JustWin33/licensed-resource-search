import Link from 'next/link';
import { listPublicSuggestions } from '@web/src/server/search-settings-service';
import { listTaxonomy } from '@web/src/server/taxonomy-service';
import { HomeSearch } from './home-search';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const suggestions = await listPublicSuggestions();
  const taxonomy = await listTaxonomy();
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
        <nav>
          <Link href="/submit">提交资源</Link> <Link href="/case-status">工单查询</Link>{' '}
          <Link href="/takedown">侵权通知</Link> <Link href="/admin">管理后台</Link>
        </nav>
      </header>
      <section className="hero">
        <p className="eyebrow">只检索已审核、可公开的资料</p>
        <h1>找到有明确来源与授权依据的学习资料</h1>
        <HomeSearch suggestions={suggestions} />
        <p className="muted">平台不抓取盘搜站，不自动转存，不绕过网盘登录、验证码或风控。</p>
      </section>
      {taxonomy.categories.length ? (
        <section className="panel stack">
          <h2>按分类浏览</h2>
          <div className="chips">
            {taxonomy.categories
              .filter((item) => item.isEnabled)
              .map((item) => (
                <Link
                  className="chip"
                  href={`/search?q=${encodeURIComponent(item.name)}&category=${encodeURIComponent(item.slug)}`}
                  key={item.id}
                >
                  {item.name}
                </Link>
              ))}
          </div>
        </section>
      ) : null}
      <footer className="actions">
        <Link href="/report">一般举报</Link>
        <Link href="/takedown">版权与侵权通知</Link>
        <Link href="/counter-notice">恢复申请</Link>
        <Link href="/legal/terms">服务条款</Link>
        <Link href="/legal/privacy">隐私政策</Link>
        <Link href="/legal/collection">收录规则</Link>
        <Link href="/legal/promotion">推广披露</Link>
        <Link href="/legal/contact">联系</Link>
      </footer>
      <section className="notice" aria-label="合规说明">
        <h2>收录边界</h2>
        <p>
          仅收录自有、明确授权、开放许可或公有领域资料。点击网盘按钮可能存在渠道关系，但点击不等于转化。
        </p>
      </section>
    </main>
  );
}
