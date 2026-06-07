import { Router } from 'express'
import { db } from '../db/index.js'
import { sections, categories } from '../db/schema.js'
import { eq, asc, sql } from 'drizzle-orm'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import { generateSlug } from '@tokenpress/shared'
import { getParamAsInt } from '../utils/params.js'
import { revalidateTag } from '../utils/revalidate.js'
import { auditLog } from '../utils/auditLogger.js'

const router = Router()

// GET /api/v1/sections — public, list all active sections
router.get('/', async (_req, res) => {
  try {
    const all = await db.select().from(sections)
      .where(eq(sections.isActive, 1))
      .orderBy(asc(sections.sortOrder), asc(sections.id))
      .all()
    res.json({ success: true, data: all })
  } catch (err) {
    console.error('List sections error:', err)
    res.status(500).json({ success: false, error: 'Failed to list sections' })
  }
})

// GET /api/v1/sections/:id — public
router.get('/:id', async (req, res) => {
  try {
    const id = getParamAsInt(req.params.id)
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }
    const section = await db.select().from(sections).where(eq(sections.id, id)).get()
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' })
    }
    res.json({ success: true, data: section })
  } catch (err) {
    console.error('Get section error:', err)
    res.status(500).json({ success: false, error: 'Failed to get section' })
  }
})

// GET /api/v1/sections/:id/categories — get categories in a section
router.get('/:id/categories', async (req, res) => {
  try {
    const sectionId = getParamAsInt(req.params.id)
    if (!sectionId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }
    const cats = await db.select().from(categories)
      .where(eq(categories.sectionId, sectionId))
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .all()
    res.json({ success: true, data: cats })
  } catch (err) {
    console.error('Get section categories error:', err)
    res.status(500).json({ success: false, error: 'Failed to get categories' })
  }
})

// ===== Admin routes =====
router.use(authMiddleware, adminOnly)

// POST /api/v1/sections — create section
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, slug, path, description, externalUrl, sortOrder = 0, isActive = true } = req.body

    if (!name || !path) {
      return res.status(400).json({ success: false, error: 'Name and path are required' })
    }

    const sectionSlug = slug || generateSlug(name)
    const sectionPath = path.startsWith('/') ? path : `/${path}`

    // Check for duplicate slug
    const existingSlug = await db.select().from(sections).where(eq(sections.slug, sectionSlug)).get()
    if (existingSlug) {
      return res.status(409).json({ success: false, error: 'Section with this slug already exists' })
    }

    // Check for duplicate path (only if no external URL)
    if (!externalUrl) {
      const existingPath = await db.select().from(sections).where(eq(sections.path, sectionPath)).get()
      if (existingPath) {
        return res.status(409).json({ success: false, error: 'Section with this path already exists' })
      }
    }

    const result = await db.insert(sections).values({
      name,
      slug: sectionSlug,
      path: sectionPath,
      description: description || null,
      externalUrl: externalUrl || null,
      sortOrder,
      isActive: isActive ? 1 : 0,
    }).run()

    const id = Number(result.lastInsertRowid)
    const section = await db.select().from(sections).where(eq(sections.id, id)).get()

    await auditLog(req, 'create', 'section', id, `Created section: ${name}`)
    revalidateTag('sections')
    res.status(201).json({ success: true, data: section })
  } catch (err) {
    console.error('Create section error:', err)
    res.status(500).json({ success: false, error: 'Failed to create section' })
  }
})

// PUT /api/v1/sections/:id — update section
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const sectionId = getParamAsInt(req.params.id)
    if (!sectionId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const { name, slug, path, description, externalUrl, sortOrder, isActive } = req.body

    const existing = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Section not found' })
    }

    // Check slug uniqueness if changing
    if (slug && slug !== existing.slug) {
      const duplicate = await db.select().from(sections).where(eq(sections.slug, slug)).get()
      if (duplicate) {
        return res.status(409).json({ success: false, error: 'Section with this slug already exists' })
      }
    }

    // Check path uniqueness if changing (only if no external URL)
    if (path && path !== existing.path && !externalUrl) {
      const sectionPath = path.startsWith('/') ? path : `/${path}`
      const duplicate = await db.select().from(sections).where(eq(sections.path, sectionPath)).get()
      if (duplicate) {
        return res.status(409).json({ success: false, error: 'Section with this path already exists' })
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slug
    if (path !== undefined) updates.path = path.startsWith('/') ? path : `/${path}`
    if (description !== undefined) updates.description = description
    if (externalUrl !== undefined) updates.externalUrl = externalUrl || null
    if (sortOrder !== undefined) updates.sortOrder = sortOrder
    if (isActive !== undefined) updates.isActive = isActive ? 1 : 0

    await db.update(sections).set(updates).where(eq(sections.id, sectionId)).run()

    await auditLog(req, 'update', 'section', sectionId, `Updated section: ${existing.name}`)
    const updated = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
    revalidateTag('sections')
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('Update section error:', err)
    res.status(500).json({ success: false, error: 'Failed to update section' })
  }
})

// PATCH /api/v1/sections/reorder — reorder sections
router.patch('/reorder', async (req: AuthRequest, res) => {
  try {
    const { orders } = req.body as { orders: { id: number; sortOrder: number }[] }

    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'orders must be an array' })
    }

    for (const item of orders) {
      await db.update(sections)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
        .where(eq(sections.id, item.id))
        .run()
    }

    revalidateTag('sections')
    res.json({ success: true, message: 'Sections reordered' })
  } catch (err) {
    console.error('Reorder sections error:', err)
    res.status(500).json({ success: false, error: 'Failed to reorder sections' })
  }
})

// DELETE /api/v1/sections/:id — delete section
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const sectionId = getParamAsInt(req.params.id)
    if (!sectionId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const existing = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Section not found' })
    }

    await db.delete(sections).where(eq(sections.id, sectionId)).run()

    await auditLog(req, 'delete', 'section', sectionId, `Deleted section: ${existing.name}`)
    revalidateTag('sections')
    res.json({ success: true, message: 'Section deleted' })
  } catch (err) {
    console.error('Delete section error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete section' })
  }
})

export default router
