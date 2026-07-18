import { Router } from 'express'
import { db } from '../db/index.js'
import { contentReviews, articles, media, friendLinks, ads } from '../db/schema.js'
import { eq, and, desc, sql, count } from 'drizzle-orm'
import { type AuthRequest } from '../middleware/auth.js'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { applyReviewResult } from '../lib/contentReview/statusManager.js'
import { reviewContent } from '../lib/contentReview/index.js'
import logger from '../utils/logger.js'

const router = Router()
router.use(apiTokenOrAdmin('site:write'))

// GET /api/v1/admin/reviews — list reviews with filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const targetType = req.query.targetType as string | undefined
    const verdict = req.query.verdict as string | undefined
    const manualStatus = req.query.manualStatus as string | undefined

    const conditions = []
    if (targetType) conditions.push(eq(contentReviews.targetType, targetType))
    if (verdict) conditions.push(eq(contentReviews.finalVerdict, verdict))
    if (manualStatus) conditions.push(eq(contentReviews.manualStatus, manualStatus))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db.select()
      .from(contentReviews)
      .where(where)
      .orderBy(desc(contentReviews.createdAt))
      .limit(limit)
      .offset(offset)

    // Enrich with target info (article title, media filename, etc.)
    const enrichedRows = await Promise.all(
      rows.map(async (row) => {
        let targetInfo: { title?: string; filename?: string; name?: string; url?: string } = {}
        
        if (row.targetType === 'article' && row.targetId) {
          const article = await db.select({ title: articles.title, slug: articles.slug })
            .from(articles)
            .where(eq(articles.id, row.targetId))
            .get()
          if (article) {
            targetInfo = { title: article.title, url: `/article/${article.slug}` }
          }
        } else if (row.targetType === 'media' && row.targetId) {
          const m = await db.select({ filename: media.originalName, url: media.url })
            .from(media)
            .where(eq(media.id, row.targetId))
            .get()
          if (m) {
            targetInfo = { title: m.filename, url: m.url }
          }
        } else if (row.targetType === 'friend_link' && row.targetId) {
          const fl = await db.select({ name: friendLinks.name, url: friendLinks.url })
            .from(friendLinks)
            .where(eq(friendLinks.id, row.targetId))
            .get()
          if (fl) {
            targetInfo = { title: fl.name, url: fl.url }
          }
        } else if (row.targetType === 'ad' && row.targetId) {
          const ad = await db.select({ title: ads.title }).from(ads).where(eq(ads.id, row.targetId)).get()
          if (ad) {
            targetInfo = { title: ad.title }
          }
        }

        return { ...row, targetInfo }
      })
    )

    const totalResult = await db.select({ count: count() })
      .from(contentReviews)
      .where(where)

    res.json({
      success: true,
      data: enrichedRows,
      pagination: {
        page,
        limit,
        total: totalResult[0]?.count || 0,
      },
    })
  } catch (err) {
    logger.error({ err }, 'Failed to list reviews')
    res.status(500).json({ success: false, error: 'Failed to list reviews' })
  }
})

// GET /api/v1/admin/reviews/pending — pending review queue
router.get('/pending', async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))

    const rows = await db.select()
      .from(contentReviews)
      .where(eq(contentReviews.finalVerdict, 'pending'))
      .orderBy(desc(contentReviews.createdAt))
      .limit(limit)

    res.json({ success: true, data: rows })
  } catch (err) {
    logger.error({ err }, 'Failed to get pending reviews')
    res.status(500).json({ success: false, error: 'Failed to get pending reviews' })
  }
})

// GET /api/v1/admin/reviews/stats — review statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const [pending, approvedToday, rejectedToday, total] = await Promise.all([
      db.select({ count: count() }).from(contentReviews).where(eq(contentReviews.finalVerdict, 'pending')),
      db.select({ count: count() }).from(contentReviews).where(and(
        eq(contentReviews.finalVerdict, 'pass'),
        sql`(date(${contentReviews.manualReviewedAt}) = ${today} OR date(${contentReviews.updatedAt}) = ${today})`,
      )),
      db.select({ count: count() }).from(contentReviews).where(and(
        eq(contentReviews.finalVerdict, 'reject'),
        sql`(date(${contentReviews.manualReviewedAt}) = ${today} OR date(${contentReviews.updatedAt}) = ${today})`,
      )),
      db.select({ count: count() }).from(contentReviews),
    ])

    res.json({
      success: true,
      data: {
        pending: pending[0]?.count || 0,
        approvedToday: approvedToday[0]?.count || 0,
        rejectedToday: rejectedToday[0]?.count || 0,
        total: total[0]?.count || 0,
      },
    })
  } catch (err) {
    logger.error({ err }, 'Failed to get review stats')
    res.status(500).json({ success: false, error: 'Failed to get review stats' })
  }
})

// POST /api/v1/admin/reviews/:id/approve — approve review
router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const reviewId = parseInt(req.params.id as string)
    const note = req.body.note as string | undefined

    const review = await db.select().from(contentReviews).where(eq(contentReviews.id, reviewId)).limit(1)
    if (review.length === 0) {
      return res.status(404).json({ success: false, error: 'Review not found' })
    }

    if (review[0].finalVerdict !== 'pending') {
      return res.status(400).json({ success: false, error: 'Review already resolved' })
    }

    await db.update(contentReviews).set({
      manualStatus: 'approved',
      manualReviewer: req.user!.userId,
      manualReviewedAt: new Date().toISOString(),
      manualNote: note || null,
      finalVerdict: 'pass',
      updatedAt: new Date().toISOString(),
    }).where(eq(contentReviews.id, reviewId))

    await applyReviewResult(review[0].targetType as any, review[0].targetId, 'pass')

    res.json({ success: true, message: 'Review approved' })
  } catch (err) {
    logger.error({ err }, 'Failed to approve review')
    res.status(500).json({ success: false, error: 'Failed to approve review' })
  }
})

// POST /api/v1/admin/reviews/:id/reject — reject review
router.post('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const reviewId = parseInt(req.params.id as string)
    const note = req.body.note as string | undefined

    const review = await db.select().from(contentReviews).where(eq(contentReviews.id, reviewId)).limit(1)
    if (review.length === 0) {
      return res.status(404).json({ success: false, error: 'Review not found' })
    }

    if (review[0].finalVerdict !== 'pending') {
      return res.status(400).json({ success: false, error: 'Review already resolved' })
    }

    await db.update(contentReviews).set({
      manualStatus: 'rejected',
      manualReviewer: req.user!.userId,
      manualReviewedAt: new Date().toISOString(),
      manualNote: note || null,
      finalVerdict: 'reject',
      updatedAt: new Date().toISOString(),
    }).where(eq(contentReviews.id, reviewId))

    await applyReviewResult(review[0].targetType as any, review[0].targetId, 'reject')

    res.json({ success: true, message: 'Review rejected' })
  } catch (err) {
    logger.error({ err }, 'Failed to reject review')
    res.status(500).json({ success: false, error: 'Failed to reject review' })
  }
})

// POST /api/v1/admin/reviews/:id/retry — retry a failed review
router.post('/:id/retry', async (req: AuthRequest, res) => {
  try {
    const reviewId = parseInt(req.params.id as string)

    const review = await db.select().from(contentReviews).where(eq(contentReviews.id, reviewId)).limit(1)
    if (review.length === 0) {
      return res.status(404).json({ success: false, error: 'Review not found' })
    }

    // Reset to pending and re-process
    await db.update(contentReviews).set({
      finalVerdict: 'pending',
      localScanStatus: 'pending',
      cloudTextStatus: 'pending',
      cloudImageStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }).where(eq(contentReviews.id, reviewId))

    // Trigger async review
    reviewContent(reviewId).catch(err => {
      logger.error({ err, reviewId }, 'Retry review failed')
    })

    res.json({ success: true, message: 'Review retry scheduled' })
  } catch (err) {
    logger.error({ err }, 'Failed to retry review')
    res.status(500).json({ success: false, error: 'Failed to retry review' })
  }
})

export default router
