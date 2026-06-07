'use client'

import { useEffect, useState, useRef } from 'react'

interface AdSlotProps {
  position: string
  section?: string
  category?: number
  articleId?: number
  className?: string
  fallback?: React.ReactNode
}

export function AdSlot({ position, section, category, articleId, className, fallback }: AdSlotProps) {
  const [adData, setAdData] = useState<{ code: string; impressionId: number } | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const params = new URLSearchParams({ position })
    if (section) params.set('section', section)
    if (category) params.set('category', String(category))
    if (articleId) params.set('articleId', String(articleId))

    fetch(`/api/v1/ads/serve?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setAdData(d.data)
        }
      })
      .catch(() => {})
  }, [position, section, category, articleId])

  useEffect(() => {
    if (!iframeRef.current || !adData) return

    const doc = iframeRef.current.contentDocument
    if (!doc) return

    doc.open()
    doc.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:0;overflow:hidden;}</style></head><body>${adData.code}</body></html>`)
    doc.close()

    // Track clicks within iframe
    const handleClick = () => {
      fetch('/api/v1/ads/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ impressionId: adData.impressionId }),
      }).catch(() => {})
    }

    doc.addEventListener('click', handleClick)
    return () => doc.removeEventListener('click', handleClick)
  }, [adData])

  if (!adData) return fallback || null

  return (
    <div
      className={`ad-slot ad-slot-${position} ${className || ''}`}
      data-ad-position={position}
    >
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        title={`Ad: ${position}`}
        style={{ border: 'none', width: '100%', minHeight: '90px', display: 'block' }}
        loading="lazy"
      />
    </div>
  )
}
