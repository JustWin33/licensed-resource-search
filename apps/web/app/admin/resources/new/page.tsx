import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { listTaxonomy } from '@web/src/server/taxonomy-service';
import { ResourceForm } from './resource-form';

export default async function NewResourcePage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!admin.permissions.includes('resource.write')) redirect('/admin');
  const taxonomy = await listTaxonomy();
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/admin" className="brand">
          返回管理后台
        </Link>
      </header>
      <h1>新建资源</h1>
      <ResourceForm {...taxonomy} />
    </main>
  );
}
