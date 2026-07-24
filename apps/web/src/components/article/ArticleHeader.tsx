'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Calendar, User, Tag, Clock } from 'lucide-react'
import { ArticleEngagement } from '@/components/ArticleEngagement'
import { ArticleShare } from '@/components/ArticleShare'
import { parseShareConfig } from '@/lib/share-config'
import { calculateReadingTime, formatReadingTime } from '@/lib/reading-time'

export type ShareConfig = ReturnType<typeof parseShareConfig>

interface Props {
  article: any
  section: string
  sectionLabel: string
  shareConfig: ReturnType<typeof parseShareConfig>
}

/** 文章详情页共享头部：面包屑 + 标题 + 元信息 + 标签 + 顶部点赞/收藏/分享 */
export function ArticleHeader({ article, section, sectionLabel, shareConfig }: Props) {
  const readingTime = article.content ? calculateReadingTime(article.content) : 1

  return (
    <header className="relative py-16 px-4 border-b border-t-border">
      <div className="relative max-w-4xl mx-auto">
        <Link
          href={`/${section}`}
          className="inline-flex items-center gap-1.5 text-sm text-t-text-secondary hover:text-t-text-primary transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          {sectionLabel}
        </Link>

        <h1
          className="text-heading-1 text-t-text-primary mb-4"
          dangerouslySetInnerHTML={{ __html: article.title }}
        />

        <div className="flex flex-wrap items-center gap-4 text-sm text-t-text-secondary">
          {article.author && (
            <span className="inline-flex items-center gap-1.5">
              <User size={14} />
              {article.author.displayName || article.author.username}
            </span>
          )}
          {article.publishedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              {new Date(article.publishedAt).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} />
            {formatReadingTime(readingTime)}
          </span>
          {article.category && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-t-bg-tertiary rounded-full text-xs">
              {article.category.name}
            </span>
          )}
        </div>

        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Tag size={12} className="text-t-text-muted" />
            {article.tags.map((tag: string) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-t-bg-tertiary text-t-text-secondary rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {shareConfig.likeEnabled && shareConfig.likePositions.includes('article_top') && (
          <ArticleEngagement articleId={article.id} title={article.title} />
        )}

        {shareConfig.enabled && shareConfig.positions.includes('article_top') && (
          <ArticleShare
            title={article.title}
            summary={article.excerpt}
            platforms={shareConfig.platforms}
          />
        )}
      </div>
    </header>
  )
}

/** 文章详情页共享底部：底部点赞/收藏/分享 */
export function ArticleFooter({
  article,
  shareConfig,
}: {
  article: any
  shareConfig: ReturnType<typeof parseShareConfig>
}) {
  return (
    <>
      {shareConfig.enabled && shareConfig.positions.includes('article_bottom') && (
        <div className="max-w-[var(--content-max-width)] mx-auto px-4 pb-6 flex justify-center">
          <ArticleShare title={article.title} summary={article.excerpt} platforms={shareConfig.platforms} />
        </div>
      )}

      {shareConfig.likeEnabled && shareConfig.likePositions.includes('article_bottom') && (
        <div className="max-w-[var(--content-max-width)] mx-auto px-4 pb-12 flex justify-center">
          <ArticleEngagement articleId={article.id} title={article.title} />
        </div>
      )}
    </>
  )
}
