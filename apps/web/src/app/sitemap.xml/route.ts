import { NextResponse } from 'next/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export const dynamic = 'force-dynamic'

export async function GET() {
  let articles: { slug: string; section: { path: string }; updatedAt: string }[] = []
  try {
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:4001'
    const res = await fetch(`${apiUrl}/api/v1/articles?limit=1000&status=published`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      articles = data.data || []
    }
  } catch {
    // fallback
  }

  let sections: { path: string }[] = []
  try {
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:4001'
    const res = await fetch(`${apiUrl}/api/v1/sections`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      sections = data.data || []
    }
  } catch {
    // fallback
  }

  const now = new Date().toISOString()

  const urls = [
    `<url><loc>${SITE_URL}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...sections.map(
      (s) =>
        `<url><loc>${SITE_URL}${s.path}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
    ),
    ...articles.map(
      (a) =>
        `<url><loc>${SITE_URL}${a.section?.path || ''}/${a.slug}</loc><lastmod>${a.updatedAt || now}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`
    ),
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}