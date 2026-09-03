'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useStyleFeatures } from '@/components/StyleProvider'

/**
 * 文章阅读进度条。
 * 仅当风格包 features.readingProgressBar === true 时启用，
 * 且只在文章详情页（两级路径：/板块/文章）出现；其余页面不渲染。
 */
export function ReadingProgress() {
  const features = useStyleFeatures()
  const enabled = features?.readingProgressBar === true
  const [progress, setProgress] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    if (!enabled || !pathname) return
    const seg = pathname.split('/').filter(Boolean)
    const isArticle =
      seg.length === 2 && !['admin', 'auth', 'search'].includes(seg[0])
    if (!isArticle) return

    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [enabled, pathname])

  if (!enabled) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[3px] z-[70] pointer-events-none"
      aria-hidden
    >
      <div
        className="h-full transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%`, background: 'var(--accent-blue, #2563eb)' }}
      />
    </div>
  )
}
