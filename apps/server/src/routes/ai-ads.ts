import { Router } from 'express'
import { db } from '../db/index.js'
import { ads, adLogs } from '../db/schema.js'
import { eq, and, desc, sql, like, lte, gte } from 'drizzle-orm'
import { apiTokenAuth, requirePermission, type ApiAuthRequest } from '../middleware/apiToken.js'
import { scheduleReview } from '../lib/contentReview/index.js'
import { extractText } from '../lib/contentReview/extractText.js'

const router = Router()
router.use(apiTokenAuth)

// POST /api/v1/ai/ads — 创建广告
router.post('/', requirePermission('site:write'), async (req: ApiAuthRequest, res) => {
  try {
    const {
      position,
      title,
      code,
      priority = 0,
      startAt = null,
      endAt = null,
      targetSections = null,
      targetCategories = null,
      maxImpressions = null,
      maxClicks = null,
    } = req.body

    if (!position || !title || !code) {
      return res.status(400).json({ success: false, error: 'Required fields: position, title, code' })
    }

    const now = new Date().toISOString()
    const result = await db.insert(ads).values({
      position,
      title,
      code,
      status: 'pending_review',
      priority,
      startAt: startAt || null,
      endAt: endAt || null,
      targetSections: targetSections ? JSON.stringify(targetSections as string[]) : null,
      targetCategories: targetCategories ? JSON.stringify(targetCategories as number[]) : null,
      maxImpressions: maxImpressions || null,
      maxClicks: maxClicks || null,
      createdBy: req.apiToken!.userId,
      updatedAt: now,
    }).returning()

    const ad = result[0]

    // Schedule content review
    const reviewText = extractText('ad', { title, code })
    scheduleReview({
      targetType: 'ad',
      targetId: ad.id,
      text: reviewText,
    }).catch(err => console.error('Failed to schedule ad review:', err))

    res.status(201).json({
      success: true,
      data: {
        id: ad.id,
        position: ad.position,
        title: ad.title,
        status: ad.status,
        createdAt: ad.createdAt,
      },
      message: 'Ad created, pending content review',
    })
  } catch (err) {
    console.error('Create ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to create ad' })
  }
})

// GET /api/v1/ai/ads — 查询广告列表
router.get('/', requirePermission('site:write'), async (req: ApiAuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const position = req.query.position as string | undefined
    const status = req.query.status as string | undefined

    const conditions = []
    if (position) conditions.push(eq(ads.position, position))
    if (status) conditions.push(eq(ads.status, status as any))

    const rows = await db.select()
      .from(ads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ads.id))
      .limit(limit)
      .offset(offset)
      .all()

    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(ads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get()

    const data = rows.map(row => ({
      id: row.id,
      position: row.position,
      title: row.title,
      status: row.status,
      priority: row.priority,
      startAt: row.startAt,
      endAt: row.endAt,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.impressions > 0 ? ((row.clicks / row.impressions) * 100).toFixed(2) : '0.00',
      isActive: row.isActive === 1,
      createdAt: row.createdAt,
    }))

    res.json({
      success: true,
      data,
      pagination: { page, limit, total: totalResult?.count || 0 },
    })
  } catch (err) {
    console.error('List ads error:', err)
    res.status(500).json({ success: false, error: 'Failed to list ads' })
  }
})

// GET /api/v1/ai/ads/:id — 获取详情
router.get('/:id', requirePermission('site:write'), async (req: ApiAuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' })

    const ad = await db.select().from(ads).where(eq(ads.id, id)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    res.json({
      success: true,
      data: {
        ...ad,
        targetSections: ad.targetSections ? JSON.parse(ad.targetSections) : null,
        targetCategories: ad.targetCategories ? JSON.parse(ad.targetCategories) : null,
        isActive: ad.isActive === 1,
        ctr: ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : '0.00',
      },
    })
  } catch (err) {
    console.error('Get ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to get ad' })
  }
})

// PUT /api/v1/ai/ads/:id — 更新广告
router.put('/:id', requirePermission('site:write'), async (req: ApiAuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' })

    const ad = await db.select().from(ads).where(eq(ads.id, id)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    const {
      position,
      title,
      code,
      priority,
      startAt,
      endAt,
      targetSections,
      targetCategories,
      maxImpressions,
      maxClicks,
    } = req.body

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { updatedAt: now }
    if (position !== undefined) updates.position = position
    if (title !== undefined) updates.title = title
    if (code !== undefined) updates.code = code
    if (priority !== undefined) updates.priority = priority
    if (startAt !== undefined) updates.startAt = startAt || null
    if (endAt !== undefined) updates.endAt = endAt || null
    if (targetSections !== undefined) updates.targetSections = targetSections ? JSON.stringify(targetSections as string[]) : null
    if (targetCategories !== undefined) updates.targetCategories = targetCategories ? JSON.stringify(targetCategories as number[]) : null
    if (maxImpressions !== undefined) updates.maxImpressions = maxImpressions || null
    if (maxClicks !== undefined) updates.maxClicks = maxClicks || null

    // If code changed, re-trigger review
    if (code !== undefined && code !== ad.code) {
      updates.status = 'pending_review'
    }

    await db.update(ads).set(updates).where(eq(ads.id, id)).run()

    // Re-schedule review if code changed
    if (code !== undefined && code !== ad.code) {
      const reviewText = extractText('ad', { title: title || ad.title, code })
      scheduleReview({
        targetType: 'ad',
        targetId: id,
        text: reviewText,
      }).catch(err => console.error('Failed to schedule ad review:', err))
    }

    const updated = await db.select().from(ads).where(eq(ads.id, id)).get()
    res.json({
      success: true,
      data: {
        ...updated,
        targetSections: updated!.targetSections ? JSON.parse(updated!.targetSections) : null,
        targetCategories: updated!.targetCategories ? JSON.parse(updated!.targetCategories) : null,
        isActive: updated!.isActive === 1,
      },
    })
  } catch (err) {
    console.error('Update ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to update ad' })
  }
})

// DELETE /api/v1/ai/ads/:id — 软删除
router.delete('/:id', requirePermission('site:write'), async (req: ApiAuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' })

    const ad = await db.select().from(ads).where(eq(ads.id, id)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    const now = new Date().toISOString()
    await db.update(ads)
      .set({ isActive: 0, status: 'expired', updatedAt: now })
      .where(eq(ads.id, id))

    res.json({ success: true, message: 'Ad deleted (soft)' })
  } catch (err) {
    console.error('Delete ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete ad' })
  }
})

// POST /api/v1/ai/ads/:id/toggle — 启停切换
router.post('/:id/toggle', requirePermission('site:write'), async (req: ApiAuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' })

    const ad = await db.select().from(ads).where(eq(ads.id, id)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    const { isActive } = req.body
    const now = new Date().toISOString()

    if (isActive === false) {
      // 暂停
      await db.update(ads)
        .set({ isActive: 0, status: 'inactive', updatedAt: now })
        .where(eq(ads.id, id))
    } else {
      // 恢复（仅未过期可恢复）
      if (ad.endAt && ad.endAt <= now) {
        return res.status(400).json({ success: false, error: 'Cannot restore expired ad' })
      }
      const newStatus = (ad.startAt && ad.startAt > now) ? 'draft' : 'active'
      await db.update(ads)
        .set({ isActive: 1, status: newStatus, updatedAt: now })
        .where(eq(ads.id, id))
    }

    const updated = await db.select().from(ads).where(eq(ads.id, id)).get()
    res.json({
      success: true,
      data: {
        id: updated!.id,
        status: updated!.status,
        isActive: updated!.isActive === 1,
      },
    })
  } catch (err) {
    console.error('Toggle ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to toggle ad' })
  }
})

// GET /api/v1/ai/ads/stats — 统计数据
router.get('/stats/overview', requirePermission('site:write'), async (req: ApiAuthRequest, res) => {
  try {
    const adId = parseInt(req.query.adId as string)
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined

    if (!adId || isNaN(adId)) {
      return res.status(400).json({ success: false, error: 'adId is required' })
    }

    const ad = await db.select().from(ads).where(eq(ads.id, adId)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    const timeConditions = []
    if (from) timeConditions.push(gte(adLogs.createdAt, from))
    if (to) timeConditions.push(lte(adLogs.createdAt, to + 'T23:59:59'))

    const baseConditions = [eq(adLogs.adId, adId), ...timeConditions]

    const impressionCount = await db.select({ count: sql<number>`count(*)` })
      .from(adLogs)
      .where(and(eq(adLogs.adId, adId), eq(adLogs.type, 'impression'), ...timeConditions))
      .get()

    const clickCount = await db.select({ count: sql<number>`count(*)` })
      .from(adLogs)
      .where(and(eq(adLogs.adId, adId), eq(adLogs.type, 'click'), ...timeConditions))
      .get()

    // Daily breakdown
    const daily = await db.select({
      date: sql<string>`date(created_at)`,
      impressions: sql<number>`sum(case when type = 'impression' then 1 else 0 end)`,
      clicks: sql<number>`sum(case when type = 'click' then 1 else 0 end)`,
    })
      .from(adLogs)
      .where(and(...baseConditions))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`)
      .all()

    const impTotal = impressionCount?.count || 0
    const clickTotal = clickCount?.count || 0

    res.json({
      success: true,
      data: {
        adId,
        range: { from: from || null, to: to || null },
        impressions: impTotal,
        clicks: clickTotal,
        ctr: impTotal > 0 ? ((clickTotal / impTotal) * 100).toFixed(2) : '0.00',
        daily,
      },
    })
  } catch (err) {
    console.error('Ad stats error:', err)
    res.status(500).json({ success: false, error: 'Failed to get ad stats' })
  }
})

export default router
