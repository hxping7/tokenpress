import { NextResponse } from 'next/server'
import { getSiteUrl } from '@/lib/site-url'

const SITE_URL = getSiteUrl()

// 强制请求时动态渲染：依赖运行时后端数据，禁止在 next build 阶段静态预渲染
export const dynamic = 'force-dynamic'

export async function GET() {
  const apiUrl = process.env.BACKEND_URL || 'http://backend:4001'

  try {
    const [sectionsRes, articlesRes] = await Promise.all([
      fetch(`${apiUrl}/api/v1/sections`, { next: { revalidate: 3600 } }),
      fetch(`${apiUrl}/api/v1/articles?limit=15&status=published`, {
        next: { revalidate: 3600 },
      }),
    ])

    const sectionsData: any = sectionsRes.ok ? await sectionsRes.json() : { data: [] }
    const articlesData: any = articlesRes.ok ? await articlesRes.json() : { data: [] }

    const sections: any[] = sectionsData?.data ?? []
    const articles: any[] = (articlesData?.data ?? []).filter(
      (a: any) => a.status === 'published'
    )

    const sectionLines = sections
      .map((s: any) => `- [${s.name}](${SITE_URL}${s.path})`)
      .join('\n')

    const articleLines = articles
      .map((a: any) => {
        const base = a.section?.path ? `${a.section.path}` : ''
        return `- [${a.title}](${SITE_URL}${base}/${a.slug})`
      })
      .join('\n')

    const content = `# Token00

> Token00 —— 关于 Token 计划、AI 编程、AI 作品与博客的综合内容平台。

## Sections
${sectionLines}

## Recent Articles
${articleLines}
`

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch {
    // 降级：返回最小合法 llms.txt，避免抛出 500
    const fallback = `# Token00

> Token00 —— 关于 Token 计划、AI 编程、AI 作品与博客的综合内容平台。
`
    return new NextResponse(fallback, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }
}
