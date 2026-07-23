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

  const centered = cfg.centered !== false
  // 单页整体宽度（正文 + 下方最新列表统一受控）：
  //  default = 跟随站点内容区（=列表页宽度，后台开宽屏同步变宽）
  //  wide    = 1440px
  //  xwide   = 1760px
  //  full    = 占满视口（需 SectionPageClient 对 single-page 解除外层 max-w 约束）
  // 单页作为板块展示页，绝不应被文章阅读列宽(768px)压窄，故默认即占满内容区。
  const contentWidth: 'default' | 'wide' | 'xwide' | 'full' =
    (cfg.contentWidth as 'default' | 'wide' | 'xwide' | 'full') || 'default'
  // 用固定 px 值（非 rem）：站点把 html font-size 设为 62.5%(10px/rem)，
  // 导致 rem 单位被腰斩（75rem 实际≈750px）；且不依赖 var(--content-max-width)
  // （被风格包/后台「全局宽屏」覆盖，实测运行成 760px）。px 值独立可控、不受字体基准绑架。
  // 直接走内联 style（不依赖 Tailwind arbitrary 值，避免 JIT 漏生成对应 CSS 规则导致宽度失效）。
  const widthPx =
    contentWidth === 'wide' ? 1440 : contentWidth === 'xwide' ? 1760 : contentWidth === 'full' ? null : 1280
  // 完全由 contentWidth 四档控制宽度（default=1280/wide=1440/xwide=1760/full=占满）。
  // 不再读 cfg.maxWidth：风格包 single-page 出厂默认带 maxWidth:760（旧阅读列宽），
  // 若优先会覆盖用户在下拉里选的 wide/xwide，导致「宽度设置不生效」。后台 UI 也只暴露 4 档下拉。
  const outerStyle: { maxWidth: string } = widthPx
    ? { maxWidth: `${widthPx}px` }
    : { maxWidth: 'none' }
  const outerClass = `${centered ? 'mx-auto' : ''}`.trim()
  // 正文卡片本身不设宽度，由外层 outerStyle 统一控制
  const wrapClass = `bg-t-bg-primary border border-t-border rounded-xl p-6 sm:p-10`.trim()

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
      <div className={outerClass} style={outerStyle}>
        <div className="space-y-10">
          <article className={wrapClass}>
            <h1
              className="text-heading-2 text-t-text-primary mb-4"
              dangerouslySetInnerHTML={{ __html: article.title }}
            />
            <MarkdownContent content={article.content || article.excerpt || ''} />
          </article>
          {latestSection}
        </div>
      </div>
    )
  }

  // 默认：板块描述 + 最新文章
  return (
    <div className={outerClass} style={outerStyle}>
      <div className="space-y-10">
        {description ? (
          <article className={wrapClass}>
            <MarkdownContent content={description} />
          </article>
        ) : (
          <div className="text-center py-20 text-t-text-secondary">
            该板块暂无单页内容（请在板块「描述」中填写展示内容，或绑定一篇文章 ID）
          </div>
        )}
        {latestSection}
      </div>
    </div>
  )
}
