import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnalyticsChoice } from '../analytics-choice';

const pages = {
  terms: {
    title: '服务条款',
    paragraphs: [
      '本服务仅提供有明确来源与授权依据的资源元数据检索和安全外链跳转。使用者不得投稿侵权、违法、恶意、泄露隐私或规避平台安全机制的内容。',
      '投稿通过不代表平台对内容作永久保证；授权撤回、投诉成立、链接失效或规则变化时，资源可能被隐藏或移除。代码按仓库许可证开放，收录内容不因此自动获得同一许可证。',
    ],
  },
  privacy: {
    title: '隐私政策',
    paragraphs: [
      '平台不建立浏览器指纹，不保存完整 User-Agent、完整 Referer 查询或完整 IP。限流标识使用短期 HMAC；搜索和点击原始事件默认保留 90 天后删除，仅保留不可还原的日级汇总。',
      '投稿、举报和侵权通知中的联系方式与声明使用应用层加密，仅获授权审核人员可访问。普通投稿默认一年到期；争议材料按适用规则和法律保留政策处理。',
    ],
  },
  collection: {
    title: '内容收录规则',
    paragraphs: [
      '只收录部署者自有、明确授权、开放许可或公有领域资料，且必须有公开来源、许可或可核验证据、人工审核和有效链接。',
      '不收录未授权影视、音乐、图书、课程、题库、付费社群、破解工具、密钥、个人数据、账号凭证、商业秘密、恶意软件、诈骗或法律法规禁止传播的内容。“仅供学习”不能代替授权。',
    ],
  },
  promotion: {
    title: '推广链接披露',
    paragraphs: [
      '部分“前往网盘”按钮可能使用后台预先审核并启用的官方渠道或活动模板。访客参数不会透传为任意跳转地址。',
      '点击不等于转化。平台只在官方签名回调或官方报表可验证时记录转化，不根据点击推算拉新、转存、付费或收益。',
    ],
  },
  copyright: {
    title: '版权与侵权通知规则',
    paragraphs: [
      '权利人可通过公开侵权通知表提交身份与联系方式、权利作品或原始来源、具体请求、初步证明和真实性声明。材料不会公开展示。',
      '审核人员确认通知完整可信后，可立即临时隐藏资源并移除搜索和跳转；提交方可提交不侵权说明。最终处理包括补充材料、维持隐藏、恢复或永久下架。',
    ],
  },
  contact: {
    title: '联系方式',
    paragraphs: [
      '一般资源问题请使用站内举报或投稿工单；侵权事项请使用版权与侵权通知表；安全漏洞请按照 GitHub 仓库 SECURITY.md 私下报告。',
      '本开源项目不提供未经授权资源，不接受通过公开 Issue 发送身份证明、密码、提取码、访问令牌或未公开证据。',
    ],
  },
} as const;

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug as keyof typeof pages;
  const page = pages[slug];
  if (!page) notFound();
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          授权资料搜索
        </Link>
      </header>
      <article className="panel stack">
        <h1>{page.title}</h1>
        {page.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {slug === 'privacy' ? <AnalyticsChoice /> : null}
        {slug === 'copyright' ? (
          <div className="actions">
            <Link className="button" href="/takedown">
              提交侵权通知
            </Link>
            <Link href="/counter-notice">提交恢复申请</Link>
          </div>
        ) : null}
      </article>
    </main>
  );
}
