'use client'

import Script from 'next/script'
import { useSiteSettings } from '@/lib/useSiteSettings'

export function AnalyticsLoader() {
  const { data } = useSiteSettings()

  const analyticsCode = data?.data?.analytics_code || ''

  if (!analyticsCode) {
    return null
  }

  // 提取script标签，使用Next.js Script组件
  const scriptMatch = analyticsCode.match(/<script[^>]*>([\s\S]*?)<\/script>/gi)

  if (scriptMatch && scriptMatch.length > 0) {
    const externalScripts: { src: string; strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' }[] = []
    const inlineScripts: string[] = []

    scriptMatch.forEach((scriptTag: string) => {
      const srcMatch = scriptTag.match(/src=["']([^"']+)["']/)
      const deferMatch = scriptTag.match(/defer/)
      const asyncMatch = scriptTag.match(/async/)

      if (srcMatch) {
        const src = srcMatch[1]
        let strategy: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' = 'afterInteractive'
        if (deferMatch) strategy = 'afterInteractive'
        if (asyncMatch) strategy = 'afterInteractive'
        externalScripts.push({ src, strategy })
      } else {
        const contentMatch = scriptTag.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
        if (contentMatch && contentMatch[1].trim()) {
          inlineScripts.push(contentMatch[1].trim())
        }
      }
    })

    return (
      <>
        {externalScripts.map((script, idx) => (
          <Script
            key={idx}
            src={script.src}
            strategy={script.strategy}
            defer={script.strategy === 'afterInteractive'}
          />
        ))}
        {inlineScripts.map((content, idx) => (
          <Script
            key={`inline-${idx}`}
            id={`analytics-inline-${idx}`}
            strategy="afterInteractive"
          >
            {content}
          </Script>
        ))}
      </>
    )
  }

  // 非 script 标签内容不渲染，避免 XSS 风险
  return null
}