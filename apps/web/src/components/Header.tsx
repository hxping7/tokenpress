'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore, useThemeStore, type ThemeName } from '@/stores'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import { Menu, X, LogOut, LayoutDashboard, Globe, Palette } from 'lucide-react'
import { Logo } from '@/components/Logo'

interface Section {
  id: number
  name: string
  slug: string
  path: string
  externalUrl: string | null
  isActive: boolean
}

// 需要硬跳转（非 Next.js 客户端路由）的链接：静态页面、上传资源、外链
function isHardLink(url: string): boolean {
  return (
    url.startsWith('/statichtml') ||
    url.startsWith('/uploads') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//')
  )
}

function NavItemLink({
  item,
  className,
  onClick,
}: {
  item: Section
  className: string
  onClick?: () => void
}) {
  if (item.externalUrl) {
    return (
      <a href={item.externalUrl} onClick={onClick} className={className}>
        {item.name}
      </a>
    )
  }
  if (isHardLink(item.path)) {
    return (
      <a href={item.path} onClick={onClick} className={className}>
        {item.name}
      </a>
    )
  }
  return (
    <Link href={item.path} onClick={onClick} className={className}>
      {item.name}
    </Link>
  )
}

const themeNames: { key: ThemeName; labelZh: string; labelEn: string; color: string }[] = [
  { key: 'night', labelZh: '暗夜蓝紫', labelEn: 'Night Blue', color: '#00d4ff' },
  { key: 'cyber', labelZh: '赛博青绿', labelEn: 'Cyber Green', color: '#00ff88' },
  { key: 'lava', labelZh: '熔岩橙红', labelEn: 'Lava Orange', color: '#ff6b35' },
  { key: 'light', labelZh: '极简亮白', labelEn: 'Minimal Light', color: '#f5c542' },
  { key: 'space', labelZh: '太空深蓝', labelEn: 'Space Blue', color: '#4488ff' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showLocaleMenu, setShowLocaleMenu] = useState(false)
  const { user, logout } = useAuthStore()
  const { locale, setLocale } = useLocaleStore()
  const { theme, setTheme } = useThemeStore()
  const router = useRouter()
  const pathname = usePathname()
  const isLoggedIn = !!user

  // Fetch sections from API
  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections'),
  })

  const navItems = (sectionsData?.data || []) as Section[]

  // Fetch site name from settings
  const { data: siteSettingsData } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => api.get('/site-settings'),
    staleTime: 5 * 60 * 1000,
  })
  const siteName = siteSettingsData?.data?.site_name

  // Hide header on admin pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/auth')) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-t-border bg-t-bg-primary" style={{ backdropFilter: 'blur(20px)' }}>
      <div className="max-w-[var(--content-max-width)] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            {/* Logo + Site Name */}
            <div className="flex flex-col items-center justify-center" style={{ width: 160 }}>
              <Logo size="normal" />
              {siteName && (
                <>
                  <div className="w-full flex justify-center my-0.5">
                    <div className="w-12 h-px bg-gradient-to-r from-transparent via-t-accent-blue to-transparent" />
                  </div>
                  <span className="text-sm font-bold tracking-[0.15em] text-t-accent-blue italic leading-none text-center w-full">
                    {siteName}
                  </span>
                </>
              )}
            </div>
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavItemLink
                  key={item.id}
                  item={item}
                  className="px-3 py-2 text-sm rounded-lg text-t-text-secondary transition-colors hover:text-t-text-primary hover:bg-t-hover"
                />
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="hidden md:flex items-center gap-1.5 px-2 py-2 text-sm rounded-lg text-t-text-secondary transition-colors hover:text-t-text-primary hover:bg-t-hover"
                title={t('theme.switchTheme', locale)}
              >
                <Palette size={16} />
              </button>
              {showThemeMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
                  <div className="absolute right-0 mt-2 w-40 z-50 border border-t-border rounded-xl shadow-xl overflow-hidden bg-t-bg-secondary">
                    {themeNames.map((tItem) => (
                      <button
                        key={tItem.key}
                        onClick={() => { setTheme(tItem.key); setShowThemeMenu(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 hover:bg-t-hover ${theme === tItem.key ? 'font-medium' : ''}`}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tItem.color }} />
                        <span className={theme === tItem.key ? 'text-t-accent-blue' : 'text-t-text-secondary'}>
                          {locale === 'en' ? tItem.labelEn : tItem.labelZh}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowLocaleMenu(!showLocaleMenu)}
                className="hidden md:flex items-center gap-1.5 px-2 py-2 text-sm rounded-lg text-t-text-secondary transition-colors hover:text-t-text-primary hover:bg-t-hover"
                title={t('locale.switchLang', locale)}
              >
                <Globe size={16} />
                <span className="text-xs font-medium">{locale === 'zh' ? '中文' : 'EN'}</span>
              </button>
              {showLocaleMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLocaleMenu(false)} />
                  <div className="absolute right-0 mt-2 w-24 z-50 border border-t-border rounded-xl shadow-xl overflow-hidden bg-t-bg-secondary">
                    <button
                      onClick={() => { setLocale('zh'); setShowLocaleMenu(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-t-hover ${locale === 'zh' ? 'font-medium text-t-accent-blue' : 'text-t-text-secondary'}`}
                    >
                      中文
                    </button>
                    <button
                      onClick={() => { setLocale('en'); setShowLocaleMenu(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-t-hover ${locale === 'en' ? 'font-medium text-t-accent-blue' : 'text-t-text-secondary'}`}
                    >
                      English
                    </button>
                  </div>
                </>
              )}
            </div>

            {isLoggedIn ? (
              <>
                <Link
                  href="/admin"
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-t-accent-blue border border-t-accent-blue/80 opacity-80 transition-colors hover:bg-t-hover"
                >
                  <LayoutDashboard size={16} />
                  {t('common.admin', locale)}
                </Link>
                <button
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-t-text-secondary transition-colors hover:text-red-400"
                >
                  <LogOut size={16} />
                  {t('common.logout', locale)}
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="hidden md:block px-4 py-2 text-sm rounded-lg text-t-accent-blue border border-t-accent-blue/80 opacity-80 transition-colors hover:bg-t-hover"
              >
                {t('common.manageLogin', locale)}
              </Link>
            )}
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-t-text-secondary"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-t-border bg-t-bg-primary">
          <nav className="flex flex-col p-4 gap-1">
            {navItems.map((item) => (
              <NavItemLink
                key={item.id}
                item={item}
                className="px-3 py-3 text-sm rounded-lg text-t-text-secondary transition-colors hover:text-t-text-primary hover:bg-t-hover"
                onClick={() => setMobileOpen(false)}
              />
            ))}
            {/* Mobile language & theme */}
            <div className="flex items-center gap-2 px-3 py-3 border-t border-t-border pt-3">
              <button
                onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-t-text-secondary bg-t-hover transition-colors"
              >
                <Globe size={16} />
                {locale === 'zh' ? 'English' : '中文'}
              </button>
              <div className="flex gap-1">
                {themeNames.map((tItem) => (
                  <button
                    key={tItem.key}
                    onClick={() => { setTheme(tItem.key); setMobileOpen(false) }}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${theme === tItem.key ? 'ring-2 ring-offset-2 ring-t-accent-blue' : ''}`}
                    style={{ backgroundColor: tItem.color }}
                    title={locale === 'en' ? tItem.labelEn : tItem.labelZh}
                  />
                ))}
              </div>
            </div>
            {isLoggedIn ? (
              <>
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-3 py-3 text-sm rounded-lg text-t-accent-blue transition-colors hover:bg-t-hover"
                  onClick={() => setMobileOpen(false)}
                >
                  <LayoutDashboard size={16} />
                  {t('common.admin', locale)}
                </Link>
                <button
                  onClick={() => { handleLogout(); setMobileOpen(false) }}
                  className="flex items-center gap-2 px-3 py-3 text-sm rounded-lg text-t-text-secondary transition-colors hover:text-red-400"
                >
                  <LogOut size={16} />
                  {t('common.logout', locale)}
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="block px-3 py-3 text-sm rounded-lg text-t-accent-blue transition-colors hover:bg-t-hover"
                onClick={() => setMobileOpen(false)}
              >
                {t('common.manageLogin', locale)}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
