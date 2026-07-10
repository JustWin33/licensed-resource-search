import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAnalyticsReport } from '@web/src/server/analytics-service';
import { currentAdmin } from '@web/src/server/auth';

export default async function AnalyticsPage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!admin.permissions.includes('analytics.read')) redirect('/admin');
  const report = await getAnalyticsReport();
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/admin" className="brand">
          返回管理后台
        </Link>
      </header>
      <h1>近 {report.days} 天运营报表</h1>
      <p className="notice">{report.disclosure}</p>
      <div className="grid">
        <section className="panel">
          <h2>点击与转化</h2>
          <p>去重后点击事件：{report.totalClicks}</p>
          <p>已验证官方转化：{report.verifiedConversions}</p>
          <h3>网盘点击</h3>
          <ul>
            {report.providerClicks.map((item) => (
              <li key={item.provider}>
                {item.provider}: {item.count}
              </li>
            ))}
          </ul>
          <h3>渠道点击（小样本隐藏）</h3>
          <ul>
            {report.channelClicks.map((item) => (
              <li key={item.channel}>
                {item.channel}: {item.count}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>链接状态</h2>
          <ul>
            {report.linkStatuses.map((item) => (
              <li key={item.status}>
                {item.status}: {item.count}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>热门资源</h2>
          <ol>
            {report.popularResources.map((item) => (
              <li key={item.resourceId}>
                {item.title}: {item.count}
              </li>
            ))}
          </ol>
        </section>
        <section className="panel">
          <h2>搜索词（至少 3 次）</h2>
          <ul>
            {report.topSearchTerms.map((item) => (
              <li key={item.term}>
                {item.term}: {item.count}
              </li>
            ))}
          </ul>
          <h3>无结果词</h3>
          <ul>
            {report.zeroResultTerms.map((item) => (
              <li key={item.term}>
                {item.term}: {item.count}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
