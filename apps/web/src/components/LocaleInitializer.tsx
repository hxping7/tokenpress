'use client'

import { useEffect } from 'react'
import { useLocaleStore, useThemeStore } from '@/stores'
import { useSiteSettings } from '@/lib/useSiteSettings'

export function LocaleInitializer() {
  const { initLocale } = useLocaleStore()
  const { initTheme } = useThemeStore()
  const { data } = useSiteSettings()

  useEffect(() => {
    const settings = data?.data
    if (!settings) return

    // Use cookie if exists, otherwise use server default
    initLocale(
      settings.frontend_locale || 'zh',
      settings.backend_locale || 'zh'
    )
    initTheme(settings.default_theme || 'night')

    // Update document title and meta description from settings
    const siteName = settings.site_name
    const siteDesc = settings.site_description
    if (siteName && typeof document !== 'undefined') {
      document.title = siteDesc ? `${siteName} — ${siteDesc}` : siteName
    }
    if (siteDesc && typeof document !== 'undefined') {
      const metaDesc = document.querySelector('meta[name="description"]')
      if (metaDesc) {
        metaDesc.setAttribute('content', siteDesc)
      }
    }
  }, [data, initLocale, initTheme])

  return null
}