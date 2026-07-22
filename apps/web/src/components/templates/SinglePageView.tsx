'use client'

import { useState, useEffect } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { ArticleCard } from '@/components/ArticleCard'
import { api } from '@/lib/api'

/**
 * 单页模板：渲染板块简介或指定文章正文，并在下方列出板块最新文章。
 *
 * - config.articleId 为文章 ID 时，主内容渲染该文章；
 * - 否则主内容回退到板块 description；
 * - config.showLatest !== false 时（默认开启），主内容下方展示板块最新文章列表。
 *   - showLatestCount：最新文章数量（默认 6）
 *   - showLatestTitle：区块标题（默认「最新文章」）
 */
export function SinglePageView({
  description,
  config,
  articles,
}: {
  description: string | null
  config?: Record<string, unknown> | null
  articles?: any[]
}) {
  const cfg = config || {}
  const explicitArticleId = cfg.articleId ? Number(cfg.articleId) : undefined
  // 文章 ID 为空时，自动选取板块最新文章作为单页正文
  const autoLatestId =
    !explicitArticleId && articles && articles.length ? articles[0].id : undefined
  const targetId = explicitArticleId ?? autoLatestId

  const maxWidth = cfg.maxWidth ? Number(cfg.maxWidth) : null
  const centered = cfg.centered !== false
  const wrapStyle = maxWidth ? { maxWidth: `${maxWidth}px` } : undefined
  const wrapClass = `bg-t-bg-primary border border-t-border rounded-xl p-6 sm:p-10 max-w-[var(--reading-max-width)] ${centered ? 'mx-auto' : ''}`

  const showLatest = cfg.showLatest !== false
  const latestCount = Number(cfg.showLatestCount) || 6
  const latestTitle =
    typeof cfg.showLatestTitle === 'string' && cfg.showLatestTitle
      ? cfg.showLatestTitle
      : '最新文章'

  const [article, setArticle] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!targetId) {
      setArticle(null)
      return
    }
    let active = true
    setLoading(true)
    api
      .getArticle(targetId)
      .then((r) => {
        const articleData = r && typeof r === 'object' && 'data' in (r as any) ? (r as any).data : r
        if (active) setArticle(articleData || null)
      })
      .catch(() => { if (active) setArticle(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [targetId])

  // 最新文章列表：排除当前已作为主内容展示的那篇（含自动选取的最新文章）
  const latestArticles = (articles || [])
    .filter((a) => a.id !== targetId)
    .slice(0, latestCount)

  const latestSection =
    showLatest && latestArticles.length > 0 ? (
      <section>
        <h2 className="text-xl font-semibold text-t-text-primary mb-4">{latestTitle}</h2>
        <div className="flex flex-col gap-4">
          {latestArticles.map((a: any) => (
            <ArticleCard key={a.id} article={a} forceView="list" />
          ))}
        </div>
      </section>
    ) : null

  // 绑定文章 / 自动最新文章 → 渲染文章正文
  if (targetId) {
    if (loading) {
      return <div className="text-center py-20 text-t-text-secondary">加载文章…</div>
    }
    if (!article) {
      return <div className="text-center py-20 text-t-text-secondary">文章未找到（ID: {targetId}）</div>
    }
    return (
      <div className="space-y-10">
        <article className={wrapClass} style={wrapStyle}>
          <h1
            className="text-heading-2 text-t-text-primary mb-4"
            dangerouslySetInnerHTML={{ __html: article.title }}
          />
          <MarkdownContent content={article.content || article.excerpt || ''} />
        </article>
        {latestSection}
      </div>
    )
  }

  // 默认：板块描述 + 最新文章
  return (
    <div className="space-y-10">
      {description ? (
        <article className={wrapClass} style={wrapStyle}>
          <MarkdownContent content={description} />
        </article>
      ) : (
        <div className="text-center py-20 text-t-text-secondary">
          该板块暂无单页内容（请在板块「描述」中填写展示内容，或绑定一篇文章 ID）
        </div>
      )}
      {latestSection}
    </div>
  )
}
