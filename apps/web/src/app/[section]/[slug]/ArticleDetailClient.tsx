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

const sectionLabels: Record<string, string> = {
  token_plan: 'Token 计划',
  ai_coding: 'AI 编程',
  ai_works: 'AI 作品',
  blog: '博客',
}

interface Props {
  params: Promise<{ section: string; slug: string }>
  sectionLayouts?: SectionLayoutOverride
}

export function ArticleDetailClient({ params, sectionLayouts }: Props) {
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

  // 分享功能后台配置（公开接口，无需鉴权）
  const { data: shareRaw } = useQuery({
    queryKey: ['share-config'],
    queryFn: () =>
      api.get<{ success: boolean; data: Record<string, string> }>(
        '/site-settings/keys/share_config'
      ),
  })
  const shareConfig = parseShareConfig(shareRaw?.data?.share_config)

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-t-text-secondary animate-pulse">加载中...</div>
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-t-text-primary mb-2">文章未找到</h1>
          <Link href={`/${section}`} className="text-t-accent-blue hover:underline">
            返回{sectionLabels[section] || '列表'}
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
      sectionLabel={sectionLabels[section] || section}
      shareConfig={shareConfig}
      layout={layout}
    />
  )
}
