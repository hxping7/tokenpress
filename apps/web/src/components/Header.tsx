'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore, useThemeStore } from '@/stores'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import {
  Menu, X, LogOut, LayoutDashboard, Globe, Palette, Sun, Moon, User, LogIn,
  Settings, Search, Bell, Plus, Mail, Phone, Home, BookOpen, Heart, Star,
  Image as ImageIcon, Link2, ChevronDown, Command, Zap, Sparkles, Gauge,
  MessageSquare, Send, Github, Bot, Code, Compass, Droplet, Waves, Newspaper,
  Info, PenTool, Layout, Folder, Flame, Rocket,
} from 'lucide-react'
import { useStyleHeader, useStyleSite, useStyleThemeOptions, useStyleFeatures } from '@/components/StyleProvider'
import { BUILTIN_THEME_OPTIONS } from '@/lib/themePalettes'
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
  slug?: string
  path: string
  externalUrl?: string | null
}

// ===== 模板包 header.actions 类型 =====
// 行为类型（theme/language/admin/login/logout/link/divider）。
// 注：图标 icon 可填 lucide 名，也可填内联 SVG 字符串（模板包自定义图标，无需改代码）。
// link 支持 target:'_blank' 新窗口打开。新增“行为”类型需改代码（安全边界），
// 但图标/标签/链接/分隔符均已完全可配置。
type ActionType = 'theme' | 'language' | 'admin' | 'login' | 'logout' | 'link' | 'divider'
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
  target?: '_blank' | '_self'
}

// ===== 图标注册表（模板可通过 icon 字段引用）=====
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  palette: Palette, sun: Sun, moon: Moon, globe: Globe, dashboard: LayoutDashboard,
  user: User, login: LogIn, logout: LogOut, settings: Settings, search: Search,
  bell: Bell, plus: Plus, mail: Mail, phone: Phone, home: Home, book: BookOpen,
  heart: Heart, star: Star, image: ImageIcon, link: Link2, chevronDown: ChevronDown,
  command: Command, zap: Zap, sparkles: Sparkles, gauge: Gauge, message: MessageSquare,
  send: Send, menu: Menu, x: X,
  github: Github, bot: Bot, code: Code, compass: Compass, droplet: Droplet,
  waves: Waves, newspaper: Newspaper, info: Info, penTool: PenTool, layout: Layout,
  folder: Folder, flame: Flame, rocket: Rocket,
}

// 根据板块名称就近推断一个图标（前端映射，无需后端字段，作为模板包未配置时的兜底）
const SECTION_ICON_KEYWORDS: { kw: string; icon: string }[] = [
  { kw: 'token', icon: 'zap' }, { kw: '计划', icon: 'zap' }, { kw: 'plan', icon: 'zap' },
  { kw: 'github', icon: 'github' },
  { kw: 'ai', icon: 'bot' }, { kw: '编程', icon: 'code' }, { kw: 'code', icon: 'code' },
  { kw: '作品', icon: 'palette' }, { kw: 'works', icon: 'image' }, { kw: 'design', icon: 'penTool' }, { kw: '设计', icon: 'penTool' },
  { kw: '博客', icon: 'book' }, { kw: 'blog', icon: 'book' },
  { kw: '资源', icon: 'compass' }, { kw: '导航', icon: 'compass' },
  { kw: '灵感', icon: 'droplet' }, { kw: '瀑布', icon: 'waves' },
  { kw: '杂志', icon: 'newspaper' }, { kw: 'magazine', icon: 'newspaper' },
  { kw: '关于', icon: 'info' }, { kw: 'about', icon: 'info' },
  { kw: '友情', icon: 'link' }, { kw: 'links', icon: 'link' },
  { kw: '热门', icon: 'flame' }, { kw: 'rocket', icon: 'rocket' },
]
// 优先级：① 模板包 nav.icons[slug] ② nav.icons[name] ③ 关键词兜底 ④ 无
function iconForSection(
  name: string,
  slug?: string,
  iconMap?: Record<string, string>,
  showIcons = true,
): string | undefined {
  if (!showIcons) return undefined
  // 模板包显式配置了 nav.icons：仅用其指定图标，不再走关键词兜底（避免不合时宜的自动图标）
  if (iconMap && Object.keys(iconMap).length > 0) {
    if (slug && iconMap[slug]) return iconMap[slug]
    if (name && iconMap[name]) return iconMap[name]
    return undefined
  }
  // 未配置 nav.icons 的回退：按板块名关键词推断
  const n = (name || '').toLowerCase()
  for (const { kw, icon } of SECTION_ICON_KEYWORDS) {
    if (n.includes(kw.toLowerCase())) return icon
  }
  return undefined
}

// 内联 SVG 清洗：剔除脚本与事件属性，仅保留展示性图标（模板包自定义图标用）
function sanitizeInlineSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<svg/, '<svg style="width:100%;height:100%;display:block;"')
}

export function Icon({ name, size = 16, className }: { name?: string; size?: number; className?: string }) {
  if (!name) return null
  const C = ICON_MAP[name]
  if (C) return <C size={size} className={className} />
  // 模板包自定义图标：内联 SVG（无需改代码即可新增图标）
  const t = name.trim()
  if (t.startsWith('<svg') && t.includes('</svg>')) {
    return (
      <span
        className={className}
        style={{ display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ __html: sanitizeInlineSvg(t) }}
      />
    )
  }
  return null
}

// 由颜色亮度判断是否为“浅色文字”（用于推断导航栏深浅模式）
function colorLuminance(c: string): number {
  const s = (c || '').trim()
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
  return 0
}
function isLightColor(c: string): boolean {
  return colorLuminance(c) > 0.5
}

// 深色主题集合：导航栏背景若跟随主题（透明栏 / var(--bg-primary)），则由当前主题明暗决定“深色栏”
const DARK_THEMES = new Set<string>(['night', 'cyber', 'lava', 'space'])

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
  if (type === 'divider') return 'ghost'
  return 'ghost'
}

function actionClass(style: ActionStyle, dark = false): string {
  const base = 'inline-flex items-center justify-center transition-colors'
  if (dark) {
    switch (style) {
      case 'icon':
        return `${base} p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10`
      case 'text':
        return `${base} px-2 py-2 text-sm text-slate-300 hover:text-white`
      case 'ghost':
        return `${base} gap-1.5 px-3 py-2 text-sm rounded-lg text-slate-300 hover:text-white hover:bg-white/10`
      case 'outline':
        return `${base} gap-1.5 px-3 py-2 text-sm rounded-lg text-cyan-300 border border-cyan-400/70 hover:bg-white/10`
      case 'primary':
        return `${base} gap-1.5 px-4 py-2 text-sm rounded-lg bg-cyan-500 text-slate-900 hover:bg-cyan-400`
      case 'pill':
        return `${base} gap-1.5 px-4 py-2 text-sm rounded-full text-slate-300 hover:bg-white/10`
      default:
        return `${base} gap-1.5 px-3 py-2 text-sm rounded-lg text-slate-300 hover:text-white hover:bg-white/10`
    }
  }
  switch (style) {
    case 'icon':
      return `${base} p-2 rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover`
    case 'text':
      return `${base} px-2 py-2 text-sm text-t-text-secondary hover:text-t-text-primary`
    case 'ghost':
      return `${base} gap-1.5 px-3 py-2 text-sm rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover`
    case 'outline':
      return 'btn-pack-outline opacity-90'
    case 'primary':
      return 'btn-pack-primary'
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
  dark,
}: {
  actions: HeaderAction[]
  variant: 'desktop' | 'mobile'
  locale: string
  theme: string
  setTheme: (t: string) => void
  setLocale: (l: any) => void
  isLoggedIn: boolean
  handleLogout: () => void
  showThemeMenu?: boolean
  showLocaleMenu?: boolean
  setShowThemeMenu?: (v: boolean) => void
  setShowLocaleMenu?: (v: boolean) => void
  onItemClick?: () => void
  dark?: boolean
}) {
  // 可切换配色：优先用风格包 manifest.themeOptions 声明的列表，否则回退内置 5 套
  const packThemeOptions = useStyleThemeOptions()
  const effectiveThemeOptions = packThemeOptions.length ? packThemeOptions : BUILTIN_THEME_OPTIONS

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
        const cls = actionClass(a.style || defaultStyleFor(a.type), dark)
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
                    <div className={`absolute right-0 mt-2 w-40 z-50 border rounded-xl shadow-xl overflow-hidden ${dark ? 'bg-slate-800 border-slate-700' : 'bg-t-bg-secondary border-t-border'}`}>
                      {effectiveThemeOptions.map((tItem) => (
                        <button
                          key={tItem.key}
                          onClick={() => { setTheme(tItem.key); setShowThemeMenu?.(false) }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${dark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-t-hover text-t-text-secondary'} ${theme === tItem.key ? 'font-medium' : ''}`}
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tItem.color }} />
                          <span className={theme === tItem.key ? (dark ? 'text-cyan-300' : 'text-t-accent-blue') : ''}>
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
              {effectiveThemeOptions.map((tItem) => (
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
                    <div className={`absolute right-0 mt-2 w-24 z-50 border rounded-xl shadow-xl overflow-hidden ${dark ? 'bg-slate-800 border-slate-700' : 'bg-t-bg-secondary border-t-border'}`}>
                      <button
                        onClick={() => { setLocale('zh'); setShowLocaleMenu?.(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${dark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-t-hover text-t-text-secondary'} ${locale === 'zh' ? 'font-medium text-t-accent-blue' : ''}`}
                      >
                        中文
                      </button>
                      <button
                        onClick={() => { setLocale('en'); setShowLocaleMenu?.(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${dark ? 'hover:bg-white/10 text-slate-200' : 'hover:bg-t-hover text-t-text-secondary'} ${locale === 'en' ? 'font-medium text-t-accent-blue' : ''}`}
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
        if (a.type === 'divider') {
          return isDesktop
            ? <div key={i} className="w-px h-6 bg-t-border mx-1 self-center" />
            : <div key={i} className="h-px w-full bg-t-border my-2" />
        }
        // link
        return (
          <Link
            key={i}
            href={a.href || '#'}
            onClick={onItemClick}
            className={resp}
            target={a.target === '_blank' ? '_blank' : undefined}
            rel={a.target === '_blank' ? 'noopener noreferrer' : undefined}
          >
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
  icon,
}: {
  item: HeaderNavItem
  className: string
  onClick?: () => void
  icon?: string
}) {
  const iconEl = icon ? <Icon name={icon} size={16} className="shrink-0" /> : null
  if (item.externalUrl) {
    return (
      <a href={item.externalUrl} onClick={onClick} className={className}>
        {iconEl}
        <span>{item.name}</span>
      </a>
    )
  }
  if (isHardLink(item.path)) {
    return (
      <a href={item.path} onClick={onClick} className={className}>
        {iconEl}
        <span>{item.name}</span>
      </a>
    )
  }
  return (
    <Link href={item.path} onClick={onClick} className={className}>
      {iconEl}
      <span>{item.name}</span>
    </Link>
  )
}

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

function LogoBlock({ hc, theme }: { hc: any; theme?: string }) {
  const logo = hc?.logo || {}
  const height: number = logo.height || 36
  // 亮色主题下使用深色调 logo 变体，避免发光白字在白底上隐形/发灰
  const isLight = theme === 'light'
  const logoSrc = isLight ? (logo.srcLight || '/logo-light.svg') : (logo.src || '/logo-dark.svg')
  if (logo.type === 'text' || (!logo.src && logo.text)) {
    return (
      <span
        className="text-xl font-extrabold tracking-tight text-t-text-primary leading-none"
        style={{ height }}
      >
        {logo.text || 'Token00'}
      </span>
    )
  }
  // 渲染项目内置自适应 Logo（随主题配色变化）。
  // 风格包未提供专属 logo 图片（落到内置 /logo-dark|light.svg）或显式声明 component 时，
  // 统一走内置 Logo 组件；仅当风格包显式配置其它图片 src 时才用静态图。
  if (logo.type === 'component' || logoSrc === '/logo-dark.svg' || logoSrc === '/logo-light.svg') {
    return <Logo asLink={false} height={height} />
  }
  if (logoSrc) {
    return (
      <Image
        src={logoSrc}
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
    <span className="text-xl font-extrabold tracking-tight text-t-text-primary leading-none" style={{ height }}>
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
  const site = useStyleSite() || {}
  const variant: string = hc.variant || 'sticky-solid'
  const navCfg = hc.nav || {}
  const navStyle: string = navCfg.style || 'underline'
  const navAlign: string = navCfg.align || 'right'
  const isFixed = variant !== 'static'
  const isTransparent = variant === 'sticky-transparent'
  const logoPosition: string = hc.logo?.position || 'left'

  // 模板包定义的操作按钮（未定义时回退经典集合）
  // features.languageSwitcher === false → 从全部渲染位点（桌面/移动）剔除语言切换按钮
  const styleFeatures = useStyleFeatures() || {}
  const langActionOn = styleFeatures.languageSwitcher !== false
  const actionDefs: HeaderAction[] = (Array.isArray(hc.actions) ? (hc.actions as HeaderAction[]) : CLASSIC_ACTIONS).filter(
    (a: HeaderAction) => !(a.type === 'language' && !langActionOn),
  )

  // 导航颜色：组装为 CSS 变量，注入到导航根，供 .nav-item 读取
  const navColors = hc.nav?.colors || {}
  const navVarStyle: React.CSSProperties = {
    // @ts-ignore 自定义属性
    '--nav-text': navColors.text || '',
    '--nav-hover-bg': navColors.hoverBg || '',
    '--nav-hover-text': navColors.hoverText || '',
    '--nav-active-bg': navColors.activeBg || '',
    '--nav-active-text': navColors.activeText || '',
    '--nav-bar-bg': navColors.barBg || '',
    '--nav-bar-text': navColors.barText || '',
  }
  const navHeight: number = Number(hc.nav?.height || 56)
  const navWidth: number = Number(hc.nav?.width || 220)
  const navPosition: string = hc.nav?.position || 'top'

  // 左侧导航：令整站主内容右移（离开页面时复位）
  useEffect(() => {
    if (navPosition === 'left') {
      document.body.style.paddingLeft = `${navWidth}px`
    } else {
      document.body.style.paddingLeft = ''
    }
    return () => {
      document.body.style.paddingLeft = ''
    }
  }, [navPosition, navWidth])

  function navItemCls(active: boolean): string {
    const r = navStyle === 'pill' ? 'pill' : navStyle === 'plain' ? 'plain' : ''
    return `nav-item ${active ? 'is-active' : ''} ${r}`.trim()
  }
  const isActiveNav = (path: string) =>
    pathname === path || (path !== '/' && pathname?.startsWith(path))

  // Fetch sections from API
  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections'),
  })

  const navIcons: Record<string, string> =
    navCfg.icons && typeof navCfg.icons === 'object' ? navCfg.icons : {}
  const sectionItems: HeaderNavItem[] =
    navCfg.source === 'custom' && Array.isArray(navCfg.customItems)
      ? navCfg.customItems
      : ((sectionsData?.data || []) as Section[]).map((s) => ({
          name: s.name,
          slug: s.slug,
          path: s.path,
          externalUrl: s.externalUrl,
        }))

  // Fetch site name from settings（风格包 site.name 覆盖优先）
  const { data: siteSettingsData } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => api.get('/site-settings'),
    staleTime: 5 * 60 * 1000,
  })
  const siteName = site.name ?? siteSettingsData?.data?.site_name

  // Hide header on admin pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/auth')) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  // 导航栏是否为“深色栏”：背景来源有三种 ——
  // ① 透明栏（sticky-transparent，透出主题 / 英雄区）→ 由当前主题明暗决定；
  // ② 固定深色背景（如博客深空渐变）→ 恒定深色栏；
  // ③ 跟随主题的背景（var(--bg-primary)）→ 由当前主题明暗决定。
  // 这样无论切换哪套主题，导航文字 / 按钮都能与栏背景保持足够对比度。
  const DARK_BAR_BG = 'linear-gradient(90deg, #020810 0%, #0a1c33 52%, #020810 100%)'
  const bgFollowsTheme = !hc.background || hc.background === 'var(--bg-primary)'
  const isDarkBar = isTransparent
    ? DARK_THEMES.has(theme)
    : bgFollowsTheme
      ? DARK_THEMES.has(theme)
      : !isLightColor(hc.background)

  // 实体栏背景：优先用模板包 background；未显式设置时按主题明暗回退
  let barBackground: string
  if (isTransparent) barBackground = 'transparent'
  else if (hc.background && hc.background !== 'var(--bg-primary)') barBackground = hc.background
  else barBackground = isDarkBar ? DARK_BAR_BG : 'var(--bg-primary)'

  // 边框：深色栏用青蓝描边，浅色栏用模板包 border（默认细线）
  const barBorder = isTransparent
    ? 'none'
    : isDarkBar
      ? '1px solid rgba(0,212,255,0.22)'
      : (hc.borderBottom || '1px solid var(--border-color)')

  // 容器背景/边框；非透明栏时顶部加一道风格包强调色细线，让不同风格包的导航条一眼可辨
  const headerTopAccent: string | undefined = isTransparent ? undefined : '3px solid var(--accent-blue)'
  const headerStyle: React.CSSProperties = { ...navVarStyle, background: barBackground, borderBottom: barBorder, borderTop: headerTopAccent }

  const DesktopNav = (
    <nav className={`hidden md:flex items-center gap-1.5 ${navAlign === 'left' ? 'justify-start' : navAlign === 'center' ? 'justify-center flex-1' : 'justify-end'}`}>
      {sectionItems.map((item) => (
        <NavItemLink
          key={item.path + item.name}
          item={item}
          icon={iconForSection(item.name, item.slug, navIcons)}
          className={navItemCls(isActiveNav(item.path))}
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
        dark={isDarkBar}
      />
      {/* Mobile hamburger */}
      <button
        className={`md:hidden p-2 ${isDarkBar ? 'text-slate-300' : 'text-t-text-secondary'}`}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </div>
  )

  const logoEl = <LogoBlock hc={hc} theme={theme} />

  // 左侧竖向导航：固定左侧栏，主内容由 body.paddingLeft 右移
  if (navPosition === 'left') {
    const leftBg = barBackground
    const leftBorder = barBorder
    return (
      <header
        className="fixed left-0 top-0 bottom-0 z-50 border-r flex flex-col"
        style={{
          width: navWidth,
          ...navVarStyle,
          background: leftBg,
          borderColor: leftBorder,
          borderTop: '3px solid var(--accent-blue)',
        }}
      >
        <div className="h-16 flex items-center justify-center px-3 border-b" style={{ borderColor: leftBorder }}>
          <Link href={hc.logo?.link || '/'} className="flex items-center">
            <LogoBlock hc={hc} theme={theme} />
          </Link>
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
          {sectionItems.map((item) => (
            <NavItemLink
              key={item.path + item.name}
              item={item}
              icon={iconForSection(item.name, item.slug, navIcons)}
              className={`${navItemCls(isActiveNav(item.path))} w-full`}
            />
          ))}
        </nav>
        <div className="border-t p-3" style={{ borderColor: leftBorder }}>
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
            dark={isDarkBar}
          />
        </div>
      </header>
    )
  }

  // Logo 居中布局：上排 Logo、下排导航
  if (logoPosition === 'center') {
    return (
      <header
        className={`${isFixed ? 'fixed top-0 left-0 right-0 z-50' : 'relative'} border-b border-t-border ${isTransparent ? 'bg-transparent' : 'bg-t-bg-primary'}`}
        style={headerStyle}
      >
        <div className="max-w-[var(--content-max-width)] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16" style={{ height: navHeight }}>
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
            navIcons={navIcons}
            dark={isDarkBar}
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
        <div className="flex items-center justify-between h-16" style={{ height: navHeight }}>
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
          navIcons={navIcons}
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
  navIcons,
  dark,
}: {
  sectionItems: HeaderNavItem[]
  navStyle: string
  onClose: () => void
  locale: string
  theme: string
  setTheme: (t: string) => void
  setLocale: (l: any) => void
  isLoggedIn: boolean
  handleLogout: () => void
  actions: HeaderAction[]
  navIcons?: Record<string, string>
  dark?: boolean
}) {
  return (
    <div className={`md:hidden border-t ${dark ? 'bg-slate-900 border-slate-700' : 'border-t-border bg-t-bg-primary'}`}>
      <nav className="flex flex-col p-4 gap-1">
        {sectionItems.map((item) => (
          <NavItemLink
            key={item.path + item.name}
            item={item}
            icon={iconForSection(item.name, item.slug, navIcons)}
            className={navItemClass(navStyle) + ' px-3 py-3'}
            onClick={onClose}
          />
        ))}
        <div className={`border-t pt-3 mt-1 ${dark ? 'border-slate-700' : 'border-t-border'}`}>
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
            dark={dark}
          />
        </div>
      </nav>
    </div>
  )
}
