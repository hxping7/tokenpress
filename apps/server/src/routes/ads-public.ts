import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { db } from '../db/index.js'
import { ads, adLogs, contentReviews } from '../db/schema.js'
import { eq, and, sql } from 'drizzle-orm'
import { getRateLimitMax } from '../lib/rateLimitConfig.js'

const router = Router()

// Rate limit for ad serving（阈值可由后台「限流保护」配置）
const adServeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => getRateLimitMax('rate_limit_ads'),
  message: { success: false, error: 'Too many requests' },
})

// GET /api/v1/ads/serve — 获取广告代码
router.get('/serve', adServeLimiter, async (req, res) => {
  try {
    const position = req.query.position as string
    const section = req.query.section as string | undefined
    const category = req.query.category as string | undefined

    if (!position) {
      return res.status(400).json({ success: false, error: 'position is required' })
    }

    const now = new Date().toISOString()

    // 查询符合条件的广告：active + 审核通过 + 时间范围 + 定向匹配
    const result = await db.all(sql`
      SELECT a.* FROM ads a
      INNER JOIN content_reviews cr ON cr.target_type = 'ad' AND cr.target_id = a.id AND cr.final_verdict = 'pass'
      WHERE a.position = ${position}
        AND a.status = 'active'
        AND a.is_active = 1
        AND (a.end_at IS NULL OR a.end_at > ${now})
        AND (a.start_at IS NULL OR a.start_at <= ${now})
        AND (a.max_impressions IS NULL OR a.impressions < a.max_impressions)
        AND (a.max_clicks IS NULL OR a.clicks < a.max_clicks)
      ORDER BY a.priority DESC, a.id ASC
      LIMIT 1
    `)

    const rows = result as any[]
    if (!rows || rows.length === 0) {
      return res.json({ success: true, data: null })
    }

    const ad = rows[0]

    // 定向过滤
    if (ad.target_sections) {
      const targetSections: string[] = JSON.parse(ad.target_sections)
      if (section && targetSections.length > 0 && !targetSections.includes(section)) {
        return res.json({ success: true, data: null })
      }
    }
    if (ad.target_categories && category) {
      const targetCategories: number[] = JSON.parse(ad.target_categories)
      if (targetCategories.length > 0 && !targetCategories.includes(parseInt(category))) {
        return res.json({ success: true, data: null })
      }
    }

    // 增加曝光计数
    await db.update(ads)
      .set({ impressions: sql`${ads.impressions} + 1` })
      .where(eq(ads.id, ad.id))

    // 记录曝光日志
    const forwardedFor = req.headers['x-forwarded-for']
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]
    const clientIp = forwardedIp?.trim() || req.ip

    await db.insert(adLogs).values({
      adId: ad.id,
      articleId: req.query.articleId ? parseInt(req.query.articleId as string) : null,
      ipAddress: clientIp || 'unknown',
      userAgent: req.headers['user-agent'] || null,
      referer: req.headers.referer || null,
      type: 'impression',
    })

    res.json({
      success: true,
      data: {
        code: ad.code,
        impressionId: ad.id,
      },
    })
  } catch (err) {
    console.error('Serve ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to serve ad' })
  }
})

// POST /api/v1/ads/click — 上报点击
router.post('/click', adServeLimiter, async (req, res) => {
  try {
    const { impressionId } = req.body
    if (!impressionId) {
      return res.status(400).json({ success: false, error: 'impressionId is required' })
    }

    const ad = await db.select().from(ads).where(eq(ads.id, impressionId)).get()
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' })
    }

    // 增加点击计数
    await db.update(ads)
      .set({ clicks: sql`${ads.clicks} + 1` })
      .where(eq(ads.id, impressionId))

    // 记录点击日志
    const forwardedFor = req.headers['x-forwarded-for']
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]
    const clientIp = forwardedIp?.trim() || req.ip

    await db.insert(adLogs).values({
      adId: impressionId,
      ipAddress: clientIp || 'unknown',
      userAgent: req.headers['user-agent'] || null,
      referer: req.headers.referer || null,
      type: 'click',
    })

    res.json({ success: true })
  } catch (err) {
    console.error('Click ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to record click' })
  }
})

export default router
