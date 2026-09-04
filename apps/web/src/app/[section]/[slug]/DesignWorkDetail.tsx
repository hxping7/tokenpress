'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { parseArticleMeta } from '@/lib/articleMeta'
import { useLocaleStore } from '@/stores'
import { designCategoryLabel } from '@/lib/designCategory'

export function DesignWorkDetail({ article }: { article: any }) {
  const { locale } = useLocaleStore()
  const meta = parseArticleMeta(article.meta)
  const slug = article.slug
  const sectionPath = article.section?.path || `/${article.section?.slug || ''}`

  // 浏览量 +1（作品集统计用 articles.view_count 列）
  useEffect(() => {
    if (!slug) return
    api.get(`/articles/${encodeURIComponent(slug)}?view=1`).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  return (
    <div className="min-h-screen bg-t-bg-primary">
      <div className="max-w-[900px] mx-auto px-4 pt-20 pb-20">
        {/* 面包屑 */}
        <div className="mb-4 text-sm text-t-text-muted">
          <Link href={sectionPath} className="hover:text-t-accent-blue transition-colors">← 作品集</Link>
        </div>

        {/* 标题 */}
        <h1 className="text-2xl md:text-3xl font-bold text-t-text-primary tracking-tight">{article.title}</h1>

        {/* 作者 + 元信息 */}
        <div className="mt-4 flex items-center gap-3">
          {meta.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.authorAvatar} alt={meta.authorName || ''} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-t-accent-blue/20 flex items-center justify-center text-sm text-t-accent-blue">
              {(meta.authorName || '?').charAt(0)}
            </span>
          )}
          <div className="text-sm">
            <div className="text-t-text-primary font-medium">{meta.authorName || '匿名'}</div>
            {article.publishedAt && (
              <div className="text-t-text-muted text-xs">
                {new Date(article.publishedAt).toLocaleDateString('zh-CN')} · {article.viewCount || 0} 次浏览
              </div>
            )}
          </div>
          {meta.category && (
            <span className="ml-auto px-2.5 py-1 text-xs rounded-md bg-t-accent-blue/10 text-t-accent-blue">
              {designCategoryLabel(meta.category, locale)}
            </span>
          )}
        </div>

        {/* 大图封面 */}
        {article.coverImage && (
          <div className="mt-6 rounded-xl overflow-hidden border border-t-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={article.coverImage} alt={article.title} className="w-full object-cover" />
          </div>
        )}

        {/* 正文 */}
        {article.content && (
          <article className="mt-6 text-t-text-secondary leading-7 whitespace-pre-wrap text-[15px]">
            {article.content}
          </article>
        )}

        {/* 图集 */}
        {meta.galleryImages && meta.galleryImages.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {meta.galleryImages.map((src: string, i: number) => (
              <div key={i} className="rounded-xl overflow-hidden border border-t-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${article.title} - ${i + 1}`} className="w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* 外链 */}
        {meta.externalUrl && (
          <div className="mt-8">
            <a
              href={meta.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-t-accent-blue text-black text-sm font-medium hover:opacity-90 transition-opacity"
            >
              查看线上作品 →
            </a>
          </div>
        )}

        {/* 标签 */}
        {meta.tags && meta.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {meta.tags.map((t: string) => (
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
