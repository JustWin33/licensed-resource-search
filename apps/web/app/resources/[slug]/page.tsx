import Link from 'next/link';
import { notFound } from 'next/navigation';
import { decodeSlugParam } from '@platform/core';
import { getPublicResourceBySlug, publicResourceDto } from '@web/src/server/resource-service';
import { PasscodeReveal } from './passcode-reveal';

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeSlugParam((await params).slug);
  if (!slug) notFound();
  const resource = await getPublicResourceBySlug(slug);
  if (!resource) notFound();
  const dto = publicResourceDto(resource);
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
      </header>
      <article className="panel stack">
        <div>
          <p className="eyebrow">{dto.rightsStatus}</p>
          <h1>{dto.title}</h1>
          <p>{dto.summary}</p>
        </div>
        <section>
          <h2>来源与许可</h2>
          {dto.sources.map((source) => (
            <p key={source.url}>
              <a href={source.url} rel="nofollow noreferrer">
                {source.name}
              </a>{' '}
              · {source.type}
            </p>
          ))}
        </section>
        <section>
          <h2>网盘链接</h2>
          <div className="stack">
            {dto.links.map((link) => (
              <div className="card" key={link.provider}>
                <p className="status">
                  {link.providerName} · {link.status}
                </p>
                <div className="actions">
                  <a
                    className="button"
                    href={`/go/${dto.id}/${link.provider}`}
                    rel="nofollow noreferrer"
                  >
                    前往网盘
                  </a>
                  {link.hasPasscode ? (
                    <PasscodeReveal slug={dto.slug} provider={link.provider} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
        <p className="muted">
          外链状态仅代表最近一次人工或合规检查结果；平台不自动转存内容。前往按钮可能使用后台配置的官方推广渠道，点击不会改变资源价格。
        </p>
        <div className="actions">
          <Link href={`/report?resourceId=${dto.id}`}>举报此资源</Link>
          <Link href={`/takedown?resourceId=${dto.id}`}>提交侵权通知</Link>
        </div>
      </article>
    </main>
  );
}
