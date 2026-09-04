import type { Metadata } from 'next'
import { cache } from 'react'
import { cookies } from 'next/headers'
import '@/styles/globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { BackToTop } from '@/components/BackToTop'
import { ReadingProgress } from '@/components/ReadingProgress'
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
        compatibleThemes: d.manifest?.compatibleThemes || null,
        features: d.features || null,
      },
      theme: d.theme || '',
    }
  } catch {
    return null
  }
}

// 同一请求内 generateMetadata 与 RootLayout 共用一次 /styles/active 拉取
const getStyle = cache(getActiveStyleConfig)

const BASE_METADATA = {
  metadataBase: new URL(getSiteUrl()),
  description: `${SITE_URL} - AI赋能综合内容平台，聚焦Token计划、AI编程、AI作品与技术博客`,
  keywords: ['AI', 'Token', '编程', '人工智能', '博客', '作品展示', 'AI Agent'],
  authors: [{ name: 'Token00' }],
  creator: 'Token00',
  openGraph: {
    type: 'website' as const,
    siteName: 'Token00',
    locale: 'zh_CN',
    url: getSiteUrl(),
    description: 'AI赋能综合内容平台，聚焦Token计划、AI编程、AI作品与技术博客',
  },
  twitter: {
    card: 'summary_large_image' as const,
    site: '@token00',
    description: 'AI赋能综合内容平台，聚焦Token计划、AI编程、AI作品与技术博客',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
  },
}

// 标题模板由风格包 site.titleFormat 驱动（默认 %s | TokenPress）
export async function generateMetadata(): Promise<Metadata> {
  const base = { ...BASE_METADATA }
  let template = '%s | TokenPress'
  let brand = 'TokenPress'
  try {
    const res = await getStyle()
    const site = res?.config?.site
    if (site?.titleFormat && String(site.titleFormat).includes('%s')) {
      template = String(site.titleFormat)
    }
  } catch {}
  const tagline = 'Token 力量无限放大'
  return {
    ...base,
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: `${brand} — ${tagline}`,
      template,
    },
    openGraph: { ...base.openGraph, title: `${brand} — ${tagline}` },
    twitter: { ...base.twitter, title: `${brand} — ${tagline}` },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const styleResult = await getStyle()
  const styleConfig = styleResult?.config || {
    activeStyle: 'blog',
    defaultTheme: 'light',
    manifest: null,
    layouts: null,
    header: null,
    footer: null,
    site: null,
    hero: null,
    features: null,
  }
  const packTheme = styleResult?.theme || ''

  // 服务端依据 cookie 应用 activeTheme 覆盖层（与客户端 StyleProvider 一致，消除闪烁）
  let themeOverride = ''
  try {
    const themeCookie = (await cookies()).get('token00_theme')?.value
    if (themeCookie && themeCookie !== styleConfig.defaultTheme) {
      themeOverride = resolveThemePalette(themeCookie) || ''
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
            <ReadingProgress />
            <main className="flex-1">{children}</main>
            <BackToTop />
            <Footer />
          </StyleProvider>
        </Providers>
      </body>
    </html>
  )
}
