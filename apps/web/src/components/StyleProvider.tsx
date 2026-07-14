'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getThemePalette } from '@/lib/themePalettes'
import { useThemeStore } from '@/stores'

export interface StyleConfig {
  activeStyle: string
  defaultTheme: string
  manifest: any
  layouts: any
  header: any
  footer: any
}

const DEFAULT_CONFIG: StyleConfig = {
  activeStyle: 'blog',
  defaultTheme: 'light',
  manifest: null,
  layouts: null,
  header: null,
  footer: null,
}

const StyleContext = createContext<StyleConfig>(DEFAULT_CONFIG)

const THEME_COOKIE = 'token00_theme'
const OVERRIDE_ID = 'style-theme-override'

function readThemeCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)token00_theme=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : null
}

function applyThemeOverride(theme: string | null, defaultTheme: string) {
  if (typeof document === 'undefined') return
  let el = document.getElementById(OVERRIDE_ID) as HTMLStyleElement | null
  const effective = theme || ''
  // 当未选配色或选中的就是模板出厂配色时，移除覆盖层（由模板包 theme.css 决定）
  if (!effective || effective === defaultTheme) {
    if (el) el.remove()
    return
  }
  const palette = getThemePalette(effective)
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
    setActiveTheme(cookieTheme)
    applyThemeOverride(cookieTheme, config.defaultTheme)
    // 同步 data-theme 供遗留组件读取
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = cookieTheme || config.defaultTheme
    }
  }, [theme, config.defaultTheme])

  const value: StyleConfig = {
    ...config,
    // 暴露当前生效的配色（cookie 优先，否则模板出厂配色）
    defaultTheme: activeTheme || config.defaultTheme,
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
