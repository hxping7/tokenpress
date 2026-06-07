import { Router } from 'express'
import { db } from '../db/index.js'
import { ads, contentReviews } from '../db/schema.js'
import { eq, and, desc, sql } from 'drizzle-orm'
import { authMiddleware, adminOrAbove, superAdminOnly, type AuthRequest } from '../middleware/auth.js'
import { scheduleReview } from '../lib/contentReview/index.js'
import { extractText } from '../lib/contentReview/extractText.js'
import { applyAdReview } from '../lib/contentReview/statusManager.js'

const router = Router()
router.use(authMiddleware, adminOrAbove)

// GET /api/v1/admin/ads — 所有广告列表（管理用）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const status = req.query.status as string | undefined
    const position = req.query.position as string | undefined

    const conditions = []
    if (status) conditions.push(eq(ads.status, status as any))
    if (position) conditions.push(eq(ads.position, position))

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
      ...row,
      targetSections: row.targetSections ? JSON.parse(row.targetSections) : null,
      targetCategories: row.targetCategories ? JSON.parse(row.targetCategories) : null,
      isActive: row.isActive === 1,
      ctr: row.impressions > 0 ? ((row.clicks / row.impressions) * 100).toFixed(2) : '0.00',
    }))

    res.json({
      success: true,
      data,
      pagination: { page, limit, total: totalResult?.count || 0 },
    })
  } catch (err) {
    console.error('Admin list ads error:', err)
    res.status(500).json({ success: false, error: 'Failed to list ads' })
  }
})

// GET /api/v1/admin/ads/pending — 待审核广告
router.get('/pending', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit

    const rows = await db.select({
      ad: ads,
      review: contentReviews,
    })
      .from(ads)
      .innerJoin(contentReviews, and(
        eq(contentReviews.targetType, 'ad'),
        eq(contentReviews.targetId, ads.id),
      ))
      .where(eq(contentReviews.finalVerdict, 'pending'))
      .orderBy(desc(contentReviews.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const data = rows.map(row => ({
      ...row.ad,
      targetSections: row.ad.targetSections ? JSON.parse(row.ad.targetSections) : null,
      targetCategories: row.ad.targetCategories ? JSON.parse(row.ad.targetCategories) : null,
      isActive: row.ad.isActive === 1,
      review: row.review,
    }))

    res.json({ success: true, data })
  } catch (err) {
    console.error('Admin pending ads error:', err)
    res.status(500).json({ success: false, error: 'Failed to list pending ads' })
  }
})

// POST /api/v1/admin/ads — 创建广告（管理员用）
router.post('/', async (req: AuthRequest, res) => {
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
      createdBy: req.user!.userId,
      updatedAt: now,
    }).returning()

    const ad = result[0]

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

// GET /api/v1/admin/ads/:id — 获取详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' })

    const ad = await db.select().from(ads).where(eq(ads.id, id)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    // Get latest review
    const review = await db.select().from(contentReviews)
      .where(and(eq(contentReviews.targetType, 'ad'), eq(contentReviews.targetId, id)))
      .orderBy(desc(contentReviews.version))
      .limit(1)
      .get()

    res.json({
      success: true,
      data: {
        ...ad,
        targetSections: ad.targetSections ? JSON.parse(ad.targetSections) : null,
        targetCategories: ad.targetCategories ? JSON.parse(ad.targetCategories) : null,
        isActive: ad.isActive === 1,
        review: review || null,
      },
    })
  } catch (err) {
    console.error('Admin get ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to get ad' })
  }
})

// POST /api/v1/admin/ads/:id/approve — 审核通过
router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' })

    const ad = await db.select().from(ads).where(eq(ads.id, id)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    if (ad.status !== 'pending_review') {
      return res.status(400).json({ success: false, error: `Ad is not pending review (current: ${ad.status})` })
    }

    const now = new Date().toISOString()

    const review = await db.select().from(contentReviews)
      .where(and(eq(contentReviews.targetType, 'ad'), eq(contentReviews.targetId, id)))
      .orderBy(desc(contentReviews.version))
      .limit(1)
      .get()

    if (review) {
      await db.update(contentReviews)
        .set({
          manualStatus: 'approved',
          manualReviewer: req.user!.userId,
          manualReviewedAt: now,
          finalVerdict: 'pass',
          updatedAt: now,
        })
        .where(eq(contentReviews.id, review.id))
    }

    await applyAdReview(id, 'pass')

    const updated = await db.select().from(ads).where(eq(ads.id, id)).get()
    res.json({ success: true, data: { id, status: updated!.status } })
  } catch (err) {
    console.error('Approve ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to approve ad' })
  }
})

// POST /api/v1/admin/ads/:id/reject — 审核拒绝
router.post('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' })

    const { note } = req.body
    const ad = await db.select().from(ads).where(eq(ads.id, id)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    if (ad.status !== 'pending_review') {
      return res.status(400).json({ success: false, error: `Ad is not pending review (current: ${ad.status})` })
    }

    const now = new Date().toISOString()

    const review = await db.select().from(contentReviews)
      .where(and(eq(contentReviews.targetType, 'ad'), eq(contentReviews.targetId, id)))
      .orderBy(desc(contentReviews.version))
      .limit(1)
      .get()

    if (review) {
      await db.update(contentReviews)
        .set({
          manualStatus: 'rejected',
          manualReviewer: req.user!.userId,
          manualReviewedAt: now,
          manualNote: note || null,
          finalVerdict: 'reject',
          updatedAt: now,
        })
        .where(eq(contentReviews.id, review.id))
    }

    await applyAdReview(id, 'reject')

    res.json({ success: true, data: { id, status: 'inactive' } })
  } catch (err) {
    console.error('Reject ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to reject ad' })
  }
})

// POST /api/v1/admin/ads/:id/toggle — 管理员启停
router.post('/:id/toggle', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' })

    const ad = await db.select().from(ads).where(eq(ads.id, id)).get()
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' })

    const { isActive } = req.body
    const now = new Date().toISOString()

    if (isActive === false) {
      await db.update(ads)
        .set({ isActive: 0, status: 'inactive', updatedAt: now })
        .where(eq(ads.id, id))
    } else {
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
      data: { id: updated!.id, status: updated!.status, isActive: updated!.isActive === 1 },
    })
  } catch (err) {
    console.error('Admin toggle ad error:', err)
    res.status(500).json({ success: false, error: 'Failed to toggle ad' })
  }
})

// POST /api/v1/internal/ads/tick — 手动触发调度（superadmin）
router.post('/tick', superAdminOnly, async (req: AuthRequest, res) => {
  try {
    const { adScheduler } = await import('../workers/adScheduler.js')
    await adScheduler.tick()
    res.json({
      success: true,
      data: { ranAt: new Date().toISOString() },
    })
  } catch (err) {
    console.error('Manual tick error:', err)
    res.status(500).json({ success: false, error: 'Failed to run tick' })
  }
})

export default router
