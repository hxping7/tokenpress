import { Router } from 'express'
import { db } from '../db/index.js'
import { friendLinks } from '../db/schema.js'
import { eq, asc } from 'drizzle-orm'
import { type AuthRequest } from '../middleware/auth.js'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'

const router = Router()

// GET /api/v1/friend-links — public, list all active links
router.get('/', async (_req, res) => {
  try {
    const links = await db.select().from(friendLinks)
      .where(eq(friendLinks.isActive, 1))
      .orderBy(asc(friendLinks.sortOrder), asc(friendLinks.id))
      .all()
    res.json({ success: true, data: links })
  } catch (err) {
    console.error('List friend links error:', err)
    res.status(500).json({ success: false, error: 'Failed to list friend links' })
  }
})

// ===== Admin routes (API Token site:write 或 JWT 管理员) =====
router.use(apiTokenOrAdmin('site:write'))

// POST /api/v1/friend-links — create link
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, url, description, sortOrder = 0, isActive = true } = req.body

    if (!name || !url) {
      return res.status(400).json({ success: false, error: 'Name and URL are required' })
    }

    const result = await db.insert(friendLinks).values({
      name,
      url,
      description: description || null,
      sortOrder,
      isActive: isActive ? 1 : 0,
    }).run()

    const id = Number(result.lastInsertRowid)
    const link = await db.select().from(friendLinks).where(eq(friendLinks.id, id)).get()

    await auditLog(req, 'create', 'friend_link', id, `Created friend link: ${name}`)
    res.status(201).json({ success: true, data: link })
  } catch (err) {
    console.error('Create friend link error:', err)
    res.status(500).json({ success: false, error: 'Failed to create friend link' })
  }
})

// PUT /api/v1/friend-links/:id — update link
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const linkId = getParamAsInt(req.params.id)
    if (!linkId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const { name, url, description, sortOrder, isActive } = req.body

    const existing = await db.select().from(friendLinks).where(eq(friendLinks.id, linkId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Friend link not found' })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (url !== undefined) updates.url = url
    if (description !== undefined) updates.description = description || null
    if (sortOrder !== undefined) updates.sortOrder = sortOrder
    if (isActive !== undefined) updates.isActive = isActive ? 1 : 0

    await db.update(friendLinks).set(updates).where(eq(friendLinks.id, linkId)).run()

    await auditLog(req, 'update', 'friend_link', linkId, `Updated friend link: ${existing.name}`)
    const updated = await db.select().from(friendLinks).where(eq(friendLinks.id, linkId)).get()
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('Update friend link error:', err)
    res.status(500).json({ success: false, error: 'Failed to update friend link' })
  }
})

// DELETE /api/v1/friend-links/:id — delete link
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const linkId = getParamAsInt(req.params.id)
    if (!linkId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const existing = await db.select().from(friendLinks).where(eq(friendLinks.id, linkId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Friend link not found' })
    }

    await db.delete(friendLinks).where(eq(friendLinks.id, linkId)).run()

    await auditLog(req, 'delete', 'friend_link', linkId, `Deleted friend link: ${existing.name}`)
    res.json({ success: true, message: 'Friend link deleted' })
  } catch (err) {
    console.error('Delete friend link error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete friend link' })
  }
})

// PATCH /api/v1/friend-links/reorder — reorder links
router.patch('/reorder', async (req: AuthRequest, res) => {
  try {
    const { orders } = req.body as { orders: { id: number; sortOrder: number }[] }

    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'orders must be an array' })
    }

    for (const item of orders) {
      await db.update(friendLinks)
        .set({ sortOrder: item.sortOrder })
        .where(eq(friendLinks.id, item.id))
        .run()
    }

    res.json({ success: true, message: 'Friend links reordered' })
  } catch (err) {
    console.error('Reorder friend links error:', err)
    res.status(500).json({ success: false, error: 'Failed to reorder friend links' })
  }
})

export default router