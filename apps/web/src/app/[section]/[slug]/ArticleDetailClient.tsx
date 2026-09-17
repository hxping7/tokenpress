'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { parseShareConfig } from '@/lib/share-config'
import { useStyleLayouts } from '@/components/StyleProvider'
import { resolveSectionLayout, type SectionLayoutOverride } from '@/lib/resolveLayout'
import { ArticleViewTracker } from '@/components/ArticleViewTracker'
import { ArticleTemplateRenderer } from '@/components/article/ArticleTemplateRenderer'
import { isArticleTemplateKey, type ArticleTemplateKey } from '@/lib/articleTemplates'
import { useSiteSettings } from '@/lib/useSiteSettings'

// 板块名唯一来源是 sections 表（名称属内容，不在代码里硬编码）。
// 此前这里有一张旧 IA 的硬编码表（token_plan/ai_coding/ai_works/blog，全是
// 已删除的板块），现 IA 的 works/craft/journal 都不在表内 → 面包屑 fallback
// 显示 URL 段（英文 slug，如 "craft"）。

interface Props {
  params: Promise<{ section: string; slug: string }>
  sectionLayouts?: SectionLayoutOverride
  /** 服务端注入的板块中文名（首选；避免首屏/水化前退化显示 URL 段） */
  sectionLabel?: string
}

export function ArticleDetailClient({ params, sectionLayouts, sectionLabel }: Props) {
  const resolvedParams = useParams()
  const slug = resolvedParams.slug as string
  const section = resolvedParams.section as string

  const globalLayouts = useStyleLayouts()
  const articleCfg = resolveSectionLayout(sectionLayouts ?? null, globalLayouts, 'article')
  const layout = {
    layout: String(articleCfg.layout || 'two-column'),
    showTOC: articleCfg.showTOC !== false,
    sidebar: String(articleCfg.sidebar || 'related'),
    maxWidth: Number(articleCfg.maxWidth) || 720,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => api.getArticle(slug),
    enabled: !!slug,
  })

  // 板块名（面包屑 / 返回链接）：优先用服务端注入的值（首屏即为中文），
  // 否则查 sections 列表（与 Header 共用 query key，命中缓存不额外请求），
  // 最后才回退 URL 段。
  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections'),
  })
  const sectionName: string =
    sectionLabel ||
    ((sectionsData?.data || []) as any[]).find(
      (s) => s.path === `/${section}` || s.slug === section,
    )?.name || section

  // 分享功能后台配置（公开接口，无需鉴权；与全站设置共用去重后的单一请求）
  const { data: shareRaw } = useSiteSettings()
  const shareConfig = parseShareConfig(shareRaw?.data?.share_config)

  if (isLoading) {
    return (
      <div className="min-h-screen pt-[var(--header-actual-height)] flex items-center justify-center">
        <div className="text-t-text-secondary animate-pulse">加载中...</div>
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="min-h-screen pt-[var(--header-actual-height)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-t-text-primary mb-2">文章未找到</h1>
          <Link href={`/${section}`} className="text-t-accent-blue hover:underline">
            返回{sectionName}
          </Link>
        </div>
      </div>
    )
  }

  const article = data.data
  // 文章模板：article.articleTemplate > 回退标准
  const template: ArticleTemplateKey = isArticleTemplateKey(article.articleTemplate)
    ? article.articleTemplate
    : 'standard'

  return (
    <ArticleTemplateRenderer
      template={template}
      article={article}
      section={section}
      sectionLabel={sectionName}
      shareConfig={shareConfig}
      layout={layout}
    />
  )
}
