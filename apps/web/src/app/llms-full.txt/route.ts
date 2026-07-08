import { NextResponse } from 'next/server'
import { getSiteUrl } from '@/lib/site-url'

const SITE_URL = getSiteUrl()
export const dynamic = 'force-dynamic'

const apiUrl = process.env.BACKEND_URL || 'http://backend:4001'

// 最多为最近 N 篇缺正文的文章补抓详情，控制响应体积
const MAX_DETAIL_FETCH = 100
const BATCH_SIZE = 5

function buildArticleUrl(article: any): string {
  return SITE_URL + (article?.section?.path || '') + '/' + article.slug
}

export async function GET() {
  try {
    const listRes = await fetch(`${apiUrl}/api/v1/articles?limit=500&status=published`, {
      cache: 'no-store',
    })
    if (!listRes.ok) throw new Error('articles list fetch failed')
    const listJson: any = await listRes.json()
    const articles: any[] = listJson.data || []

    // 列表已含 content 则直接使用；否则为最近最多 100 篇逐篇补抓详情（slug，失败回退 id）
    const needDetail = articles.filter((a) => !a.content).slice(0, MAX_DETAIL_FETCH)
    for (let i = 0; i < needDetail.length; i += BATCH_SIZE) {
      const batch = needDetail.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async (a) => {
          try {
            let res = await fetch(`${apiUrl}/api/v1/articles/${a.slug}`, { cache: 'no-store' })
            if (!res.ok && a.id != null) {
              res = await fetch(`${apiUrl}/api/v1/articles/${a.id}`, { cache: 'no-store' })
            }
            if (res.ok) {
              const json: any = await res.json()
              const detail = json.data || json
              a.content = detail.content || a.content || ''
            }
          } catch {
            // 单篇失败则跳过，保留已有摘要
          }
        })
      )
    }

    const header = [
      `# Token00 — 全站文章全集 (llms-full)`,
      `站点: ${SITE_URL}`,
      `生成时间: ${new Date().toISOString()}`,
      `文章数: ${articles.length}`,
      ``,
    ]

    const blocks = articles.map((a) => {
      const url = buildArticleUrl(a)
      const title = a.title || '(无标题)'
      const excerpt = a.excerpt || ''
      const body = a.content || excerpt || '(暂无正文)'
      return [`# ${title}`, `链接: ${url}`, excerpt ? `摘要: ${excerpt}` : '', ``, body, ``, `----`, ``].join('\n')
    })

    const content = [...header, ...blocks].join('\n')

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch {
    const fallback = `# Token00\n\nAI赋能综合内容平台，聚焦Token计划、AI编程、AI作品与技术博客。\n站点: ${SITE_URL}`
    return new NextResponse(fallback, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
