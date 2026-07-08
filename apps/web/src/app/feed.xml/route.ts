import { Feed } from 'feed'
import { getSiteUrl } from '@/lib/site-url'

const SITE_URL = getSiteUrl()

// 强制请求时动态渲染：依赖运行时后端数据，禁止在 next build 阶段静态预渲染
// （构建期 backend 不可达会导致预渲染出空 channel 并被长期缓存）
export const dynamic = 'force-dynamic'

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
    const res = await fetch(`${apiUrl}/api/v1/articles?limit=100&status=published`, {
      next: { tags: ['articles'], revalidate: 3600 },
    })

    if (res.ok) {
      const { data: articles } = await res.json()

      // 公开列表默认按 publishedAt 排序；这里自行按“最近更新时间”倒序重排，
      // 让被编辑过的旧文章重新出现在 feed 顶部，并截取最近 50 条以保持 feed 体积合理。
      const recent = (articles as any[])
        .map((a) => ({
          ...a,
          _ts: new Date(a.updatedAt || a.publishedAt || a.createdAt).getTime(),
        }))
        .sort((a, b) => b._ts - a._ts)
        .slice(0, 50)

      recent.forEach((article: any) => {
        const itemDate = new Date(article.updatedAt || article.publishedAt || article.createdAt)
        feed.addItem({
          title: article.title,
          id: `${SITE_URL}${article.section?.path || ''}/${article.slug}`,
          link: `${SITE_URL}${article.section?.path || ''}/${article.slug}`,
          description: article.excerpt || '',
          date: itemDate,
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
