import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { listImports } from '@web/src/server/import-service';
import { ImportManager } from './import-manager';

export default async function ImportsPage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!admin.permissions.includes('import.write')) redirect('/admin');
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/admin" className="brand">
          返回管理后台
        </Link>
      </header>
      <h1>CSV / Markdown 批量导入</h1>
      <ImportManager batches={await listImports()} />
    </main>
  );
}
