import type { Metadata } from 'next'
import { ArticleDetailClient } from './ArticleDetailClient'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://token00.com'

interface Props {
  params: Promise<{ section: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4001'

  try {
    const res = await fetch(`${backendUrl}/api/v1/articles/${slug}`, {
      next: { tags: ['articles', `article-${slug}`], revalidate: 3600 },
    })
    if (!res.ok) return { title: '文章未找到' }

    const { data: article } = await res.json()

    return {
      title: article.title,
      description: article.excerpt || extractExcerpt(article.content),
      openGraph: {
        title: article.title,
        description: article.excerpt || extractExcerpt(article.content),
        type: 'article',
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
        authors: [article.author?.displayName || 'Token00'],
        images: article.coverImage ? [{ url: article.coverImage, width: 1200, height: 630 }] : [],
        url: `${SITE_URL}/${section}/${slug}`,
      },
      twitter: {
        card: 'summary_large_image',
        title: article.title,
        description: article.excerpt || extractExcerpt(article.content),
        images: article.coverImage ? [article.coverImage] : [],
      },
    }
  } catch {
    return { title: '文章未找到' }
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

export default function ArticleDetailPage({ params }: Props) {
  return <ArticleDetailClient params={params} />
}
