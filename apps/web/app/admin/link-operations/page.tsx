import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { listLinkOperations } from '@web/src/server/link-operations-service';
import { LinkOperationsManager } from './link-operations-manager';

export default async function LinkOperationsPage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!admin.permissions.includes('settings.write')) redirect('/admin');
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/admin" className="brand">
          返回管理后台
        </Link>
      </header>
      <h1>链接与推广渠道</h1>
      <LinkOperationsManager {...await listLinkOperations()} />
    </main>
  );
}
