import Link from 'next/link';
import { CaseForm } from '../case-form';

export default function SubmitPage() {
  return (
    <PublicCasePage title="提交有授权依据的资源" intro="所有投稿先进入人工审核，不会自动发布。">
      <CaseForm mode="submission" />
    </PublicCasePage>
  );
}

function PublicCasePage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
      </header>
      <h1>{title}</h1>
      <p>{intro}</p>
      {children}
    </main>
  );
}
