import { Router } from 'express'
import { db } from '../db/index.js'
import { articles, sections } from '../db/schema.js'
import { eq, desc, sql, and } from 'drizzle-orm'

const router = Router()

// GET /api/v1/carousel-articles — public, for hero carousel
router.get('/', async (req, res) => {
  console.log('[API] /carousel-articles endpoint called', req.query)
  try {
    const source = (req.query.source as string) || 'latest'
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit as string) || 5))

    // Only published articles with cover image
    const conditions = [
      eq(articles.status, 'published'),
      sql`${articles.coverImage} IS NOT NULL`,
    ]

    // Order by source
    const orderBy = source === 'hot'
      ? desc(articles.viewCount)
      : desc(articles.publishedAt)

    const rows = await db.select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      excerpt: articles.excerpt,
      coverImage: articles.coverImage,
      publishedAt: articles.publishedAt,
      viewCount: articles.viewCount,
      section: { id: sections.id, name: sections.name, slug: sections.slug, path: sections.path },
    })
      .from(articles)
      .leftJoin(sections, eq(articles.sectionId, sections.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .all()

    res.json({
      success: true,
      data: rows,
    })
  } catch (err) {
    console.error('Get carousel articles error:', err)
    res.status(500).json({ success: false, error: 'Failed to get carousel articles' })
  }
})

export default router
