'use client'

import { useEffect, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

// 收藏按钮：点击后引导用户将本文加入「浏览器收藏夹（书签）」。
// 现代浏览器（Chrome/Firefox/Safari/Edge）出于安全限制，不允许网页用 JS 强制把页面加入收藏夹，
// 因此标准做法是：旧版 IE/Edge 尝试 window.external.AddFavorite，其余浏览器提示用快捷键 Ctrl/⌘+D。
// localStorage 仅用于记录「用户已对本篇点过收藏」的视觉反馈，真实收藏由浏览器完成。

const FLAG_KEY = 'token00:bookmarked'

interface ArticleFavoriteButtonProps {
  articleId: number
  title: string
}

function stripHtml(input: string): string {
  if (typeof document === 'undefined') return input.replace(/<[^>]*>/g, '')
  const el = document.createElement('div')
  el.innerHTML = input
  return (el.textContent || input).trim()
}

export function ArticleFavoriteButton({ articleId, title }: ArticleFavoriteButtonProps) {
  const [bookmarked, setBookmarked] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(FLAG_KEY)
      const arr = raw ? JSON.parse(raw) : []
      setBookmarked(Array.isArray(arr) && arr.includes(articleId))
    } catch {
      // ignore
    }
  }, [articleId])

  const handleClick = () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const pageTitle = stripHtml(title) || document.title || 'Token00'

    // 旧版 IE / 老 Edge 提供 AddFavorite；现代浏览器无此 API
    const external = (window as unknown as { external?: { AddFavorite?: (u: string, t: string) => void } }).external
    if (external && typeof external.AddFavorite === 'function') {
      try {
        external.AddFavorite(url, pageTitle)
      } catch {
        // 某些环境下会抛错，忽略后走快捷键提示
      }
    } else {
      const isMac = /mac/i.test(navigator.userAgent)
      toast.success(isMac ? '按 ⌘ + D 将本文加入浏览器收藏夹' : '按 Ctrl + D 将本文加入浏览器收藏夹', {
        duration: 4000,
      })
    }

    // 记录已点击，作为视觉反馈
    try {
      const raw = localStorage.getItem(FLAG_KEY)
      const arr: number[] = raw ? JSON.parse(raw) : []
      if (!arr.includes(articleId)) {
        localStorage.setItem(FLAG_KEY, JSON.stringify([...arr, articleId]))
      }
    } catch {
      // ignore
    }
    setBookmarked(true)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!mounted}
      title="收藏到浏览器收藏夹"
      aria-pressed={bookmarked}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
        bookmarked
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          : 'bg-t-bg-tertiary text-t-text-secondary border border-t-border hover:border-amber-500/30 hover:text-amber-400'
      }`}
    >
      <Bookmark size={14} className={bookmarked ? 'fill-amber-400' : ''} />
      <span>{bookmarked ? '已收藏' : '收藏'}</span>
    </button>
  )
}
