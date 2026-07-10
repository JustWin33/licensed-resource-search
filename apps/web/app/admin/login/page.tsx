import { redirect } from 'next/navigation';
import { currentAdmin } from '@web/src/server/auth';
import { LoginForm } from './login-form';

export default async function AdminLoginPage() {
  if (await currentAdmin()) redirect('/admin');
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">管理后台</p>
        <h1>管理员登录</h1>
        <p className="muted">账号只能通过交互式 CLI 创建，没有默认密码。</p>
      </section>
      <LoginForm />
    </main>
  );
}
