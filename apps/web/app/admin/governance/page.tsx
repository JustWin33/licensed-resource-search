import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { listGovernanceCases } from '@web/src/server/governance-service';
import { GovernanceManager } from './governance-manager';

export default async function GovernancePage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!admin.permissions.includes('governance.handle')) redirect('/admin');
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/admin" className="brand">
          返回管理后台
        </Link>
      </header>
      <h1>投稿与治理</h1>
      <p className="muted">此页面包含未公开的联系方式与投诉材料，仅供获授权审核人员处理。</p>
      <GovernanceManager {...await listGovernanceCases()} />
    </main>
  );
}
