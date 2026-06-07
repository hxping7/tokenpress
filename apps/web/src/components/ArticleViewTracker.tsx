'use client'

import { useEffect, useRef } from 'react'
import { api } from '@/lib/api'

interface ArticleViewTrackerProps {
  articleId: number
}

export function ArticleViewTracker({ articleId }: ArticleViewTrackerProps) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current || !articleId) return
    tracked.current = true

    api.trackArticleView(articleId).catch(() => {})
  }, [articleId])

  return null
}