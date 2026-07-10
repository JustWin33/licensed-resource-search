import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Licensed Resource Search — Stage 2',
  description: 'Infrastructure-only stage two skeleton',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
