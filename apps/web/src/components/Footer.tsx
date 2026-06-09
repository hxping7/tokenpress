'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { FooterLogo } from '@/components/FooterLogo'
import { api } from '@/lib/api'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'

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

  // Fetch footer settings
  const { data: settingsData } = useQuery({
    queryKey: ['site-settings', 'footer_nav,footer_nav_columns,powered_by,copyright_text,icp_number,icp_url'],
    queryFn: () => api.get('/site-settings/keys/footer_nav,footer_nav_columns,powered_by,copyright_text,icp_number,icp_url'),
    staleTime: 5 * 60 * 1000,
  })

  // Fetch friend links
  const { data: linksData } = useQuery({
    queryKey: ['friend-links'],
    queryFn: () => api.get('/friend-links'),
    staleTime: 5 * 60 * 1000,
  })

  // Hide footer on admin and auth pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/auth')) {
    return null
  }

  const friendLinks = (linksData?.data || []) as FriendLink[]
  const settings = settingsData?.data || {}
  const footerNavStr = settings.footer_nav
  const footerNavColumns = parseInt(settings.footer_nav_columns || '4', 10)
  const poweredBy = settings.powered_by || ''
  const copyrightText = settings.copyright_text || `© ${new Date().getFullYear()} TokenPress. All rights reserved.`
  const icpNumber = settings.icp_number
  const icpUrl = settings.icp_url || 'https://beian.miit.gov.cn/'

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

  const activeFriendLinks = friendLinks.filter((l) => l.isActive && l.name && l.url).map((l) => ({
    ...l,
    url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}`,
  }))

  return (
    <footer className="border-t border-t-border">
      <div className="max-w-7xl mx-auto">
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
                  <h3 className="text-sm font-semibold text-t-text-primary">
                    {group.title}
                  </h3>
                )}
                {group.html !== undefined ? (
                  <div
                    className="text-sm text-t-text-secondary [&_a]:text-t-text-secondary [&_a]:hover:text-t-text-primary [&_a]:transition-colors [&_img]:inline-block"
                    dangerouslySetInnerHTML={{ __html: group.html || '' }}
                  />
                ) : (
                  <ul className="space-y-2.5">
                    {(group.links || []).map((item, lIdx) => (
                      <li key={lIdx}>
                        {item.url?.startsWith('/') || item.url?.startsWith('#') ? (
                          <Link
                            href={item.url}
                            className="text-sm text-t-text-secondary hover:text-t-text-primary transition-colors"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-t-text-secondary hover:text-t-text-primary transition-colors"
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
                {activeFriendLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-t-text-secondary hover:text-t-text-primary transition-colors whitespace-nowrap"
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
              <FooterLogo />
              <span className="text-xs text-t-text-muted">{copyrightText}</span>
            </div>

            {/* 中列：ICP 备案 */}
            <div className="flex justify-center">
              {icpNumber && (
                <a
                  href={icpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-t-text-muted hover:text-t-text-secondary transition-colors"
                >
                  {icpNumber}
                </a>
              )}
            </div>

            {/* 右列：Powered by / 技术栈 */}
            <div className="flex justify-center md:justify-end">
              {poweredBy && (
                <span className="text-xs text-t-text-muted">{poweredBy}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}