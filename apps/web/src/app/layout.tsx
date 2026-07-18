import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import '@/styles/globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { BackToTop } from '@/components/BackToTop'
import { Providers } from '@/providers/query-provider'
import { LocaleInitializer } from '@/components/LocaleInitializer'
import { AnalyticsLoader } from '@/components/AnalyticsLoader'
import { LayoutWidth } from '@/components/LayoutWidth'
import { StyleProvider, type StyleConfig } from '@/components/StyleProvider'
import { resolveThemePalette } from '@/lib/themePalettes'
import { getSiteUrl } from '@/lib/site-url'

// 使用系统字体，无网络依赖
const SYSTEM_FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', 'Microsoft YaHei', sans-serif`

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

// 服务器端读取当前激活的 Style Pack 配置（供 SSR 注入，避免换肤闪烁）
async function getActiveStyleConfig(): Promise<{ config: StyleConfig; theme: string } | null> {
  try {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:4001'
    const res = await fetch(`${baseUrl}/api/v1/styles/active`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const d = json.data
    if (!d) return null
    return {
      config: {
        activeStyle: d.activeStyle || 'blog',
        defaultTheme: d.defaultTheme || 'light',
        manifest: d.manifest || null,
        layouts: d.layouts || null,
        header: d.header || null,
        footer: d.footer || null,
        themeVariants: d.manifest?.themeVariants || null,
      },
      theme: d.theme || '',
    }
  } catch {
    return null
  }
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
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
    siteName: 'Token00',
    locale: 'zh_CN',
    url: getSiteUrl(),
    title: 'TokenPress — Token 力量无限放大',
    description: 'AI赋能综合内容平台，聚焦Token计划、AI编程、AI作品与技术博客',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@token00',
    title: 'TokenPress — Token 力量无限放大',
    description: 'AI赋能综合内容平台，聚焦Token计划、AI编程、AI作品与技术博客',
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const styleResult = await getActiveStyleConfig()
  const styleConfig = styleResult?.config || {
    activeStyle: 'blog',
    defaultTheme: 'light',
    manifest: null,
    layouts: null,
    header: null,
    footer: null,
  }
  const packTheme = styleResult?.theme || ''

  // 服务端依据 cookie 应用 activeTheme 覆盖层（与客户端 StyleProvider 一致，消除闪烁）
  let themeOverride = ''
  try {
    const themeCookie = (await cookies()).get('token00_theme')?.value
    if (themeCookie && themeCookie !== styleConfig.defaultTheme) {
      themeOverride = resolveThemePalette(themeCookie, styleConfig.themeVariants) || ''
    }
  } catch {}

  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col antialiased bg-t-bg-primary text-t-text-primary font-sans" style={{ fontFamily: SYSTEM_FONT }}>
        {/* Style Pack 出厂配色 + 可选 activeTheme 覆盖层（注入到 head，全局生效） */}
        {packTheme && (
          <style id="style-pack" dangerouslySetInnerHTML={{ __html: packTheme }} />
        )}
        {themeOverride && (
          <style id="style-theme-override" dangerouslySetInnerHTML={{ __html: themeOverride }} />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Token00',
              url: getSiteUrl(),
              description: 'AI赋能综合内容平台，聚焦Token计划、AI编程、AI作品与技术博客',
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Token00',
              url: getSiteUrl(),
            }),
          }}
        />
        <Providers>
          <StyleProvider config={styleConfig}>
            <LocaleInitializer />
            <AnalyticsLoader />
            <LayoutWidth />
            <Header />
            <main className="flex-1">{children}</main>
            <BackToTop />
            <Footer />
          </StyleProvider>
        </Providers>
      </body>
    </html>
  )
}
