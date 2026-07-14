'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/**
 * 链接墙模板：以卡片墙展示友链 / 外部链接。
 */
export function LinkWall() {
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api
      .getFriendLinks()
      .then((d) => { if (active) setLinks(d || []) })
      .catch(() => { if (active) setLinks([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return <div className="text-center py-20 text-t-text-secondary">加载中…</div>
  }
  if (links.length === 0) {
    return <div className="text-center py-20 text-t-text-secondary">暂无友链</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {links.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block p-5 rounded-xl bg-t-bg-primary border border-t-border hover:border-t-accent-blue/50 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-t-accent-blue/15 text-t-accent-blue flex items-center justify-center font-semibold shrink-0">
              {(l.name || '?').charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-t-text-primary truncate group-hover:text-t-accent-blue transition-colors">{l.name}</p>
              <p className="text-xs text-t-text-muted truncate">{l.url}</p>
            </div>
          </div>
          {l.description && (
            <p className="mt-3 text-sm text-t-text-secondary line-clamp-2 leading-relaxed">{l.description}</p>
          )}
        </a>
      ))}
    </div>
  )
}
