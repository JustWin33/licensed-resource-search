import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { listAdminResources } from '@web/src/server/resource-service';
import { LogoutButton } from './logout-button';
import { ResourceActions } from './resource-actions';

export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  const resources = await listAdminResources();
  return (
    <main className="shell">
      <header className="topbar">
        <span className="brand">管理后台</span>
        <div className="actions">
          <span>{admin.username}</span>
          <LogoutButton />
        </div>
      </header>
      <div className="actions" style={{ marginBottom: '1rem' }}>
        <Link className="button" href="/admin/resources/new">
          新建资源
        </Link>
        {admin.permissions.includes('settings.write') ? (
          <>
            <Link href="/admin/taxonomy">分类与标签</Link>
            <Link href="/admin/search-settings">搜索配置</Link>
            <Link href="/admin/link-operations">链接与渠道</Link>
          </>
        ) : null}
        <Link href="/">公开站点</Link>
        {admin.permissions.includes('governance.handle') ? (
          <Link href="/admin/governance">投稿与治理</Link>
        ) : null}
        {admin.permissions.includes('import.write') ? (
          <Link href="/admin/imports">批量导入</Link>
        ) : null}
        {admin.permissions.includes('analytics.read') ? (
          <Link href="/admin/analytics">运营报表</Link>
        ) : null}
      </div>
      <section className="stack">
        {resources.map((resource) => (
          <article className="card stack" key={resource.id}>
            <div>
              <h2>{resource.title}</h2>
              <p>{resource.summary}</p>
              <div className="chips">
                <span className="chip">审核：{resource.reviewStatus}</span>
                <span className="chip">发布：{resource.publicationStatus}</span>
                <span className="chip">权利：{resource.rightsStatus}</span>
              </div>
              <div className="chips">
                {resource.categories.map((category) => (
                  <span className="chip" key={category.id}>
                    {category.name}
                  </span>
                ))}
                {resource.tags.map((tag) => (
                  <span className="chip" key={tag.id}>
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="muted">
              来源：{resource.sources.map((source) => source.name).join('、')} · 链接：
              {resource.links.map((link) => `${link.providerName}/${link.status}`).join('、')}
            </p>
            <Link href={`/admin/resources/${resource.id}/edit`}>编辑并重新审核</Link>
            <ResourceActions
              id={resource.id}
              version={resource.version}
              authorizationId={resource.authorizations[0]?.id}
              canReview={admin.permissions.includes('resource.review')}
              canPublish={
                admin.permissions.includes('resource.publish') &&
                resource.reviewStatus === 'approved'
              }
            />
          </article>
        ))}
        {resources.length === 0 ? <div className="notice">还没有资源。</div> : null}
      </section>
    </main>
  );
}
