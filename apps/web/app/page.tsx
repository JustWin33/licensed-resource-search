import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
        <nav>
          <Link href="/admin">管理后台</Link>
        </nav>
      </header>
      <section className="hero">
        <p className="eyebrow">只检索已审核、可公开的资料</p>
        <h1>找到有明确来源与授权依据的学习资料</h1>
        <form action="/search" className="search-form">
          <label htmlFor="q" className="sr-only">
            搜索资料
          </label>
          <input
            id="q"
            name="q"
            minLength={1}
            maxLength={200}
            required
            placeholder="例如：Claude Code、Codex、提示词"
          />
          <button type="submit">搜索</button>
        </form>
        <p className="muted">平台不抓取盘搜站，不自动转存，不绕过网盘登录、验证码或风控。</p>
      </section>
      <section className="notice" aria-label="合规说明">
        <h2>收录边界</h2>
        <p>
          仅收录自有、明确授权、开放许可或公有领域资料。点击网盘按钮可能存在渠道关系，但点击不等于转化。
        </p>
      </section>
    </main>
  );
}
