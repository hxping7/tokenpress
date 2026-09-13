'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { FooterLogo } from '@/components/FooterLogo'
import { api } from '@/lib/api'
import { useLocaleStore } from '@/stores'
import { useStyleFooter, useStyleSite } from '@/components/StyleProvider'
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

/**
 * 页脚渲染约定：
 * - **内容**（导航链接 / 版权 / 备案 / 友链数据 / 站点简介）唯一来源是 `site_settings`
 *   与 `friend_links` 表，风格包**不得**提供任何内容。
 * - **装修**（布局档位 / 网格列数与比例 / 间距 / 分隔线 / 字号字重字距 / 各区块显隐）
 *   由风格包 `footer` 根键定义，全部经 `--footer-*` CSS 变量注入。
 */
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
  const fc = useStyleFooter() || {}
  // 站点信息（由 site_settings 解析出的全局值，只读）
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

  // Hide footer on admin and auth pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/auth')) {
    return null
  }

  // ===== 风格包：只取「装修」配置 =====
  const navCfg = (fc.nav || {}) as any
  const brandCfg = (fc.brandBlock || {}) as any
  const friendCfg = (fc.friendLinks || {}) as any
  const bottomCfg = (fc.bottom || {}) as any
  const logoCfg = (fc.logo || {}) as any

  const settings = settingsData?.data || {}

  // ===== 内容：唯一来源 site_settings / friend_links 表（风格包不提供） =====
  const copyrightText = site.copyright ?? settings.copyright_text ?? ''
  const icpNumber = site.icp ?? settings.icp_number
  const icpUrl = site.icpUrl ?? settings.icp_url ?? 'https://beian.miit.gov.cn/'
  const poweredBy = site.poweredBy ?? settings.powered_by ?? ''

  let footerNav: FooterNavGroup[] = []
  try {
    footerNav = settings.footer_nav ? JSON.parse(settings.footer_nav) : []
  } catch {
    footerNav = []
  }
  // 兼容旧平铺格式（NavItem[] 无 links 且无 html）→ 归到单一「导航」分组
  if (
    footerNav.length > 0 &&
    !Array.isArray((footerNav as any)[0]?.links) &&
    (footerNav as any)[0]?.html === undefined
  ) {
    const flatItems = footerNav as unknown as NavItem[]
    footerNav = [{ title: locale === 'en' ? 'Navigation' : '导航', links: flatItems }]
  }

  // 品牌块文案：风格包只决定「显不显示 / 取哪个站点字段」，不提供文案本身
  const brandText =
    brandCfg.show === true
      ? brandCfg.source === 'siteName'
        ? settings.site_name || site.name || ''
        : settings.site_description || ''
      : ''

  const activeFriendLinks =
    friendCfg.show === false
      ? []
      : ((linksData?.data || []) as FriendLink[])
          .filter((l) => l.isActive && l.name && l.url)
          .slice(0, Number(friendCfg.maxItems) || 20)
          .map((l) => ({ ...l, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}` }))

  // logo.show 控制「版权区」的 logo；品牌块有自己的 showLogo，互不牵连
  const logoBox = (vars?: React.CSSProperties) => (
    <div
      style={{ ...(footerDark ? FOOTER_LOGO_DARK_VARS : undefined), height: 'var(--footer-logo-height)', ...vars }}
    >
      <FooterLogo />
    </div>
  )
  const logoSrc = logoCfg.show === false ? null : logoBox()
  const brandLogoSrc = brandCfg.showLogo === false ? null : logoBox()

  const navTitleSize = navCfg.title?.size || '0.875rem'
  const navTitleWeight = Number(navCfg.title?.weight ?? 600)
  const navTitleTransform = (navCfg.title?.transform || 'none') as React.CSSProperties['textTransform']
  const navTitleSpacing = navCfg.title?.letterSpacing || 'normal'
  const navTitleMb = navCfg.title?.marginBottom || '0.75rem'
  const navTitleColor = navCfg.title?.color || 'var(--footer-fg)'

  // ===== 装修变量：包未配置时用保守默认值，保证不配也好看 =====
  const footerVars: React.CSSProperties = {
    '--footer-fg': footerFg,
    '--footer-fg-muted': footerFgMuted,
    '--footer-fg-hover': footerFgHover,
    '--footer-padding': fc.padding || '2rem 1rem',
    '--footer-max-width': fc.maxWidth || 'var(--content-max-width)',
    '--footer-border-top': fc.borderTop === false ? 'none' : fc.borderTop || '1px solid var(--border-color)',
    // 导航网格
    '--footer-nav-gap': navCfg.gap || '2rem 3rem',
    '--footer-nav-title-size': navTitleSize,
    '--footer-nav-title-weight': String(navTitleWeight),
    '--footer-nav-title-transform': navTitleTransform || 'none',
    '--footer-nav-title-spacing': navTitleSpacing,
    '--footer-nav-title-mb': navTitleMb,
    '--footer-nav-title-color': navTitleColor,
    '--footer-nav-link-size': navCfg.link?.size || '0.875rem',
    '--footer-nav-link-lh': navCfg.link?.lineHeight || '1.9',
    '--footer-nav-link-gap': navCfg.link?.gap || '0.5rem',
    '--footer-nav-cols-md': String(navCfg.responsive?.md ?? navCfg.responsive?.sm ?? 1),
    '--footer-nav-cols-lg': String(navCfg.responsive?.lg ?? 2),
    // 品牌块 / 友链 / 版权区
    '--footer-brand-size': brandCfg.size || '0.8125rem',
    '--footer-brand-lh': brandCfg.lineHeight || '1.7',
    '--footer-fl-gap': friendCfg.gap || '1.5rem',
    '--footer-fl-title-size': friendCfg.titleSize || '0.8125rem',
    '--footer-bottom-size': bottomCfg.size || '0.75rem',
    '--footer-bottom-gap': bottomCfg.gap || '1rem',
    '--footer-logo-height': logoCfg.height || '1.5rem',
  } as React.CSSProperties

  const footerStyle: React.CSSProperties = { ...footerVars, borderTop: 'var(--footer-border-top)' }
  if (fc?.background) footerStyle.background = fc.background
  if (fc?.textColor) footerStyle.color = fc.textColor

  const navDivider =
    navCfg.divider === false ? 'none' : navCfg.divider || '1px solid var(--border-color)'
  const bottomDivider =
    bottomCfg.divider === false ? 'none' : bottomCfg.divider || '1px solid var(--border-color)'

  const showNav = footerNav.length > 0 || !!brandText
  const showFriend = activeFriendLinks.length > 0
  const showBottom = bottomCfg.show !== false && !!(copyrightText || icpNumber || poweredBy)

  const LinkRow = ({ children }: { children: React.ReactNode }) => (
    <div
      className="flex flex-wrap items-center"
      style={{ gap: 'var(--footer-bottom-gap)', fontSize: 'var(--footer-bottom-size)' }}
    >
      {children}
    </div>
  )

  const CopyrightLine = (
    <>
      {copyrightText && (
        <span style={{ color: 'var(--footer-fg-muted)' }}>{copyrightText}</span>
      )}
    </>
  )
  const IcpLine =
    bottomCfg.showIcp !== false && icpNumber ? (
      <a
        href={icpUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors"
        style={{ color: 'var(--footer-fg-muted)' }}
      >
        {icpNumber}
      </a>
    ) : null
  const PoweredLine =
    bottomCfg.showPoweredBy !== false && poweredBy ? (
      <span style={{ color: 'var(--footer-fg-muted)' }}>{poweredBy}</span>
    ) : null

  // ===== 档位 1：minimal —— 居中 Logo + 版权 =====
  if (fc?.variant === 'minimal') {
    return (
      <footer style={footerStyle}>
        <div
          className="mx-auto flex flex-col items-center"
          style={{
            maxWidth: 'var(--footer-max-width)',
            padding: 'var(--footer-padding)',
            gap: 'var(--footer-bottom-gap)',
          }}
        >
          {logoSrc}
          <span style={{ fontSize: 'var(--footer-bottom-size)', color: 'var(--footer-fg)' }}>
            {copyrightText}
          </span>
        </div>
      </footer>
    )
  }

  // ===== 档位 2：simple —— 单行（左 版权 / 右 备案 + Powered by） =====
  if (fc?.variant === 'simple') {
    return (
      <footer style={footerStyle}>
        <div
          className="mx-auto flex flex-col md:flex-row items-center md:justify-between px-4"
          style={{
            maxWidth: 'var(--footer-max-width)',
            padding: 'var(--footer-padding)',
            gap: 'var(--footer-bottom-gap)',
          }}
        >
          <div
            className="flex flex-col md:flex-row items-center"
            style={{ gap: 'var(--footer-bottom-gap)', fontSize: 'var(--footer-bottom-size)' }}
          >
            {logoSrc}
            {CopyrightLine}
          </div>
          <LinkRow>
            {IcpLine}
            {PoweredLine}
          </LinkRow>
        </div>
      </footer>
    )
  }

  // ===== 档位 3（默认）：multi-column —— 导航网格 + 友链 + 版权区 =====
  const navColumns = Number(navCfg.columns) || Number(settings.footer_nav_columns) || 4
  const navTemplate =
    typeof navCfg.template === 'string' && navCfg.template
      ? navCfg.template
      : `repeat(${navColumns}, minmax(0, 1fr))`
  const responsiveGrid = navCfg.responsive === false ? '' : 'footer-nav-grid'
  const navAlign = navCfg.align === 'center' ? 'center' : 'start'

  const bottomLayout = bottomCfg.layout || 'columns'

  return (
    <footer style={footerStyle}>
      <div className="mx-auto" style={{ maxWidth: 'var(--footer-max-width)' }}>
        {(showNav || showFriend) && (
          <div className="px-4" style={{ padding: 'var(--footer-padding)' }}>
            {showNav && (
              <div
                className={responsiveGrid}
                style={{
                  display: 'grid',
                  gridTemplateColumns: navTemplate,
                  gap: 'var(--footer-nav-gap)',
                }}
              >
                {/* 品牌块：Logo + 站点简介（文案取自 site_settings，风格包只决定显隐与字号） */}
                {brandText && (
                  <div style={{ textAlign: navAlign === 'center' ? 'center' : 'left' }}>
                    <div style={{ marginBottom: '0.75rem' }}>{brandLogoSrc}</div>
                    <p
                      style={{
                        fontSize: 'var(--footer-brand-size)',
                        lineHeight: 'var(--footer-brand-lh)',
                        color: 'var(--footer-fg)',
                      }}
                    >
                      {brandText}
                    </p>
                  </div>
                )}

                {footerNav.map((group, gIdx) => (
                  <div key={gIdx} style={{ textAlign: navAlign }}>
                    {group.title && (
                      <h3
                        style={{
                          fontSize: 'var(--footer-nav-title-size)',
                          fontWeight: navTitleWeight,
                          textTransform: navTitleTransform,
                          letterSpacing: 'var(--footer-nav-title-spacing)',
                          marginBottom: 'var(--footer-nav-title-mb)',
                          color: 'var(--footer-nav-title-color)',
                        }}
                      >
                        {group.title}
                      </h3>
                    )}
                    {group.html !== undefined ? (
                      <div
                        className="[&_a]:transition-colors [&_img]:inline-block"
                        style={{
                          fontSize: 'var(--footer-nav-link-size)',
                          color: 'var(--footer-fg)',
                        }}
                        dangerouslySetInnerHTML={{ __html: group.html || '' }}
                      />
                    ) : (
                      <ul
                        className="list-none"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--footer-nav-link-gap)',
                          fontSize: 'var(--footer-nav-link-size)',
                          lineHeight: 'var(--footer-nav-link-lh)',
                          color: 'var(--footer-fg)',
                        }}
                      >
                        {(group.links || []).map((item, lIdx) => (
                          <li key={lIdx}>
                            {item.url?.startsWith('/') || item.url?.startsWith('#') ? (
                              <Link
                                href={item.url}
                                className="transition-colors hover:!text-[var(--footer-fg-hover)]"
                                style={{ color: 'var(--footer-fg)' }}
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors hover:!text-[var(--footer-fg-hover)]"
                                style={{ color: 'var(--footer-fg)' }}
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
            )}

            {/* 友情链接：数据来自 friend_links 表，风格包只控制展示形态 */}
            {showFriend && (
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: navDivider }}>
                {friendCfg.title && (
                  <h4
                    style={{
                      fontSize: 'var(--footer-fl-title-size)',
                      marginBottom: '0.75rem',
                      color: 'var(--footer-fg)',
                    }}
                  >
                    {friendCfg.title}
                  </h4>
                )}
                <div
                  style={
                    friendCfg.layout === 'grid'
                      ? {
                          display: 'grid',
                          gridTemplateColumns: `repeat(${Number(friendCfg.columns) || 6}, minmax(0, 1fr))`,
                          gap: 'var(--footer-fl-gap)',
                        }
                      : {
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 'var(--footer-fl-gap)',
                        }
                  }
                >
                  {activeFriendLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-nowrap transition-colors hover:!text-[var(--footer-fg-hover)]"
                      style={{ color: 'var(--footer-fg)', fontSize: 'var(--footer-nav-link-size)' }}
                    >
                      {link.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 版权区：三列 / 两端对齐 / 居中 */}
        {showBottom && (
          <div style={{ borderTop: showNav || showFriend ? bottomDivider : 'none' }}>
            <div
              className="px-4"
              style={{ padding: 'var(--footer-padding)', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}
            >
              {bottomLayout === 'between' && (
                <div
                  className="flex flex-col md:flex-row items-center md:justify-between"
                  style={{ gap: 'var(--footer-bottom-gap)', fontSize: 'var(--footer-bottom-size)' }}
                >
                  <div className="flex items-center" style={{ gap: 'var(--footer-bottom-gap)' }}>
                    {logoSrc}
                    {CopyrightLine}
                  </div>
                  <LinkRow>
                    {IcpLine}
                    {PoweredLine}
                  </LinkRow>
                </div>
              )}

              {bottomLayout === 'centered' && (
                <div
                  className="flex flex-col items-center text-center"
                  style={{ gap: 'var(--footer-bottom-gap)', fontSize: 'var(--footer-bottom-size)' }}
                >
                  {logoSrc}
                  {CopyrightLine}
                  <LinkRow>
                    {IcpLine}
                    {PoweredLine}
                  </LinkRow>
                </div>
              )}

              {bottomLayout === 'columns' && (
                <div
                  className="grid grid-cols-1 md:grid-cols-3 items-center"
                  style={{ gap: 'var(--footer-bottom-gap)', fontSize: 'var(--footer-bottom-size)' }}
                >
                  <div className="flex flex-col items-center md:items-start" style={{ gap: 'var(--footer-bottom-gap)' }}>
                    {logoSrc}
                    {CopyrightLine}
                  </div>
                  <div className="flex justify-center">{IcpLine}</div>
                  <div className="flex justify-center md:justify-end">{PoweredLine}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 上方区块全空时（无导航、无友链、无版权），footer 只剩一条分隔线，不会塌陷 */}
        {!showNav && !showFriend && !showBottom && <div style={{ height: '1px' }} />}
      </div>
    </footer>
  )
}
