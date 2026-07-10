import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { listSearchSettings } from '@web/src/server/search-settings-service';
import { SearchSettingsManager } from './search-settings-manager';

export default async function SearchSettingsPage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!admin.permissions.includes('settings.write')) redirect('/admin');
  const settings = await listSearchSettings();
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/admin" className="brand">
          返回管理后台
        </Link>
      </header>
      <h1>搜索配置</h1>
      <SearchSettingsManager {...settings} />
      <p className="muted">
        同义词变更后执行 <code>pnpm search:rebuild</code>，通过原子索引交换上线。
      </p>
    </main>
  );
}
