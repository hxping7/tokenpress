import { NextResponse } from 'next/server'
import { getSiteUrl } from '@/lib/site-url'

const SITE_URL = getSiteUrl()

// 强制请求时动态渲染：禁止在 next build 阶段静态预渲染
// （否则会被写死成构建环境的 URL，并在 CDN 上被长期缓存）
export const dynamic = 'force-dynamic'

export async function GET() {
  const robotsTxt = `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bytespider
Allow: /

User-agent: CCBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Cohere-AI
Allow: /

Disallow: /admin
Disallow: /auth
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml`

  return new NextResponse(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
