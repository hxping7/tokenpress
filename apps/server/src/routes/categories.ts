import { Router } from 'express'
import { db } from '../db/index.js'
import { articles, categories, sections } from '../db/schema.js'
import { eq, asc, and, sql } from 'drizzle-orm'
import { type AuthRequest } from '../middleware/auth.js'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { isTemplateValid } from '../lib/sectionTemplates.js'
import { generateSlug } from '@tokenpress/shared'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'

const router = Router()

/** 将 DB 中的 categories 行转换为 API 输出（解析 template_config JSON） */
function serializeCategory(row: any) {
  if (!row) return row
  let templateConfig: unknown = null
  if (row.templateConfig && typeof row.templateConfig === 'string') {
    try { templateConfig = JSON.parse(row.templateConfig) } catch { templateConfig = null }
  }
  return {
    ...row,
    template: row.template === '' ? '' : (row.template || 'article-list'),
    templateConfig,
  }
}

// GET /api/v1/categories — public, list categories, supports ?section=<slug> filter
router.get('/', async (req, res) => {
  try {
    const sectionSlug = req.query.section as string | undefined

    const result = await db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sectionId: categories.sectionId,
      description: categories.description,
      sortOrder: categories.sortOrder,
      template: categories.template,
      templateConfig: categories.templateConfig,
      section: {
        id: sections.id,
        name: sections.name,
        slug: sections.slug,
        path: sections.path,
      },
    }).from(categories)
      .leftJoin(sections, eq(categories.sectionId, sections.id))
      .where(sectionSlug ? and(eq(sections.slug, sectionSlug), eq(sections.isActive, 1)) : undefined)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .all()

    // Attach article count for each category
    const enriched = await Promise.all(
      result.map(async (cat) => {
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(articles)
          .where(and(eq(articles.categoryId, cat.id), eq(articles.status, 'published')))
          .get()
        return serializeCategory({
          ...cat,
          articleCount: countResult?.count || 0,
        })
      })
    )

    res.json({ success: true, data: enriched })
  } catch (err) {
    console.error('List categories error:', err)
    res.status(500).json({ success: false, error: 'Failed to list categories' })
  }
})

// GET /api/v1/categories/:id — public
router.get('/:id', async (req, res) => {
  try {
    const id = getParamAsInt(req.params.id)
    if (!id) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }
    const category = await db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sectionId: categories.sectionId,
      description: categories.description,
      sortOrder: categories.sortOrder,
      template: categories.template,
      templateConfig: categories.templateConfig,
      section: {
        id: sections.id,
        name: sections.name,
        slug: sections.slug,
        path: sections.path,
      },
    }).from(categories)
      .leftJoin(sections, eq(categories.sectionId, sections.id))
      .where(eq(categories.id, id))
      .get()
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }
    res.json({ success: true, data: serializeCategory(category) })
  } catch (err) {
    console.error('Get category error:', err)
    res.status(500).json({ success: false, error: 'Failed to get category' })
  }
})

// ===== Admin routes =====
router.use(apiTokenOrAdmin('categories:write'))

// POST /api/v1/categories — create category
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, slug, sectionId, description, sortOrder = 0, template, templateConfig } = req.body

    if (!name || !sectionId) {
      return res.status(400).json({ success: false, error: 'Name and sectionId are required' })
    }

    // Verify section exists
    const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
    if (!section) {
      return res.status(400).json({ success: false, error: 'Section not found' })
    }

    // Auto-generate slug if not provided
    const categorySlug = slug || generateSlug(name)

    // Check for duplicate slug
    const existing = await db.select().from(categories).where(eq(categories.slug, categorySlug)).get()
    if (existing) {
      return res.status(409).json({ success: false, error: 'Category with this slug already exists' })
    }

    const result = await db.insert(categories).values({
      name,
      slug: categorySlug,
      sectionId,
      description: description || null,
      sortOrder,
      template: template === '' ? '' : (isTemplateValid(template) ? template : 'article-list'),
      templateConfig: templateConfig && typeof templateConfig === 'object' ? JSON.stringify(templateConfig) : null,
    }).run()

    const id = Number(result.lastInsertRowid)
    const category = await db.select().from(categories).where(eq(categories.id, id)).get()

    await auditLog(req, 'create', 'category', id, `Created category: ${name}`)
    res.status(201).json({ success: true, data: category })
  } catch (err) {
    console.error('Create category error:', err)
    res.status(500).json({ success: false, error: 'Failed to create category' })
  }
})

// PUT /api/v1/categories/:id — update category
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const categoryId = getParamAsInt(req.params.id)
    if (!categoryId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const { name, slug, sectionId, description, sortOrder, template, templateConfig } = req.body

    const existing = await db.select().from(categories).where(eq(categories.id, categoryId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }

    // Check slug uniqueness if changing
    if (slug && slug !== existing.slug) {
      const duplicate = await db.select().from(categories).where(eq(categories.slug, slug)).get()
      if (duplicate) {
        return res.status(409).json({ success: false, error: 'Category with this slug already exists' })
      }
    }

    // Verify section exists if changing
    if (sectionId) {
      const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
      if (!section) {
        return res.status(400).json({ success: false, error: 'Section not found' })
      }
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slug
    if (sectionId !== undefined) updates.sectionId = sectionId
    if (description !== undefined) updates.description = description
    if (sortOrder !== undefined) updates.sortOrder = sortOrder
    if (template !== undefined) {
      updates.template = template === '' ? '' : (isTemplateValid(template) ? template : 'article-list')
    }
    if (templateConfig !== undefined) {
      updates.templateConfig = templateConfig === null
        ? null
        : (typeof templateConfig === 'object' ? JSON.stringify(templateConfig) : String(templateConfig))
    }

    await db.update(categories).set(updates).where(eq(categories.id, categoryId)).run()

    await auditLog(req, 'update', 'category', categoryId, `Updated category: ${existing.name}`)
    const updated = await db.select().from(categories).where(eq(categories.id, categoryId)).get()
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('Update category error:', err)
    res.status(500).json({ success: false, error: 'Failed to update category' })
  }
})

// DELETE /api/v1/categories/:id — delete category
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const categoryId = getParamAsInt(req.params.id)
    if (!categoryId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const existing = await db.select().from(categories).where(eq(categories.id, categoryId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }

    await db.delete(categories).where(eq(categories.id, categoryId)).run()

    await auditLog(req, 'delete', 'category', categoryId, `Deleted category: ${existing.name}`)
    res.json({ success: true, message: 'Category deleted' })
  } catch (err) {
    console.error('Delete category error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete category' })
  }
})

export default router
