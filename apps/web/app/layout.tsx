import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '授权资料搜索',
  description: '合规优先、可审计的授权资料搜索与安全跳转平台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
