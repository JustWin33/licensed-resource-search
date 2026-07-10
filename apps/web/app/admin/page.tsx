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
        <Link href="/">公开站点</Link>
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
            </div>
            <p className="muted">
              来源：{resource.sources.map((source) => source.name).join('、')} · 链接：
              {resource.links.map((link) => `${link.providerName}/${link.status}`).join('、')}
            </p>
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
