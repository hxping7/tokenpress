'use client'

import Image from 'next/image'
import { MarkdownContent } from '@/components/MarkdownContent'
import { ArticleViewTracker } from '@/components/ArticleViewTracker'
import { ArticleHeader, ArticleFooter } from '@/components/article/ArticleHeader'
import { buildVideoEmbed } from '@/lib/articleTemplateUtils'
import type { ShareConfig } from '@/components/article/ArticleHeader'

interface Props {
  article: any
  section: string
  sectionLabel: string
  shareConfig: ShareConfig
  layout: any
}

/** 视频文章：视频播放器置顶，正文在视频下方 */
export function VideoArticle({ article, section, sectionLabel, shareConfig }: Props) {
  const config = (article.templateConfig || {}) as { videoUrl?: string; source?: string; poster?: string }
  const embed = buildVideoEmbed(config.videoUrl || '', config.source)

  return (
    <article className="min-h-screen pt-[var(--header-actual-height)]">
      <ArticleViewTracker articleId={article.id} />
      <ArticleHeader article={article} section={section} sectionLabel={sectionLabel} shareConfig={shareConfig} />

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-t-border bg-black">
          {embed.kind === 'file' ? (
            <video src={embed.src} controls poster={config.poster} className="w-full h-full" />
          ) : embed.kind === 'iframe' ? (
            <iframe src={embed.src} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={article.title} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-t-text-secondary text-sm">
              未提供有效视频地址
            </div>
          )}
        </div>

        {article.content && (
          <div className="mt-10 max-w-[var(--reading-max-width)] mx-auto">
            <MarkdownContent content={article.content} />
          </div>
        )}
      </div>

      <ArticleFooter article={article} shareConfig={shareConfig} />
    </article>
  )
}
