import Link from 'next/link';
import { CaseForm } from '../case-form';

export default function CounterNoticePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
      </header>
      <h1>不侵权说明与恢复申请</h1>
      <p>只有持有原侵权工单查询令牌的人可以提交关联说明。</p>
      <CaseForm mode="counter-notice" />
    </main>
  );
}
