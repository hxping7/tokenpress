'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { BUILTIN_THEME_OPTIONS, resolveThemePalette } from '@/lib/themePalettes'
import { useThemeStore } from '@/stores'

export interface StyleConfig {
  activeStyle: string
  defaultTheme: string
  manifest: any
  layouts: any
  header: any
  footer: any
  // 兼容墙纸白名单（可选）：声明哪些内置主题与该包品牌色不冲突；为空/未声明=全部兼容
  compatibleThemes?: string[] | null
  // 站点信息（只读全局值，唯一来源是 site_settings，包内不存）
  site?: Record<string, any> | null
  // Hero 配置（enabled/size/interval/autoplay/showCTA/ctaButtons）
  hero?: any
  // 行为特性（readingProgressBar / welcomeOverlay 等）
  features?: Record<string, any> | null
}

const DEFAULT_CONFIG: StyleConfig = {
  activeStyle: 'blog',
  defaultTheme: 'light',
  manifest: null,
  layouts: null,
  header: null,
  footer: null,
  compatibleThemes: null,
  site: null,
  hero: null,
  features: null,
}

const StyleContext = createContext<StyleConfig>(DEFAULT_CONFIG)

const THEME_COOKIE = 'token00_theme'
const OVERRIDE_ID = 'style-theme-override'

function readThemeCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)token00_theme=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : null
}

function applyThemeOverride(
  theme: string | null,
  defaultTheme: string,
  compatibleThemes?: string[] | null,
) {
  if (typeof document === 'undefined') return
  let el = document.getElementById(OVERRIDE_ID) as HTMLStyleElement | null
  // 兼容白名单：用户所选墙纸不在包声明的兼容列表内时，回落到出厂默认（不注入覆盖层）
  const allowed = Array.isArray(compatibleThemes) && compatibleThemes.length > 0
  let effective = theme || ''
  if (allowed && effective && effective !== defaultTheme && !compatibleThemes!.includes(effective)) {
    effective = ''
  }
  // 当未选配色或选中的就是模板出厂配色时，移除覆盖层（由模板包 theme.css 决定）
  if (!effective || effective === defaultTheme) {
    if (el) el.remove()
    return
  }
  const palette = resolveThemePalette(effective)
  if (!palette) return
  if (!el) {
    el = document.createElement('style')
    el.id = OVERRIDE_ID
    // 挂到 body 末尾：保证在 SSR 注入的 style-pack（出厂配色）之后，覆盖调色板变量
    const mount = document.body || document.head
    mount.appendChild(el)
  }
  el.innerHTML = palette
}

export function StyleProvider({
  config,
  children,
}: {
  config: StyleConfig
  children: ReactNode
}) {
  // 订阅主题 store：用户点击切换或初始化导致 theme 变化时触发重注
  const theme = useThemeStore((s) => s.theme)
  const [activeTheme, setActiveTheme] = useState<string | null>(null)

  useEffect(() => {
    // 依赖 store 的 theme 以触发重跑；实际取值读 cookie（setTheme 已同步写入），
    // 避免 store 初始默认值 'night' 与真实 cookie 主题不一致造成的误判。
    const cookieTheme = readThemeCookie()
    // 兼容白名单：cookie 主题若不在包声明的兼容列表内，强制作废，回落到出厂默认
    const allowed = Array.isArray(config.compatibleThemes) && config.compatibleThemes.length > 0
    const effectiveTheme =
      cookieTheme && (!allowed || cookieTheme === config.defaultTheme || config.compatibleThemes!.includes(cookieTheme))
        ? cookieTheme
        : config.defaultTheme
    setActiveTheme(effectiveTheme)
    applyThemeOverride(cookieTheme, config.defaultTheme, config.compatibleThemes)
    // 同步 data-theme 供遗留组件读取
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = effectiveTheme
    }
  }, [theme, config.defaultTheme, config.compatibleThemes])

  const value: StyleConfig = {
    ...config,
    // 暴露当前生效的配色（cookie 优先，否则模板出厂配色）
    defaultTheme: activeTheme || config.defaultTheme,
    compatibleThemes: config.compatibleThemes || null,
  }

  return <StyleContext.Provider value={value}>{children}</StyleContext.Provider>
}

export function useStyleConfig(): StyleConfig {
  return useContext(StyleContext)
}

// 便捷 hooks
export function useStyleLayouts(): any {
  return useContext(StyleContext).layouts
}

export function useStyleHeader(): any {
  return useContext(StyleContext).header
}

export function useStyleFooter(): any {
  return useContext(StyleContext).footer
}

// 全局墙纸（配色皮肤）列表：唯一来源是内置 5 套；若包声明 compatibleThemes 白名单则只返回兼容项
export function useStyleThemeOptions(): { key: string; labelZh: string; labelEn: string; color: string }[] {
  const compatible = useContext(StyleContext).compatibleThemes
  if (Array.isArray(compatible) && compatible.length > 0) {
    return BUILTIN_THEME_OPTIONS.filter((o) => compatible.includes(o.key))
  }
  return BUILTIN_THEME_OPTIONS
}

// 站点信息（后台 site_settings 的解析结果，只读）
export function useStyleSite(): Record<string, any> | null {
  return useContext(StyleContext).site || null
}

// Hero 配置（enabled/size/interval/autoplay/showCTA/ctaButtons）
export function useStyleHero(): any {
  return useContext(StyleContext).hero
}

// 行为特性（readingProgressBar / welcomeOverlay 等）
export function useStyleFeatures(): Record<string, any> | null {
  return useContext(StyleContext).features || null
}
