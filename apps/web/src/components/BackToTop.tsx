'use client'

import { ArrowUp } from 'lucide-react'
import { useLocaleStore } from '@/stores'

export function BackToTop() {
  const { locale } = useLocaleStore()

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-end">
        <button
          onClick={scrollToTop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-t-text-muted hover:text-t-text-primary hover:bg-t-hover transition-colors text-sm"
          aria-label="回到顶部"
        >
          <ArrowUp size={16} />
          {locale === 'en' ? 'Back to Top' : '回到顶部'}
        </button>
      </div>
    </div>
  )
}
