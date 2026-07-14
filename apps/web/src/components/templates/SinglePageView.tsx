'use client'

import { useState, useEffect } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { api } from '@/lib/api'

/**
 * 单页模板：渲染板块简介或指定文章正文。
 *
 * config.contentSource || config.articleId 为文章 ID 时，拉取该文章渲染；
 * 否则回退到板块 description。
 */
export function SinglePageView({
  description,
  config,
}: {
  description: string | null
  config?: Record<string, unknown> | null
}) {
  const articleId = config?.articleId ? Number(config.articleId) : undefined
  const [article, setArticle] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!articleId) {
      setArticle(null)
      return
    }
    let active = true
    setLoading(true)
    api
      .getArticle(articleId)
      .then((r) => {
        const articleData = r && typeof r === 'object' && 'data' in (r as any) ? (r as any).data : r
        if (active) setArticle(articleData || null)
      })
      .catch(() => { if (active) setArticle(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [articleId])

  // 绑定文章 → 渲染文章正文
  if (articleId) {
    if (loading) {
      return <div className="text-center py-20 text-t-text-secondary">加载文章…</div>
    }
    if (!article) {
      return <div className="text-center py-20 text-t-text-secondary">文章未找到（ID: {articleId}）</div>
    }
    return (
      <article className="bg-t-bg-primary border border-t-border rounded-xl p-6 sm:p-10 max-w-[var(--reading-max-width)] mx-auto">
        <h1
          className="text-heading-2 text-t-text-primary mb-4"
          dangerouslySetInnerHTML={{ __html: article.title }}
        />
        <MarkdownContent content={article.content || article.excerpt || ''} />
      </article>
    )
  }

  // 默认：板块描述
  if (!description) {
    return (
      <div className="text-center py-20 text-t-text-secondary">
        该板块暂无单页内容（请在板块「描述」中填写展示内容，或绑定一篇文章 ID）
      </div>
    )
  }
  return (
    <article className="bg-t-bg-primary border border-t-border rounded-xl p-6 sm:p-10 max-w-[var(--reading-max-width)] mx-auto">
      <MarkdownContent content={description} />
    </article>
  )
}
