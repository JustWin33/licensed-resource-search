import Link from 'next/link';
import { StatusForm } from './status-form';

export default function CaseStatusPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
      </header>
      <h1>工单状态查询</h1>
      <p>系统只返回工单类型、状态和更新时间，不公开投诉材料。</p>
      <StatusForm />
    </main>
  );
}
