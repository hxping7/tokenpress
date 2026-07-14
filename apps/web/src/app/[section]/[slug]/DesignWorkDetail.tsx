'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getDesignWork, type DesignWork } from '@/lib/api'

export function DesignWorkDetail({ params }: { params: Promise<{ section: string; slug: string }> }) {
  const resolved = useParams<{ section: string; slug: string }>()
  const section = resolved?.section
  const slug = resolved?.slug

  const [work, setWork] = useState<DesignWork | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    let active = true
    setLoading(true)
    getDesignWork(slug)
      .then((w) => { if (active) setWork(w) })
      .catch(() => { if (active) setWork(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-t-bg-primary flex items-center justify-center">
        <div className="text-t-text-muted text-sm">加载中…</div>
      </div>
    )
  }

  if (!work) {
    return (
      <div className="min-h-screen bg-t-bg-primary flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-t-text-primary mb-2">作品未找到</h1>
          <Link href={`/${section}`} className="text-t-accent-blue text-sm">返回作品集</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-t-bg-primary">
      <div className="max-w-[900px] mx-auto px-4 pt-20 pb-20">
        {/* 面包屑 */}
        <div className="mb-4 text-sm text-t-text-muted">
          <Link href={`/${section}`} className="hover:text-t-accent-blue transition-colors">← 作品集</Link>
        </div>

        {/* 标题 */}
        <h1 className="text-2xl md:text-3xl font-bold text-t-text-primary tracking-tight">{work.title}</h1>

        {/* 作者 + 元信息 */}
        <div className="mt-4 flex items-center gap-3">
          {work.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={work.authorAvatar} alt={work.authorName || ''} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-t-accent-blue/20 flex items-center justify-center text-sm text-t-accent-blue">
              {(work.authorName || '?').charAt(0)}
            </span>
          )}
          <div className="text-sm">
            <div className="text-t-text-primary font-medium">{work.authorName || '匿名'}</div>
            {work.publishedAt && (
              <div className="text-t-text-muted text-xs">
                {new Date(work.publishedAt).toLocaleDateString('zh-CN')} · {work.viewCount} 次浏览
              </div>
            )}
          </div>
          {work.category && (
            <span className="ml-auto px-2.5 py-1 text-xs rounded-md bg-t-accent-blue/10 text-t-accent-blue">
              {work.category}
            </span>
          )}
        </div>

        {/* 大图封面 */}
        {work.coverImage && (
          <div className="mt-6 rounded-xl overflow-hidden border border-t-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={work.coverImage} alt={work.title} className="w-full object-cover" />
          </div>
        )}

        {/* 正文 */}
        {work.content && (
          <article className="mt-6 text-t-text-secondary leading-7 whitespace-pre-wrap text-[15px]">
            {work.content}
          </article>
        )}

        {/* 图集 */}
        {work.galleryImages && work.galleryImages.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {work.galleryImages.map((src, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-t-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${work.title} - ${i + 1}`} className="w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* 外链 */}
        {work.externalUrl && (
          <div className="mt-8">
            <a
              href={work.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-t-accent-blue text-black text-sm font-medium hover:opacity-90 transition-opacity"
            >
              查看线上作品 →
            </a>
          </div>
        )}

        {/* 标签 */}
        {work.tags && work.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {work.tags.map((t) => (
              <span key={t} className="px-2.5 py-1 text-xs rounded-full bg-t-bg-secondary text-t-text-secondary border border-t-border">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
