'use client'

import Image from 'next/image'
import { MarkdownContent } from '@/components/MarkdownContent'
import { ArticleViewTracker } from '@/components/ArticleViewTracker'
import { ArticleHeader, ArticleFooter } from '@/components/article/ArticleHeader'
import type { ShareConfig } from '@/components/article/ArticleHeader'

interface Props {
  article: any
  section: string
  sectionLabel: string
  shareConfig: ShareConfig
  layout: any
}

/** 沉浸长文：全宽大图 hero + 大字排版 + 滚动渐显，适合深度长文 */
export function StoryArticle({ article, section, sectionLabel, shareConfig }: Props) {
  return (
    <article className="min-h-screen pt-[var(--header-actual-height)]">
      <ArticleViewTracker articleId={article.id} />
      <ArticleHeader article={article} section={section} sectionLabel={sectionLabel} shareConfig={shareConfig} />

      {article.coverImage && (
        <div className="relative w-full h-[56vh] md:h-[64vh]">
          <Image src={article.coverImage} alt={article.title} fill className="object-cover" priority unoptimized sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-t-bg-primary via-transparent to-transparent" />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-12 -mt-20 relative">
        <div className="rounded-2xl bg-t-bg-primary px-6 md:px-10 py-10 border border-t-border shadow-sm">
          <MarkdownContent content={article.content} />
        </div>
      </div>

      <ArticleFooter article={article} shareConfig={shareConfig} />
    </article>
  )
}
