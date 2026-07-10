import Link from 'next/link';
import { CaseForm } from '../case-form';

export default async function TakedownPage({
  searchParams,
}: {
  searchParams: Promise<{ resourceId?: string }>;
}) {
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
      </header>
      <h1>版权与侵权通知</h1>
      <p>
        请提供身份、联系方式、权利作品或原始来源、具体请求和初步权利证明。材料仅向获授权审核人员开放。
      </p>
      <CaseForm mode="takedown" resourceId={(await searchParams).resourceId} />
      <p>
        <Link href="/counter-notice">提交不侵权说明或恢复申请</Link>
      </p>
    </main>
  );
}
