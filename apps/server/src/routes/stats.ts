import { Router } from 'express'
import { db, client } from '../db/index.js'
import { apiLogs, apiTokens, articles, sections } from '../db/schema.js'
import { eq, sql, desc } from 'drizzle-orm'
import { authMiddleware, adminOrAbove, type AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware, adminOrAbove)

// GET /api/v1/stats — get API usage statistics
router.get('/', async (req: AuthRequest, res) => {
  try {
    // Total API calls
    const totalCalls = await db.select({ count: sql<number>`count(*)` })
      .from(apiLogs)
      .get()

    // Calls in last 24 hours
    const calls24h = await db.select({ count: sql<number>`count(*)` })
      .from(apiLogs)
      .where(sql`datetime(created_at) > datetime('now', '-24 hours')`)
      .get()

    // Calls in last 7 days
    const calls7d = await db.select({ count: sql<number>`count(*)` })
      .from(apiLogs)
      .where(sql`datetime(created_at) > datetime('now', '-7 days')`)
      .get()

    // Calls in last 30 days
    const calls30d = await db.select({ count: sql<number>`count(*)` })
      .from(apiLogs)
      .where(sql`datetime(created_at) > datetime('now', '-30 days')`)
      .get()

    // Average response time
    const avgResponseTime = await db.select({ avg: sql<number>`avg(response_time)` })
      .from(apiLogs)
      .get()

    // Error rate (4xx and 5xx)
    const errorCalls = await db.select({ count: sql<number>`count(*)` })
      .from(apiLogs)
      .where(sql`status_code >= 400`)
      .get()

    // Top endpoints
    const topEndpoints = await db.select({
      endpoint: apiLogs.endpoint,
      method: apiLogs.method,
      count: sql<number>`count(*)`,
    })
      .from(apiLogs)
      .groupBy(apiLogs.endpoint, apiLogs.method)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .all()

    // Recent logs
    const recentLogs = await db.select({
      id: apiLogs.id,
      endpoint: apiLogs.endpoint,
      method: apiLogs.method,
      statusCode: apiLogs.statusCode,
      responseTime: apiLogs.responseTime,
      ipAddress: apiLogs.ipAddress,
      contentUrl: apiLogs.contentUrl,
      createdAt: apiLogs.createdAt,
      tokenName: apiTokens.name,
    })
      .from(apiLogs)
      .leftJoin(apiTokens, eq(apiLogs.tokenId, apiTokens.id))
      .orderBy(desc(apiLogs.createdAt))
      .limit(20)
      .all()

    // Daily calls for the last 7 days
    const dailyCallsResult = await client.execute(
      `SELECT date(created_at) as date, count(*) as count
       FROM api_logs
       WHERE datetime(created_at) > datetime('now', '-7 days')
       GROUP BY date(created_at)
       ORDER BY date DESC`
    )

    // Articles by section
    const articlesBySection = await db.select({
      sectionId: articles.sectionId,
      sectionName: sections.name,
      sectionSlug: sections.slug,
      count: sql<number>`count(*)`,
    })
      .from(articles)
      .leftJoin(sections, eq(articles.sectionId, sections.id))
      .groupBy(articles.sectionId, sections.name, sections.slug)
      .all()

    res.json({
      success: true,
      data: {
        overview: {
          totalCalls: totalCalls?.count || 0,
          calls24h: calls24h?.count || 0,
          calls7d: calls7d?.count || 0,
          calls30d: calls30d?.count || 0,
          avgResponseTime: Math.round(avgResponseTime?.avg || 0),
          errorRate: totalCalls?.count ? Math.round((errorCalls?.count || 0) / totalCalls.count * 100) : 0,
        },
        topEndpoints,
        recentLogs,
        dailyCalls: dailyCallsResult.rows,
        articlesBySection,
      },
    })
  } catch (err) {
    console.error('Stats error:', err)
    res.status(500).json({ success: false, error: 'Failed to get statistics' })
  }
})

export default router
