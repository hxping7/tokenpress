'use client'

import { MarkdownContent } from '@/components/MarkdownContent'
import { TableOfContents } from '@/components/TableOfContents'
import { ArticleSidebar } from '@/components/ArticleSidebar'
import { ArticleShare } from '@/components/ArticleShare'
import { ArticleEngagement } from '@/components/ArticleEngagement'
import { ArticleViewTracker } from '@/components/ArticleViewTracker'
import { ArticleHeader, ArticleFooter } from '@/components/article/ArticleHeader'
import Image from 'next/image'
import type { ShareConfig } from '@/components/article/ArticleHeader'

interface Props {
  article: any
  section: string
  sectionLabel: string
  shareConfig: ShareConfig
  layout: {
    layout: string
    showTOC: boolean
    sidebar: string
    maxWidth: number
  }
}

/** 标准文章：保留原有 two-column / single / magazine 三种阅读版式 */
export function StandardArticle({ article, section, sectionLabel, shareConfig, layout }: Props) {
  const articleLayout: string = layout.layout || 'two-column'
  const showTOC = layout.showTOC !== false
  const sidebarType: string = layout.sidebar || 'related'
  const cfgMaxWidth = Number(layout.maxWidth) || 720
  const leftTOC = showTOC && articleLayout === 'two-column'
  const rightSidebar = sidebarType === 'related'
  const isSingle = articleLayout === 'single'
  const isMagazine = articleLayout === 'magazine'
  // 栅格列模板按**实际渲染**的列数生成：若 TOC/侧栏被关闭，仍用三列模板会让
  // 唯一的 main 子元素落到第一列（本该是 TOC 的 200px 窄列），正文被挤到最左边。
  const gridColsClass =
    leftTOC && rightSidebar
      ? 'lg:grid-cols-[200px_1fr_240px]'
      : leftTOC
        ? 'lg:grid-cols-[200px_1fr]'
        : 'lg:grid-cols-[1fr_240px]'
  // 无 TOC 也无侧栏（如 design 包的 immersive）→ 单列居中阅读
  const useSingleColumn = isSingle || (!leftTOC && !rightSidebar)

  return (
    <article className="min-h-screen pt-16">
      <ArticleViewTracker articleId={article.id} />
      <ArticleHeader article={article} section={section} sectionLabel={sectionLabel} shareConfig={shareConfig} />

      <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-12">
        {useSingleColumn ? (
          <div className="mx-auto" style={{ maxWidth: cfgMaxWidth }}>
            {article.coverImage && (
              <Image
                src={article.coverImage}
                alt={article.title}
                width={1200}
                height={630}
                className="w-full rounded-2xl border border-t-border mb-8"
                priority
              />
            )}
            <MarkdownContent content={article.content} />
          </div>
        ) : isMagazine ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
            <main className="min-w-0">
              {article.coverImage && (
                <Image
                  src={article.coverImage}
                  alt={article.title}
                  width={1400}
                  height={735}
                  className="w-full rounded-2xl border border-t-border mb-8"
                  priority
                />
              )}
              <div className="mx-auto" style={{ maxWidth: Math.max(cfgMaxWidth, 760) }}>
                <MarkdownContent content={article.content} />
              </div>
            </main>
            {rightSidebar && (
              <aside className="hidden lg:block">
                <div className="sticky top-20 space-y-4">
                  <ArticleSidebar articleId={article.id} articleTags={article.tags} sectionSlug={section} />
                  {shareConfig.enabled && shareConfig.positions.includes('float_right') && (
                    <ArticleShare title={article.title} summary={article.excerpt} platforms={shareConfig.platforms} aside />
                  )}
                  {shareConfig.likeEnabled && shareConfig.likePositions.includes('float_right') && (
                    <ArticleEngagement articleId={article.id} title={article.title} />
                  )}
                </div>
              </aside>
            )}
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${gridColsClass} gap-6`}>
            {leftTOC && (
              <aside className="hidden lg:block">
                <div className="sticky top-20">
                  <TableOfContents content={article.content} />
                </div>
              </aside>
            )}

            <main className="min-w-0">
              {article.coverImage && (
                <Image
                  src={article.coverImage}
                  alt={article.title}
                  width={1200}
                  height={630}
                  className="w-full rounded-2xl border border-t-border mb-8"
                  priority
                />
              )}
              <div className="max-w-[var(--reading-max-width)]">
                <MarkdownContent content={article.content} />
              </div>
            </main>

            {rightSidebar && (
              <aside className="hidden lg:block">
                <div className="sticky top-20 space-y-4">
                  <ArticleSidebar articleId={article.id} articleTags={article.tags} sectionSlug={section} />
                  {shareConfig.enabled && shareConfig.positions.includes('float_right') && (
                    <ArticleShare title={article.title} summary={article.excerpt} platforms={shareConfig.platforms} aside />
                  )}
                  {shareConfig.likeEnabled && shareConfig.likePositions.includes('float_right') && (
                    <ArticleEngagement articleId={article.id} title={article.title} />
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      <ArticleFooter article={article} shareConfig={shareConfig} />
    </article>
  )
}
