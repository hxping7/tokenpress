import type { Metadata } from 'next'
import { ArticleDetailClient } from './ArticleDetailClient'
import { getSiteUrl } from '@/lib/site-url'
import { JsonLd } from '@/components/JsonLd'

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
  const { slug } = await params
  const article = await fetchArticle(slug)

  let jsonLd: Record<string, unknown> | null = null
  if (article) {
    const articleUrl = SITE_URL + (article.section?.path || '') + '/' + article.slug
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
      <ArticleDetailClient params={params} />
    </>
  )
}
