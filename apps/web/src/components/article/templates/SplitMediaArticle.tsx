'use client'

import Image from 'next/image'
import { MarkdownContent } from '@/components/MarkdownContent'
import { ArticleViewTracker } from '@/components/ArticleViewTracker'
import { ArticleHeader, ArticleFooter } from '@/components/article/ArticleHeader'
import { extractMarkdownImages } from '@/lib/articleTemplateUtils'
import type { ShareConfig } from '@/components/article/ArticleHeader'

interface Props {
  article: any
  section: string
  sectionLabel: string
  shareConfig: ShareConfig
  layout: any
}

/** 图文并排：左正文 + 右侧 sticky 媒体列，图文交替阅读 */
export function SplitMediaArticle({ article, section, sectionLabel, shareConfig }: Props) {
  const config = (article.templateConfig || {}) as { media?: string[] }
  const contentImgs = extractMarkdownImages(article.content || '')
  const media = (config.media && config.media.length ? config.media : contentImgs)
  const sticky = [article.coverImage, ...media].filter(Boolean).slice(0, 4) as string[]

  return (
    <article className="min-h-screen pt-[var(--header-actual-height)]">
      <ArticleViewTracker articleId={article.id} />
      <ArticleHeader article={article} section={section} sectionLabel={sectionLabel} shareConfig={shareConfig} />

      <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
        <main className="min-w-0">
          <MarkdownContent content={article.content} />
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-[var(--header-actual-height)] space-y-3">
            {sticky.map((src: string, i: number) => (
              <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-t-border">
                <Image src={src} alt={`${article.title} ${i + 1}`} fill className="object-cover" unoptimized sizes="360px" />
              </div>
            ))}
            {sticky.length === 0 && article.coverImage && (
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-t-border">
                <Image src={article.coverImage} alt={article.title} fill className="object-cover" unoptimized sizes="360px" />
              </div>
            )}
          </div>
        </aside>
      </div>

      <ArticleFooter article={article} shareConfig={shareConfig} />
    </article>
  )
}
