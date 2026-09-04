'use client'

import { FileCode2, FolderTree } from 'lucide-react'
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

/** 代码展示：暗色宽代码块 + 文件树侧栏，适合技术教程 / 源码解析 */
export function CodeShowcaseArticle({ article, section, sectionLabel, shareConfig }: Props) {
  const config = (article.templateConfig || {}) as { files?: string[] }
  const files = config.files || ['main.ts', 'utils.ts', 'README.md']

  return (
    <article className="min-h-screen pt-16">
      <ArticleViewTracker articleId={article.id} />
      <ArticleHeader article={article} section={section} sectionLabel={sectionLabel} shareConfig={shareConfig} />

      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-xl border border-t-border bg-t-bg-secondary p-3">
            <div className="flex items-center gap-2 text-sm text-t-text-secondary mb-3 px-1">
              <FolderTree size={14} /> 文件树
            </div>
            <ul className="space-y-1">
              {files.map((f: string) => (
                <li key={f} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-t-text-primary hover:bg-t-hover">
                  <FileCode2 size={14} className="text-t-accent-blue" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="min-w-0">
          {article.coverImage && (
            <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-t-border mb-8">
              <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="rounded-2xl border border-t-border bg-t-bg-secondary p-4 md:p-6">
            <MarkdownContent content={article.content} />
          </div>
        </main>
      </div>

      <ArticleFooter article={article} shareConfig={shareConfig} />
    </article>
  )
}
