import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { adminResourceEditDto, getAdminResource } from '@web/src/server/resource-service';
import { listTaxonomy } from '@web/src/server/taxonomy-service';
import { ResourceEditForm } from './resource-edit-form';

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!admin.permissions.includes('resource.write')) redirect('/admin');
  const [resource, taxonomy] = await Promise.all([
    getAdminResource((await params).id),
    listTaxonomy(),
  ]);
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/admin" className="brand">
          返回管理后台
        </Link>
      </header>
      <h1>编辑资源</h1>
      <ResourceEditForm resource={adminResourceEditDto(resource)} {...taxonomy} />
    </main>
  );
}
