import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleDetailClient } from './ArticleDetailClient'
import { DesignWorkDetail } from './DesignWorkDetail'
import { getSiteUrl } from '@/lib/site-url'
import { JsonLd } from '@/components/JsonLd'
import { isDesignWork } from '@/lib/articleMeta'

const SITE_URL = getSiteUrl()

interface Props {
  params: Promise<{ section: string; slug: string }>
}

async function fetchArticle(slug: string): Promise<any | null> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4001'
  try {
    const res = await fetch(`${backendUrl}/api/v1/articles/${slug}`, {
      next: { tags: ['articles', `article-${slug}`], revalidate: 3600 },
    })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch {
    return null
  }
}

/** 根据 section ID 获取板块信息（含 layouts 覆盖） */
async function fetchSection(id: number): Promise<Record<string, unknown> | null> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4001'
  try {
    const res = await fetch(`${backendUrl}/api/v1/sections/${id}`, {
      next: { tags: ['sections'], revalidate: 60 },
    })
    if (!res.ok) return null
    const { data } = await res.json()
    return data
  } catch {
    return null
  }
}

function buildCoverAbsolute(coverImage?: string): string | undefined {
  if (!coverImage) return undefined
  return coverImage.startsWith('http') ? coverImage : SITE_URL + coverImage
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params
  const article = await fetchArticle(slug)
  if (!article) return { title: '文章未找到' }

  const articleUrl = SITE_URL + (article.section?.path || '') + '/' + article.slug
  const coverAbsolute = buildCoverAbsolute(article.coverImage)

  return {
    title: article.title,
    description: article.excerpt || extractExcerpt(article.content),
    alternates: { canonical: articleUrl },
    openGraph: {
      title: article.title,
      description: article.excerpt || extractExcerpt(article.content),
      type: 'article',
      url: articleUrl,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt || article.publishedAt,
      authors: [article.author?.displayName || article.author?.username || 'Token00'],
      images: coverAbsolute ? [{ url: coverAbsolute, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt || extractExcerpt(article.content),
      images: coverAbsolute ? [coverAbsolute] : [],
    },
  }
}

function extractExcerpt(content: string, maxLen = 160): string {
  const text = content
    .replace(/#{1,6}\s/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\n+/g, ' ')
    .trim()
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

export default async function ArticleDetailPage({ params }: Props) {
  const { section, slug } = await params

  const article = await fetchArticle(slug)

  // 作品集类内容（meta.kind === 'design_work'）→ 渲染作品详情模板
  if (article && isDesignWork(article.meta)) {
    return <DesignWorkDetail article={article} />
  }

  // 文章不存在：走 Next 的 404（渲染 app/not-found.tsx 并返回 HTTP 404）。
  // 此前返回 200 的软 404，会被爬虫当成有效页面收录。
  if (!article) {
    notFound()
  }

  // 板块级布局覆盖 + 板块名。
  // 注意：文章详情 API **不返回 section 对象**（article.section 恒为 undefined），
  // 此前这里判断 `article?.section?.id` 才去取板块 → 该分支从未执行，板块级布局
  // 覆盖一直是失效的，JSON-LD 的文章 URL 也少了板块段。改用文章的 sectionId
  // （顶层字段，等价于 category.sectionId）反查。
  let sectionLayouts: Record<string, unknown> | null = null
  let sectionName: string | null = null
  let sectionPath: string | null = null
  const sectionId = article?.sectionId ?? article?.category?.sectionId
  if (sectionId) {
    const sectionData = await fetchSection(Number(sectionId))
    if (sectionData) {
      sectionLayouts = (sectionData.layouts as Record<string, unknown> | null) || null
      sectionName = (sectionData.name as string) || null
      sectionPath = (sectionData.path as string) || null
    }
  }
  // 兜底：用 URL 段拼板块路径
  const resolvedSectionPath = sectionPath || `/${section}`

  let jsonLd: Record<string, unknown> | null = null
  if (article) {
    const articleUrl = SITE_URL + resolvedSectionPath + '/' + article.slug
    const coverAbsolute = buildCoverAbsolute(article.coverImage)
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.excerpt || '',
      ...(coverAbsolute ? { image: coverAbsolute } : {}),
      datePublished: article.publishedAt,
      dateModified: article.updatedAt || article.publishedAt,
      author: {
        '@type': 'Person',
        name: article.author?.displayName || article.author?.username || 'Token00',
      },
      publisher: { '@type': 'Organization', name: 'Token00', url: SITE_URL },
      mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
      url: articleUrl,
    }
  }

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <ArticleDetailClient
        params={params}
        sectionLayouts={sectionLayouts}
        sectionLabel={sectionName || undefined}
      />
    </>
  )
}
