'use client'

import { useEffect } from 'react'
import { useLocaleStore, useThemeStore } from '@/stores'
import { api } from '@/lib/api'

export function LocaleInitializer() {
  const { initLocale } = useLocaleStore()
  const { initTheme } = useThemeStore()

  useEffect(() => {
    // Fetch site settings to get default locale and theme
    api.get('/site-settings').then((res) => {
      if (res?.data) {
        const settings = res.data
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
      }
    }).catch(console.error)
  }, [initLocale, initTheme])

  return null
}