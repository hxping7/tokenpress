'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLayoutStore } from '@/stores/layout'
import { calculateReadingTime, formatReadingTime } from '@/lib/reading-time'
import { Clock } from 'lucide-react'

interface Article {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content?: string
  coverImage: string | null
  publishedAt: string
  section: {
    name: string
    path: string
  }
}

interface ArticleCardProps {
  article: Article
}

export function ArticleCard({ article }: ArticleCardProps) {
  const { view } = useLayoutStore()
  const readingTime = article.content
    ? calculateReadingTime(article.content)
    : article.excerpt
      ? calculateReadingTime(article.excerpt)
      : 1

  // 列表视图
  if (view === 'list') {
    return (
      <Link
        href={`${article.section.path}/${article.slug}`}
        className="group flex gap-4 p-4 rounded-xl border border-t-border bg-t-bg-primary hover:border-t-accent-blue/30 transition-all"
      >
        {/* 缩略图 */}
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
                {article.section.name[0] || '文'}
              </span>
            </div>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-t-accent-blue font-medium">
              {article.section.name}
            </span>
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
          {article.excerpt && (
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
      href={`${article.section.path}/${article.slug}`}
      className="group bg-t-bg-primary border border-t-border rounded-xl overflow-hidden hover:border-t-accent-blue/30 transition-all"
    >
      {/* 缩略图 */}
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
              {article.section.name[0] || '文'}
            </span>
          </div>
        )}
      </div>

      {/* 内容 */}
      <div className="p-4">
        {/* 板块标签 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-t-accent-blue font-medium">
            {article.section.name}
          </span>
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
        {article.excerpt && (
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
