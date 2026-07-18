'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/**
 * 链接墙模板：以卡片墙 / 药丸墙展示友链 / 外部链接。
 * 风格包 templates.link-wall 可配置 columns / gap / pill。
 */
export function LinkWall({ config }: { config?: Record<string, unknown> | null }) {
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const cfg = config || {}
  const cols = Math.min(Math.max(Number(cfg.columns) || 3, 1), 6)
  const gap = typeof cfg.gap === 'string' && cfg.gap ? (cfg.gap as string) : '1rem'
  const pill = cfg.pill === true

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

  // 药丸墙
  if (pill) {
    return (
      <div className="flex flex-wrap" style={{ gap }}>
        {links.map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-t-bg-primary border border-t-border hover:border-t-accent-blue/50 hover:shadow transition-all duration-200"
          >
            <span className="w-6 h-6 rounded-full bg-t-accent-blue/15 text-t-accent-blue flex items-center justify-center text-xs font-semibold shrink-0">
              {(l.name || '?').charAt(0)}
            </span>
            <span className="font-medium text-t-text-primary truncate group-hover:text-t-accent-blue transition-colors">{l.name}</span>
          </a>
        ))}
      </div>
    )
  }

  // 卡片墙
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
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
