import { create } from 'zustand'
import type { Locale, ThemeName } from './locale'
import { setCookie, getCookie } from '@/lib/cookies'

// Re-export types
export type { Locale, ThemeName } from './locale'

const COOKIE_NAMES = {
  locale: 'token00_locale',
  backendLocale: 'token00_backend_locale',
  theme: 'token00_theme',
}

// ===== Theme Store =====
interface ThemeState {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  initTheme: (defaultTheme: string) => void
}

export const useThemeStore = create<ThemeState>()(
  (set) => ({
    theme: 'night',
    setTheme: (theme: ThemeName) => {
      set({ theme })
      setCookie(COOKIE_NAMES.theme, theme)
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme)
      }
    },
    initTheme: (defaultTheme: string) => {
      const cookieTheme = getCookie(COOKIE_NAMES.theme) as ThemeName | null
      const theme = cookieTheme || (defaultTheme as ThemeName) || 'night'
      set({ theme })
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme)
      }
    },
  })
)

// ===== Locale Store =====
interface LocaleState {
  locale: Locale
  backendLocale: Locale
  setLocale: (locale: Locale) => void
  setBackendLocale: (backendLocale: Locale) => void
  initLocale: (defaultLocale: string, defaultBackendLocale: string) => void
}

export const useLocaleStore = create<LocaleState>()(
  (set) => ({
    locale: 'zh',
    backendLocale: 'zh',
    setLocale: (locale: Locale) => {
      set({ locale })
      setCookie(COOKIE_NAMES.locale, locale)
      if (typeof document !== 'undefined') {
        document.documentElement.lang = locale === 'en' ? 'en-US' : 'zh-CN'
      }
    },
    setBackendLocale: (backendLocale: Locale) => {
      set({ backendLocale })
      setCookie(COOKIE_NAMES.backendLocale, backendLocale)
    },
    initLocale: (defaultLocale: string, defaultBackendLocale: string) => {
      const cookieLocale = getCookie(COOKIE_NAMES.locale) as Locale | null
      const cookieBackendLocale = getCookie(COOKIE_NAMES.backendLocale) as Locale | null

      const locale = cookieLocale || (defaultLocale as Locale) || 'zh'
      const backendLocale = cookieBackendLocale || (defaultBackendLocale as Locale) || 'zh'

      set({ locale, backendLocale })

      if (typeof document !== 'undefined') {
        document.documentElement.lang = locale === 'en' ? 'en-US' : 'zh-CN'
      }
    },
  })
)