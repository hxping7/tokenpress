'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore, useThemeStore, type ThemeName } from '@/stores'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import {
  Menu, X, LogOut, LayoutDashboard, Globe, Palette, Sun, Moon, User, LogIn,
  Settings, Search, Bell, Plus, Mail, Phone, Home, BookOpen, Heart, Star,
  Image as ImageIcon, Link2, ChevronDown, Command, Zap, Sparkles, Gauge,
  MessageSquare, Send,
} from 'lucide-react'
import { useStyleHeader } from '@/components/StyleProvider'
import { Logo } from '@/components/Logo'

interface Section {
  id: number
  name: string
  slug: string
  path: string
  externalUrl: string | null
  isActive: boolean
}

interface HeaderNavItem {
  name: string
  path: string
  externalUrl?: string | null
}

// ===== 模板包 header.actions 类型 =====
type ActionType = 'theme' | 'language' | 'admin' | 'login' | 'logout' | 'link'
type ActionStyle = 'icon' | 'text' | 'ghost' | 'outline' | 'primary' | 'pill'

interface HeaderAction {
  id?: string
  type: ActionType
  icon?: string
  label?: string | { zh?: string; en?: string }
  style?: ActionStyle
  show?: boolean
  showWhen?: 'always' | 'loggedIn' | 'loggedOut'
  href?: string
}

// ===== 图标注册表（模板可通过 icon 字段引用）=====
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  palette: Palette, sun: Sun, moon: Moon, globe: Globe, dashboard: LayoutDashboard,
  user: User, login: LogIn, logout: LogOut, settings: Settings, search: Search,
  bell: Bell, plus: Plus, mail: Mail, phone: Phone, home: Home, book: BookOpen,
  heart: Heart, star: Star, image: ImageIcon, link: Link2, chevronDown: ChevronDown,
  command: Command, zap: Zap, sparkles: Sparkles, gauge: Gauge, message: MessageSquare,
  send: Send, menu: Menu, x: X,
}

function Icon({ name, size = 16, className }: { name?: string; size?: number; className?: string }) {
  const C = name ? ICON_MAP[name] : undefined
  if (!C) return null
  return <C size={size} className={className} />
}

function resolveLabel(label: any, locale: string): string {
  if (!label) return ''
  if (typeof label === 'string') return label
  if (typeof label === 'object') return locale === 'en' ? (label.en ?? label.zh ?? '') : (label.zh ?? label.en ?? '')
  return ''
}

function defaultWhen(type: ActionType): 'always' | 'loggedIn' | 'loggedOut' {
  if (type === 'admin' || type === 'logout') return 'loggedIn'
  if (type === 'login') return 'loggedOut'
  return 'always'
}

function defaultStyleFor(type: ActionType): ActionStyle {
  if (type === 'admin' || type === 'login') return 'outline'
  if (type === 'theme') return 'icon'
  return 'ghost'
}

function actionClass(style: ActionStyle): string {
  const base = 'inline-flex items-center justify-center transition-colors'
  switch (style) {
    case 'icon':
      return `${base} p-2 rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover`
    case 'text':
      return `${base} px-2 py-2 text-sm text-t-text-secondary hover:text-t-text-primary`
    case 'ghost':
      return `${base} gap-1.5 px-3 py-2 text-sm rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover`
    case 'outline':
      return `${base} gap-1.5 px-3 py-2 text-sm rounded-lg text-t-accent-blue border border-t-accent-blue/80 opacity-80 hover:bg-t-hover`
    case 'primary':
      return `${base} gap-1.5 px-4 py-2 text-sm rounded-lg bg-t-accent-blue text-white hover:opacity-90`
    case 'pill':
      return `${base} gap-1.5 px-4 py-2 text-sm rounded-full text-t-text-secondary hover:bg-t-hover`
    default:
      return `${base} gap-1.5 px-3 py-2 text-sm rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover`
  }
}

// 未配置 actions 时的经典回退（保持历史外观）
const CLASSIC_ACTIONS: HeaderAction[] = [
  { type: 'theme', icon: 'palette', style: 'icon' },
  { type: 'language', icon: 'globe', style: 'ghost', label: { zh: '中文', en: 'EN' } },
  { type: 'admin', icon: 'dashboard', style: 'outline', showWhen: 'loggedIn' },
  { type: 'logout', icon: 'logout', style: 'ghost', showWhen: 'loggedIn' },
  { type: 'login', icon: 'user', style: 'outline', showWhen: 'loggedOut' },
]

// ===== 模板包驱动的操作按钮（桌面 + 移动共用）=====
function HeaderActions({
  actions,
  variant,
  locale,
  theme,
  setTheme,
  setLocale,
  isLoggedIn,
  handleLogout,
  showThemeMenu,
  showLocaleMenu,
  setShowThemeMenu,
  setShowLocaleMenu,
  onItemClick,
}: {
  actions: HeaderAction[]
  variant: 'desktop' | 'mobile'
  locale: string
  theme: string
  setTheme: (t: ThemeName) => void
  setLocale: (l: any) => void
  isLoggedIn: boolean
  handleLogout: () => void
  showThemeMenu?: boolean
  showLocaleMenu?: boolean
  setShowThemeMenu?: (v: boolean) => void
  setShowLocaleMenu?: (v: boolean) => void
  onItemClick?: () => void
}) {
  const isDesktop = variant === 'desktop'
  const visible = actions.filter((a) => {
    if (a.show === false) return false
    const when = a.showWhen || defaultWhen(a.type)
    if (when === 'loggedIn') return isLoggedIn
    if (when === 'loggedOut') return !isLoggedIn
    return true
  })

  return (
    <>
      {visible.map((a, i) => {
        const icon = <Icon name={a.icon} size={16} />
        const label = resolveLabel(a.label, locale)
        const hasLabel = !!label
        const cls = actionClass(a.style || defaultStyleFor(a.type))
        const resp = isDesktop ? `${cls} hidden md:inline-flex` : `${cls} w-full`

        if (a.type === 'theme') {
          if (isDesktop) {
            return (
              <div key={i} className="relative hidden md:block">
                <button
                  onClick={() => setShowThemeMenu?.(!showThemeMenu)}
                  className={resp}
                  title={t('theme.switchTheme', locale)}
                >
                  {icon}
                  {hasLabel && <span>{label}</span>}
                </button>
                {showThemeMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu?.(false)} />
                    <div className="absolute right-0 mt-2 w-40 z-50 border border-t-border rounded-xl shadow-xl overflow-hidden bg-t-bg-secondary">
                      {themeNames.map((tItem) => (
                        <button
                          key={tItem.key}
                          onClick={() => { setTheme(tItem.key); setShowThemeMenu?.(false) }}
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
            )
          }
          return (
            <div key={i} className="flex gap-1 px-3 py-3">
              {themeNames.map((tItem) => (
                <button
                  key={tItem.key}
                  onClick={() => { setTheme(tItem.key); onItemClick?.() }}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${theme === tItem.key ? 'ring-2 ring-offset-2 ring-t-accent-blue' : ''}`}
                  style={{ backgroundColor: tItem.color }}
                  title={locale === 'en' ? tItem.labelEn : tItem.labelZh}
                />
              ))}
            </div>
          )
        }

        if (a.type === 'language') {
          if (isDesktop) {
            return (
              <div key={i} className="relative hidden md:block">
                <button
                  onClick={() => setShowLocaleMenu?.(!showLocaleMenu)}
                  className={resp}
                  title={t('locale.switchLang', locale)}
                >
                  {icon}
                  {hasLabel && <span className="text-xs font-medium">{label}</span>}
                </button>
                {showLocaleMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowLocaleMenu?.(false)} />
                    <div className="absolute right-0 mt-2 w-24 z-50 border border-t-border rounded-xl shadow-xl overflow-hidden bg-t-bg-secondary">
                      <button
                        onClick={() => { setLocale('zh'); setShowLocaleMenu?.(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-t-hover ${locale === 'zh' ? 'font-medium text-t-accent-blue' : 'text-t-text-secondary'}`}
                      >
                        中文
                      </button>
                      <button
                        onClick={() => { setLocale('en'); setShowLocaleMenu?.(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-t-hover ${locale === 'en' ? 'font-medium text-t-accent-blue' : 'text-t-text-secondary'}`}
                      >
                        English
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          }
          return (
            <button
              key={i}
              onClick={() => { setLocale(locale === 'zh' ? 'en' : 'zh'); onItemClick?.() }}
              className="flex items-center gap-2 px-3 py-3 text-sm rounded-lg text-t-text-secondary bg-t-hover transition-colors w-full"
            >
              {icon}
              {hasLabel ? <span>{label}</span> : (locale === 'zh' ? 'English' : '中文')}
            </button>
          )
        }

        if (a.type === 'admin') {
          const txt = hasLabel ? label : t('common.admin', locale)
          return (
            <Link key={i} href="/admin" onClick={onItemClick} className={resp}>
              {icon}
              {txt && <span>{txt}</span>}
            </Link>
          )
        }
        if (a.type === 'login') {
          const txt = hasLabel ? label : t('common.manageLogin', locale)
          return (
            <Link key={i} href="/auth/login" onClick={onItemClick} className={resp}>
              {icon}
              {txt && <span>{txt}</span>}
            </Link>
          )
        }
        if (a.type === 'logout') {
          const txt = hasLabel ? label : t('common.logout', locale)
          return (
            <button key={i} onClick={() => { handleLogout(); onItemClick?.() }} className={resp}>
              {icon}
              {txt && <span>{txt}</span>}
            </button>
          )
        }
        // link
        return (
          <Link key={i} href={a.href || '#'} onClick={onItemClick} className={resp}>
            {icon}
            {hasLabel && <span>{label}</span>}
          </Link>
        )
      })}
    </>
  )
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
  item: HeaderNavItem
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

function navItemClass(style?: string): string {
  const base = 'px-3 py-2 text-sm transition-colors'
  if (style === 'pill') {
    return `${base} rounded-full hover:bg-t-hover hover:text-t-text-primary text-t-text-secondary`
  }
  if (style === 'plain') {
    return `${base} text-t-text-secondary hover:text-t-text-primary`
  }
  // underline（默认）
  return `${base} rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover`
}

function LogoBlock({ hc }: { hc: any }) {
  const logo = hc?.logo || {}
  const height: number = logo.height || 36
  if (logo.type === 'text' || (!logo.src && logo.text)) {
    return (
      <span
        className="text-xl font-extrabold tracking-tight gradient-text leading-none"
        style={{ height }}
      >
        {logo.text || 'Token00'}
      </span>
    )
  }
  // 渲染项目内置真实品牌标（与加 style 功能前的博客 logo 一致）
  if (logo.type === 'component') {
    return <Logo asLink={false} size="normal" />
  }
  if (logo.src) {
    return (
      <Image
        src={logo.src}
        alt="Logo"
        width={200}
        height={height}
        unoptimized
        className="h-auto w-auto object-contain"
        style={{ height: `${height}px`, width: 'auto' }}
      />
    )
  }
  // 无配置：默认文字 Logo
  return (
    <span className="text-xl font-extrabold tracking-tight gradient-text leading-none" style={{ height }}>
      Token00
    </span>
  )
}

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

  const hc = useStyleHeader() || {}
  const variant: string = hc.variant || 'sticky-solid'
  const navCfg = hc.nav || {}
  const navStyle: string = navCfg.style || 'underline'
  const navAlign: string = navCfg.align || 'right'
  const isFixed = variant !== 'static'
  const isTransparent = variant === 'sticky-transparent'
  const logoPosition: string = hc.logo?.position || 'left'

  // 模板包定义的操作按钮（未定义时回退经典集合）
  const actionDefs: HeaderAction[] = Array.isArray(hc.actions) ? hc.actions : CLASSIC_ACTIONS

  // Fetch sections from API
  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections'),
  })

  const sectionItems: HeaderNavItem[] =
    navCfg.source === 'custom' && Array.isArray(navCfg.customItems)
      ? navCfg.customItems
      : ((sectionsData?.data || []) as Section[]).map((s) => ({
          name: s.name,
          path: s.path,
          externalUrl: s.externalUrl,
        }))

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

  // 容器背景/边框（由模板包配置，可空 → 走默认）
  const headerStyle: React.CSSProperties = {}
  if (hc.background) headerStyle.background = hc.background
  if (hc.borderBottom) headerStyle.borderBottom = hc.borderBottom

  const DesktopNav = (
    <nav className={`hidden md:flex items-center gap-1 ${navAlign === 'left' ? 'justify-start' : navAlign === 'center' ? 'justify-center flex-1' : 'justify-end'}`}>
      {sectionItems.map((item) => (
        <NavItemLink
          key={item.path + item.name}
          item={item}
          className={navItemClass(navStyle)}
        />
      ))}
    </nav>
  )

  const RightMenus = (
    <div className="flex items-center gap-2">
      <HeaderActions
        actions={actionDefs}
        variant="desktop"
        locale={locale}
        theme={theme}
        setTheme={setTheme}
        setLocale={setLocale}
        isLoggedIn={isLoggedIn}
        handleLogout={handleLogout}
        showThemeMenu={showThemeMenu}
        showLocaleMenu={showLocaleMenu}
        setShowThemeMenu={setShowThemeMenu}
        setShowLocaleMenu={setShowLocaleMenu}
      />
      {/* Mobile hamburger */}
      <button
        className="md:hidden p-2 text-t-text-secondary"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </div>
  )

  const logoEl = <LogoBlock hc={hc} />

  // Logo 居中布局：上排 Logo、下排导航
  if (logoPosition === 'center') {
    return (
      <header
        className={`${isFixed ? 'fixed top-0 left-0 right-0 z-50' : 'relative'} border-b border-t-border ${isTransparent ? 'bg-transparent' : 'bg-t-bg-primary'}`}
        style={headerStyle}
      >
        <div className="max-w-[var(--content-max-width)] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16">
            <Link href={hc.logo?.link || '/'} className="flex items-center">{logoEl}</Link>
          </div>
          <div className="flex items-center justify-center pb-3">
            {DesktopNav}
            {RightMenus}
          </div>
        </div>
        {mobileOpen && (
          <MobileNav
            sectionItems={sectionItems}
            navStyle={navStyle}
            onClose={() => setMobileOpen(false)}
            locale={locale}
            theme={theme}
            setTheme={setTheme}
            setLocale={setLocale}
            isLoggedIn={isLoggedIn}
            handleLogout={handleLogout}
            actions={actionDefs}
          />
        )}
      </header>
    )
  }

  // 左 / 右布局
  const logoOnRight = logoPosition === 'right'
  return (
    <header
      className={`${isFixed ? 'fixed top-0 left-0 right-0 z-50' : 'relative'} border-b border-t-border ${isTransparent ? 'bg-transparent' : 'bg-t-bg-primary'}`}
      style={{ ...headerStyle, backdropFilter: isTransparent ? 'none' : 'blur(20px)' }}
    >
      <div className="max-w-[var(--content-max-width)] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            {!logoOnRight && <Link href={hc.logo?.link || '/'} className="flex items-center">{logoEl}</Link>}
            {!logoOnRight && DesktopNav}
            {logoOnRight && DesktopNav}
          </div>
          <div className="flex items-center gap-2">
            {logoOnRight && <Link href={hc.logo?.link || '/'} className="flex items-center">{logoEl}</Link>}
            {RightMenus}
          </div>
        </div>
      </div>
      {mobileOpen && (
        <MobileNav
          sectionItems={sectionItems}
          navStyle={navStyle}
          onClose={() => setMobileOpen(false)}
          locale={locale}
          theme={theme}
          setTheme={setTheme}
          setLocale={setLocale}
          isLoggedIn={isLoggedIn}
          handleLogout={handleLogout}
          actions={actionDefs}
        />
      )}
    </header>
  )
}

function MobileNav({
  sectionItems,
  navStyle,
  onClose,
  locale,
  theme,
  setTheme,
  setLocale,
  isLoggedIn,
  handleLogout,
  actions,
}: {
  sectionItems: HeaderNavItem[]
  navStyle: string
  onClose: () => void
  locale: string
  theme: string
  setTheme: (t: ThemeName) => void
  setLocale: (l: any) => void
  isLoggedIn: boolean
  handleLogout: () => void
  actions: HeaderAction[]
}) {
  return (
    <div className="md:hidden border-t border-t-border bg-t-bg-primary">
      <nav className="flex flex-col p-4 gap-1">
        {sectionItems.map((item) => (
          <NavItemLink
            key={item.path + item.name}
            item={item}
            className={navItemClass(navStyle) + ' px-3 py-3'}
            onClick={onClose}
          />
        ))}
        <div className="border-t border-t-border pt-3 mt-1">
          <HeaderActions
            actions={actions}
            variant="mobile"
            locale={locale}
            theme={theme}
            setTheme={setTheme}
            setLocale={setLocale}
            isLoggedIn={isLoggedIn}
            handleLogout={handleLogout}
            onItemClick={onClose}
          />
        </div>
      </nav>
    </div>
  )
}
