import type { Metadata } from 'next'
import '@/styles/globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { BackToTop } from '@/components/BackToTop'
import { Providers } from '@/providers/query-provider'
import { LocaleInitializer } from '@/components/LocaleInitializer'
import { AnalyticsLoader } from '@/components/AnalyticsLoader'

// 使用系统字体，无网络依赖
const SYSTEM_FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', 'Microsoft YaHei', sans-serif`

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'TokenPress — Token 力量无限放大',
    template: '%s | TokenPress',
  },
  description: `${SITE_URL} - AI赋能综合内容平台，聚焦Token计划、AI编程、AI作品与技术博客`,
  keywords: ['AI', 'Token', '编程', '人工智能', '博客', '作品展示', 'AI Agent'],
  authors: [{ name: 'Token00' }],
  creator: 'Token00',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE_URL,
    siteName: 'TokenPress',
    title: 'TokenPress — Token 力量无限放大',
    description: 'AI赋能综合内容平台',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TokenPress — Token 力量无限放大',
    description: 'AI赋能综合内容平台',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col antialiased bg-t-bg-primary text-t-text-primary font-sans" style={{ fontFamily: SYSTEM_FONT }}>
        <Providers>
          <LocaleInitializer />
          <AnalyticsLoader />
          <Header />
          <main className="flex-1">{children}</main>
          <BackToTop />
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
