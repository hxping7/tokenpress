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

/** 图文故事：大图 hero + 照片网格，正文作为图注，适合摄影 / 作品记录 */
export function PhotoEssayArticle({ article, section, sectionLabel, shareConfig }: Props) {
  const config = (article.templateConfig || {}) as { gallery?: string[]; layout?: string; cols?: number }
  const contentImgs = extractMarkdownImages(article.content || '')
  const gallery = (config.gallery && config.gallery.length ? config.gallery : contentImgs)
  const hero = article.coverImage || gallery[0] || contentImgs[0]
  const rest = (hero && gallery[0] === hero ? gallery.slice(1) : gallery)
  const cols = Math.min(Math.max(Number(config.cols) || 3, 2), 4)

  return (
    <article className="min-h-screen pt-16">
      <ArticleViewTracker articleId={article.id} />
      <ArticleHeader article={article} section={section} sectionLabel={sectionLabel} shareConfig={shareConfig} />

      {hero && (
        <div className="max-w-5xl mx-auto px-4 pt-10">
          <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-t-border">
            <Image src={hero} alt={article.title} fill className="object-cover" priority unoptimized sizes="(max-width:768px) 100vw, 1024px" />
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div
          className="max-w-5xl mx-auto px-4 py-8 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {rest.map((src: string, i: number) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-t-border">
              <Image src={src} alt={`${article.title} ${i + 1}`} fill className="object-cover hover:scale-105 transition-transform duration-300" unoptimized sizes="(max-width:768px) 50vw, 300px" />
            </div>
          ))}
        </div>
      )}

      {article.content && (
        <div className="max-w-2xl mx-auto px-4 pb-12">
          <MarkdownContent content={article.content} />
        </div>
      )}

      <ArticleFooter article={article} shareConfig={shareConfig} />
    </article>
  )
}
