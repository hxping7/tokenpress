'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { FooterLogo } from '@/components/FooterLogo'
import { api } from '@/lib/api'
import { useLocaleStore } from '@/stores'
import { useStyleFooter, useStyleSite } from '@/components/StyleProvider'
import { t } from '@/lib/i18n'
import { useSiteSettings } from '@/lib/useSiteSettings'

// ===== Footer 前景色辅助：确保文字与 footer 背景对比度达标 =====
// 仅能判断具体色值（#hex / rgba）；var() 背景（跟随主题）返回 null → 交由主题变量处理。
function parseColorLuminance(c?: string): number | null {
  if (!c) return null
  const s = c.trim()
  if (s.startsWith('#')) {
    let hex = s
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x))
    return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255
  }
  return null
}

function withAlpha(hex: string, alpha: number): string {
  const s = (hex || '').trim()
  if (!s.startsWith('#')) return s
  let h = s
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 深色 footer 上，临时把 FooterLogo 的渐变/描边变量翻成亮色，使其在黑底可见
const FOOTER_LOGO_DARK_VARS = {
  '--accent-blue': '#e5e5e5',
  '--accent-purple': '#cfcfcf',
  '--gradient-from': '#e5e5e5',
  '--gradient-to': '#cfcfcf',
  '--text-secondary': '#e5e5e5',
  '--bg-tertiary': '#1c1c1e',
} as React.CSSProperties

interface FriendLink {
  id: number
  name: string
  url: string
  description: string | null
  isActive: boolean
}

interface NavItem {
  name: string
  url: string
}

interface FooterNavGroup {
  title: string
  links?: NavItem[]
  html?: string
}

export function Footer() {
  const pathname = usePathname()
  const { locale } = useLocaleStore()

  // Fetch footer settings（与全站设置共用去重后的单一请求）
  const { data: settingsData } = useSiteSettings()

  // Fetch friend links
  const { data: linksData } = useQuery({
    queryKey: ['friend-links'],
    queryFn: () => api.get('/friend-links'),
    staleTime: 5 * 60 * 1000,
  })

  // Style Pack 覆盖（必须在早期 return 前调用，遵守 Hooks 规则）
  const fc = useStyleFooter()
  // 站点信息覆盖（风格包 site + site_settings 全局默认合并结果）
  const site = useStyleSite() || {}

  // Footer 前景色：跟随 footer 背景明暗 + 包配置 textColor，避免黑底配深灰字看不见
  const footerBgLum = parseColorLuminance(fc?.background)
  const footerDark = footerBgLum !== null && footerBgLum < 0.4
  const footerTextConcrete = !!fc?.textColor && !String(fc.textColor).startsWith('var(')
  const footerFg = footerDark
    ? (fc?.textColor || '#e5e5e5')
    : footerTextConcrete
      ? String(fc?.textColor)
      : 'var(--text-secondary)'
  const footerFgMuted = footerDark
    ? footerTextConcrete
      ? withAlpha(String(fc?.textColor), 0.62)
      : 'rgba(255,255,255,0.62)'
    : 'var(--text-muted)'
  const footerFgHover = footerDark ? '#ffffff' : 'var(--text-primary)'
  const footerVarStyle: React.CSSProperties = {
    '--footer-fg': footerFg,
    '--footer-fg-muted': footerFgMuted,
    '--footer-fg-hover': footerFgHover,
  } as React.CSSProperties
  const footerLogoWrap = footerDark ? FOOTER_LOGO_DARK_VARS : undefined

  // Hide footer on admin and auth pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/auth')) {
    return null
  }

  const friendLinks = (linksData?.data || []) as FriendLink[]
  const settings = settingsData?.data || {}
  const footerNavStr = settings.footer_nav
  const footerNavColumns = parseInt(settings.footer_nav_columns || '4', 10)
  const poweredBy = site.poweredBy ?? settings.powered_by ?? ''
  const copyrightText = site.copyright ?? settings.copyright_text ?? `© ${new Date().getFullYear()} TokenPress. All rights reserved.`
  const icpNumber = site.icp ?? settings.icp_number
  const icpUrl = site.icpUrl ?? settings.icp_url ?? 'https://beian.miit.gov.cn/'

  // Parse footer nav from settings (grouped format)
  let footerNav: FooterNavGroup[] = []
  try {
    footerNav = footerNavStr ? JSON.parse(footerNavStr) : []
  } catch {
    footerNav = []
  }

  // Backward compatibility: if old flat format (NavItem[] without 'links'), convert to grouped format
  if (footerNav.length > 0 && !Array.isArray((footerNav as any)[0]?.links) && (footerNav as any)[0]?.html === undefined) {
    const flatItems = footerNav as unknown as NavItem[]
    footerNav = [{ title: locale === 'en' ? 'Navigation' : '导航', links: flatItems }]
  }

  // Style Pack 覆盖：若模板包 footer 配置了 columns，优先用它
  if (fc?.columns && Array.isArray(fc.columns) && fc.columns.length > 0) {
    footerNav = fc.columns.map((g: any) => ({
      title: g.title || '',
      links: (g.links || []).map((l: any) => ({ name: l.label, url: l.href })),
      html: g.html,
    }))
  }

  // Default nav groups if empty
  if (footerNav.length === 0) {
    footerNav = [
      {
        title: locale === 'en' ? 'Navigation' : '导航',
        links: locale === 'en'
          ? [
              { name: 'Token Plan', url: '/token-plan' },
              { name: 'AI Coding', url: '/ai-coding' },
              { name: 'AI Works', url: '/ai-works' },
              { name: 'Blog', url: '/blog' },
            ]
          : [
              { name: 'Token 计划', url: '/token-plan' },
              { name: 'AI 编程', url: '/ai-coding' },
              { name: 'AI 作品', url: '/ai-works' },
              { name: '博客', url: '/blog' },
            ],
      },
    ]
  }

  const activeFriendLinks = (() => {
    // 风格包 footer.friendLinks 控制是否展示/数据源/自定义
    const fl = fc?.friendLinks || {}
    if (fl.show === false) return []
    if (fl.source === 'custom' && Array.isArray(fl.items)) {
      return fl.items
        .filter((l: any) => l && l.name && l.url)
        .slice(0, fl.maxItems || 20)
        .map((l: any) => ({ id: `custom-${l.url}`, name: l.name, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}` }))
    }
    // 默认：读 friend_links 表
    return friendLinks
      .filter((l) => l.isActive && l.name && l.url)
      .slice(0, fl.maxItems || 20)
      .map((l) => ({ ...l, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}` }))
  })()

  // 极简 Footer（设计师作品集包）
  if (fc?.variant === 'minimal') {
    return (
      <footer className="border-t border-t-border" style={{ background: fc.background || 'transparent', ...footerVarStyle }}>
        <div className="max-w-[var(--content-max-width)] mx-auto py-10 px-4 flex flex-col items-center gap-4">
          <div style={footerLogoWrap}><FooterLogo /></div>
          <span className="text-sm text-[var(--footer-fg)]">{copyrightText || fc.bottom?.copyright}</span>
        </div>
      </footer>
    )
  }

  const footerStyle: React.CSSProperties = { ...footerVarStyle }
  if (fc?.background) footerStyle.background = fc.background
  if (fc?.textColor) footerStyle.color = fc.textColor

  return (
    <footer className="border-t border-t-border" style={footerStyle}>
      <div className="max-w-[var(--content-max-width)] mx-auto">
        {/* 竖向多段式导航 */}
        <div className="py-8 px-4">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${footerNavColumns}, 1fr)`,
              gap: '2rem 3rem',
            }}
            className="max-md:!grid-cols-1 max-lg:!grid-cols-2"
          >
            {footerNav.map((group, gIdx) => (
              <div key={gIdx} className="space-y-3">
                {group.title && (
                  <h3 className="text-sm font-semibold text-[var(--footer-fg)]">
                    {group.title}
                  </h3>
                )}
                {group.html !== undefined ? (
                  <div
                    className="text-sm text-[var(--footer-fg)] [&_a]:text-[var(--footer-fg)] [&_a]:hover:text-[var(--footer-fg-hover)] [&_a]:transition-colors [&_img]:inline-block"
                    dangerouslySetInnerHTML={{ __html: group.html || '' }}
                  />
                ) : (
                  <ul className="space-y-2.5">
                    {(group.links || []).map((item, lIdx) => (
                      <li key={lIdx}>
                        {item.url?.startsWith('/') || item.url?.startsWith('#') ? (
                          <Link
                            href={item.url}
                            className="text-sm text-[var(--footer-fg)] hover:text-[var(--footer-fg-hover)] transition-colors"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--footer-fg)] hover:text-[var(--footer-fg-hover)] transition-colors"
                          >
                            {item.name}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* 友情链接行 - 水平展示在导航分组下方 */}
          {activeFriendLinks.length > 0 && (
            <div className="mt-8 pt-6 border-t border-t-border">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {activeFriendLinks.map((link: { id: string; name: string; url: string }) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--footer-fg)] hover:text-[var(--footer-fg-hover)] transition-colors whitespace-nowrap"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 版权信息区：三列布局 — Logo+版权 | ICP | Powered by */}
        <div className="border-t border-t-border py-6 px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* 左列：Logo + 版权文本 */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <div style={footerLogoWrap}><FooterLogo /></div>
              <span className="text-xs text-[var(--footer-fg-muted)]">{copyrightText}</span>
            </div>

            {/* 中列：ICP 备案 */}
            <div className="flex justify-center">
              {icpNumber && (
                <a
                  href={icpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--footer-fg-muted)] hover:text-[var(--footer-fg-hover)] transition-colors"
                >
                  {icpNumber}
                </a>
              )}
            </div>

            {/* 右列：Powered by / 技术栈 */}
            <div className="flex justify-center md:justify-end">
              {poweredBy && (
                <span className="text-xs text-[var(--footer-fg-muted)]">{poweredBy}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}