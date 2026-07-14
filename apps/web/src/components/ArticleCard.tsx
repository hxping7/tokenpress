'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLayoutStore } from '@/stores/layout'
import { calculateReadingTime, formatReadingTime } from '@/lib/reading-time'
import { Clock, Pin } from 'lucide-react'

interface Article {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content?: string
  coverImage: string | null
  publishedAt: string
  pinnedScope?: 'global' | 'section' | null | string
  section?: {
    name: string
    path: string
  }
}

interface ArticleCardProps {
  article: Article
  showThumbnail?: boolean
  showExcerpt?: boolean
  /** 强制视图类型，覆盖全局 useLayoutStore（用于风格包配置） */
  forceView?: 'grid' | 'list'
}

export function ArticleCard({ article, showThumbnail = true, showExcerpt = true, forceView }: ArticleCardProps) {
  const { view } = useLayoutStore()
  const effectiveView = forceView || view
  const readingTime = article.content
    ? calculateReadingTime(article.content)
    : article.excerpt
      ? calculateReadingTime(article.excerpt)
      : 1

  // 置顶角标：全局置顶 / 板块内置顶
  const pinBadge = article.pinnedScope ? (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
        article.pinnedScope === 'global'
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-sky-500/20 text-sky-400'
      }`}
      title={article.pinnedScope === 'global' ? '全局置顶' : '板块置顶'}
    >
      <Pin size={10} />
      {article.pinnedScope === 'global' ? '置顶' : '板块置顶'}
    </span>
  ) : null

  // 文章详情路径：section 缺失时降级到 /blog 前缀，避免出现 undefined 路径
  const articleHref = `${article.section?.path ?? '/blog'}/${article.slug}`

  // 列表视图
  if (effectiveView === 'list') {
    return (
      <Link
        href={articleHref}
        className="group flex gap-4 p-4 rounded-xl border border-t-border bg-t-bg-primary hover:border-t-accent-blue/30 transition-all"
      >
        {/* 缩略图 */}
        {showThumbnail && (
          <div className="flex-shrink-0 w-32 h-20 md:w-48 md:h-28 rounded-lg bg-t-bg-secondary overflow-hidden">
            {article.coverImage ? (
              <Image
                src={article.coverImage}
                alt={article.title}
                width={192}
                height={108}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-2xl text-t-text-muted">
                  {article.section?.name?.[0] || '文'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 内容 */}
          <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-t-accent-blue font-medium">
              {article.section?.name}
            </span>
            {pinBadge}
            <span className="text-t-text-muted">·</span>
            <span className="text-xs text-t-text-secondary flex items-center gap-1">
              <Clock size={12} />
              {formatReadingTime(readingTime)}
            </span>
          </div>
          <h3
            className="font-medium text-t-text-primary group-hover:text-t-accent-blue transition-colors line-clamp-1 mb-1"
            dangerouslySetInnerHTML={{ __html: article.title }}
          />
          {showExcerpt && article.excerpt && (
            <p className="text-sm text-t-text-secondary line-clamp-1">
              {article.excerpt}
            </p>
          )}
        </div>
      </Link>
    )
  }

  // 网格视图（默认）
  return (
    <Link
      href={articleHref}
      className="group bg-t-bg-primary border border-t-border rounded-xl overflow-hidden hover:border-t-accent-blue/30 transition-all"
    >
      {/* 缩略图 */}
      {showThumbnail && (
        <div className="aspect-video bg-t-bg-secondary overflow-hidden">
          {article.coverImage ? (
            <Image
              src={article.coverImage}
              alt={article.title}
              width={400}
              height={225}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl text-t-text-muted">
                {article.section?.name?.[0] || '文'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 内容 */}
      <div className="p-4">
        {/* 板块标签 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-t-accent-blue font-medium">
            {article.section?.name}
          </span>
          {pinBadge}
          {article.publishedAt && (
            <>
              <span className="text-t-text-muted">·</span>
              <span className="text-xs text-t-text-secondary">
                {new Date(article.publishedAt).toLocaleDateString('zh-CN')}
              </span>
            </>
          )}
        </div>

        {/* 标题 */}
        <h3
          className="font-medium text-t-text-primary group-hover:text-t-accent-blue transition-colors line-clamp-2 mb-2"
          dangerouslySetInnerHTML={{ __html: article.title }}
        />

        {/* 摘要 */}
        {showExcerpt && article.excerpt && (
          <p className="text-sm text-t-text-secondary line-clamp-2 mb-3">
            {article.excerpt}
          </p>
        )}

        {/* 阅读时间 */}
        <div className="flex items-center gap-1 text-xs text-t-text-muted">
          <Clock size={12} />
          {formatReadingTime(readingTime)}
        </div>
      </div>
    </Link>
  )
}
