import Link from 'next/link';
import { CaseForm } from '../case-form';

export default async function ReportPage({
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
      <h1>一般举报</h1>
      <p>链接失效、描述误导、隐私或禁止内容可在此举报。侵权通知请使用专门入口。</p>
      <CaseForm mode="report" resourceId={(await searchParams).resourceId} />
    </main>
  );
}
