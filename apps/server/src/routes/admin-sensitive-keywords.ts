import { Router } from 'express'
import { db } from '../db/index.js'
import { sensitiveKeywords } from '../db/schema.js'
import { eq, desc, count } from 'drizzle-orm'
import { type AuthRequest } from '../middleware/auth.js'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import logger from '../utils/logger.js'

const router = Router()
router.use(apiTokenOrAdmin('keywords:write'))

// GET /api/v1/admin/sensitive-keywords — list keywords
router.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
    const offset = (page - 1) * limit
    const category = req.query.category as string | undefined
    const scope = req.query.scope as string | undefined

    const conditions = []
    if (category) conditions.push(eq(sensitiveKeywords.category, category))
    if (scope) conditions.push(eq(sensitiveKeywords.scope, scope))

    const { and } = await import('drizzle-orm')
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db.select()
      .from(sensitiveKeywords)
      .where(where)
      .orderBy(desc(sensitiveKeywords.createdAt))
      .limit(limit)
      .offset(offset)

    const totalResult = await db.select({ count: count() })
      .from(sensitiveKeywords)
      .where(where)

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: totalResult[0]?.count || 0,
      },
    })
  } catch (err) {
    logger.error({ err }, 'Failed to list sensitive keywords')
    res.status(500).json({ success: false, error: 'Failed to list sensitive keywords' })
  }
})

// POST /api/v1/admin/sensitive-keywords — add keyword
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { keyword, category, severity, action, scope } = req.body

    if (!keyword) {
      return res.status(400).json({ success: false, error: 'Keyword is required' })
    }

    const result = await db.insert(sensitiveKeywords).values({
      keyword,
      category: category || 'general',
      severity: severity || 'medium',
      action: action || 'review',
      scope: scope || 'all',
      createdBy: req.user!.userId,
    }).returning()

    res.status(201).json({ success: true, data: result[0] })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: 'Keyword already exists' })
    }
    logger.error({ err }, 'Failed to add sensitive keyword')
    res.status(500).json({ success: false, error: 'Failed to add sensitive keyword' })
  }
})

// PUT /api/v1/admin/sensitive-keywords/:id — update keyword
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)
    const { keyword, category, severity, action, scope, enabled } = req.body

    const existing = await db.select().from(sensitiveKeywords).where(eq(sensitiveKeywords.id, id)).limit(1)
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Keyword not found' })
    }

    const updates: Record<string, any> = {}
    if (keyword !== undefined) updates.keyword = keyword
    if (category !== undefined) updates.category = category
    if (severity !== undefined) updates.severity = severity
    if (action !== undefined) updates.action = action
    if (scope !== undefined) updates.scope = scope
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0

    await db.update(sensitiveKeywords).set(updates).where(eq(sensitiveKeywords.id, id))

    const updated = await db.select().from(sensitiveKeywords).where(eq(sensitiveKeywords.id, id)).limit(1)
    res.json({ success: true, data: updated[0] })
  } catch (err) {
    logger.error({ err }, 'Failed to update sensitive keyword')
    res.status(500).json({ success: false, error: 'Failed to update sensitive keyword' })
  }
})

// DELETE /api/v1/admin/sensitive-keywords/:id — delete keyword
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string)

    const existing = await db.select().from(sensitiveKeywords).where(eq(sensitiveKeywords.id, id)).limit(1)
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Keyword not found' })
    }

    await db.delete(sensitiveKeywords).where(eq(sensitiveKeywords.id, id))
    res.json({ success: true, message: 'Keyword deleted' })
  } catch (err) {
    logger.error({ err }, 'Failed to delete sensitive keyword')
    res.status(500).json({ success: false, error: 'Failed to delete sensitive keyword' })
  }
})

// POST /api/v1/admin/sensitive-keywords/batch — batch import keywords
router.post('/batch', async (req: AuthRequest, res) => {
  try {
    const { keywords } = req.body as { keywords: Array<{ keyword: string; category?: string; severity?: string; action?: string; scope?: string }> }

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ success: false, error: 'Keywords array is required' })
    }

    let imported = 0
    let skipped = 0

    for (const kw of keywords) {
      try {
        await db.insert(sensitiveKeywords).values({
          keyword: kw.keyword,
          category: kw.category || 'general',
          severity: kw.severity || 'medium',
          action: kw.action || 'review',
          scope: kw.scope || 'all',
          createdBy: req.user!.userId,
        })
        imported++
      } catch {
        skipped++
      }
    }

    res.json({
      success: true,
      data: { imported, skipped },
      message: `Imported ${imported} keywords, skipped ${skipped} duplicates`,
    })
  } catch (err) {
    logger.error({ err }, 'Failed to batch import keywords')
    res.status(500).json({ success: false, error: 'Failed to batch import keywords' })
  }
})

export default router
