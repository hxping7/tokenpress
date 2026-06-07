import { Router } from 'express'
import { db } from '../db/index.js'
import { articleLikes, articleViews, articles } from '../db/schema.js'
import { eq, and, sql, desc } from 'drizzle-orm'

const router = Router()

router.post('/:articleId/like', async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId)
    if (isNaN(articleId)) {
      return res.status(400).json({ success: false, error: 'Invalid article ID' })
    }

    const article = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).get()
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown'

    const existing = await db.select()
      .from(articleLikes)
      .where(and(eq(articleLikes.articleId, articleId), eq(articleLikes.ipAddress, ip)))
      .get()

    if (existing) {
      await db.delete(articleLikes)
        .where(and(eq(articleLikes.articleId, articleId), eq(articleLikes.ipAddress, ip)))
        .run()

      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(articleLikes)
        .where(eq(articleLikes.articleId, articleId))
        .get()

      return res.json({ success: true, data: { liked: false, likeCount: countResult?.count || 0 } })
    }

    await db.insert(articleLikes).values({ articleId, ipAddress: ip }).run()

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(articleLikes)
      .where(eq(articleLikes.articleId, articleId))
      .get()

    res.json({ success: true, data: { liked: true, likeCount: countResult?.count || 0 } })
  } catch (err) {
    console.error('Toggle like error:', err)
    res.status(500).json({ success: false, error: 'Failed to toggle like' })
  }
})

router.get('/:articleId/like', async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId)
    if (isNaN(articleId)) {
      return res.status(400).json({ success: false, error: 'Invalid article ID' })
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown'

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(articleLikes)
      .where(eq(articleLikes.articleId, articleId))
      .get()

    const existing = await db.select()
      .from(articleLikes)
      .where(and(eq(articleLikes.articleId, articleId), eq(articleLikes.ipAddress, ip)))
      .get()

    res.json({ success: true, data: { liked: !!existing, likeCount: countResult?.count || 0 } })
  } catch (err) {
    console.error('Get like status error:', err)
    res.status(500).json({ success: false, error: 'Failed to get like status' })
  }
})

router.post('/:articleId/view', async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId)
    if (isNaN(articleId)) {
      return res.status(400).json({ success: false, error: 'Invalid article ID' })
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const userAgent = req.get('user-agent') || null
    const referer = req.get('referer') || null

    const recent = await db.select({ id: articleViews.id })
      .from(articleViews)
      .where(and(
        eq(articleViews.articleId, articleId),
        eq(articleViews.ipAddress, ip),
        sql`created_at > datetime('now', '-1 hour')`
      ))
      .get()

    if (!recent) {
      await db.insert(articleViews).values({
        articleId,
        ipAddress: ip,
        userAgent,
        referer,
      }).run()
    }

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(articleViews)
      .where(eq(articleViews.articleId, articleId))
      .get()

    res.json({ success: true, data: { viewCount: countResult?.count || 0 } })
  } catch (err) {
    console.error('Track view error:', err)
    res.status(500).json({ success: false, error: 'Failed to track view' })
  }
})

router.get('/:articleId/view', async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId)
    if (isNaN(articleId)) {
      return res.status(400).json({ success: false, error: 'Invalid article ID' })
    }

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(articleViews)
      .where(eq(articleViews.articleId, articleId))
      .get()

    const uniqueResult = await db.select({ count: sql<number>`count(DISTINCT ip_address)` })
      .from(articleViews)
      .where(eq(articleViews.articleId, articleId))
      .get()

    res.json({ success: true, data: { viewCount: countResult?.count || 0, uniqueViewCount: uniqueResult?.count || 0 } })
  } catch (err) {
    console.error('Get view count error:', err)
    res.status(500).json({ success: false, error: 'Failed to get view count' })
  }
})

router.get('/stats/overview', async (req, res) => {
  try {
    const totalViews = await db.select({ count: sql<number>`count(*)` }).from(articleViews).get()
    const uniqueVisitors = await db.select({ count: sql<number>`count(DISTINCT ip_address)` }).from(articleViews).get()
    const totalLikes = await db.select({ count: sql<number>`count(*)` }).from(articleLikes).get()

    const topArticles = await db.select({
      articleId: articleViews.articleId,
      title: articles.title,
      slug: articles.slug,
      views: sql<number>`count(*)`,
    })
      .from(articleViews)
      .innerJoin(articles, eq(articleViews.articleId, articles.id))
      .groupBy(articleViews.articleId, articles.title, articles.slug)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .all()

    const dailyViews = await db.select({
      date: sql<string>`date(created_at)`,
      views: sql<number>`count(*)`,
      uniqueVisitors: sql<number>`count(DISTINCT ip_address)`,
    })
      .from(articleViews)
      .groupBy(sql`date(created_at)`)
      .orderBy(desc(sql`date(created_at)`))
      .limit(30)
      .all()

    const topReferers = await db.select({
      referer: articleViews.referer,
      count: sql<number>`count(*)`,
    })
      .from(articleViews)
      .where(sql`referer IS NOT NULL`)
      .groupBy(articleViews.referer)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .all()

    const topUserAgents = await db.select({
      userAgent: articleViews.userAgent,
      count: sql<number>`count(*)`,
    })
      .from(articleViews)
      .where(sql`user_agent IS NOT NULL`)
      .groupBy(articleViews.userAgent)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .all()

    res.json({
      success: true,
      data: {
        totalViews: totalViews?.count || 0,
        uniqueVisitors: uniqueVisitors?.count || 0,
        totalLikes: totalLikes?.count || 0,
        topArticles,
        dailyViews,
        topReferers,
        topUserAgents,
      },
    })
  } catch (err) {
    console.error('Get view stats error:', err)
    res.status(500).json({ success: false, error: 'Failed to get view stats' })
  }
})

export default router