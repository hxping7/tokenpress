import { Feed } from 'feed'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function GET() {
  const apiUrl = process.env.BACKEND_URL || 'http://localhost:4001'

  const feed = new Feed({
    title: 'TokenPress',
    description: 'Token 力量无限放大 — AI赋能综合内容平台',
    id: SITE_URL,
    link: SITE_URL,
    language: 'zh',
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `© ${new Date().getFullYear()} Token00. All rights reserved.`,
    updated: new Date(),
  })

  try {
    const res = await fetch(`${apiUrl}/api/v1/articles?limit=20&status=published`, {
      next: { revalidate: 3600 },
    })

    if (res.ok) {
      const { data: articles } = await res.json()

      articles.forEach((article: any) => {
        feed.addItem({
          title: article.title,
          id: `${SITE_URL}${article.section?.path || ''}/${article.slug}`,
          link: `${SITE_URL}${article.section?.path || ''}/${article.slug}`,
          description: article.excerpt || '',
          date: new Date(article.publishedAt || article.createdAt),
          author: article.author
            ? [{ name: article.author.displayName || article.author.username }]
            : [],
        })
      })
    }
  } catch {
    // 降级：返回空 feed
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
