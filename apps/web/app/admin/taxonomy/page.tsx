import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { listTaxonomy } from '@web/src/server/taxonomy-service';
import { TaxonomyManager } from './taxonomy-manager';

export default async function TaxonomyPage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!admin.permissions.includes('settings.write')) redirect('/admin');
  const taxonomy = await listTaxonomy(true);
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/admin" className="brand">
          返回管理后台
        </Link>
      </header>
      <h1>分类与标签</h1>
      <TaxonomyManager {...taxonomy} />
    </main>
  );
}
