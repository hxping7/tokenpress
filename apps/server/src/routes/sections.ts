import { Router } from 'express'
import { db } from '../db/index.js'
import { sections, categories } from '../db/schema.js'
import { eq, asc, sql } from 'drizzle-orm'
import { type AuthRequest } from '../middleware/auth.js'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { isTemplateValid } from '../lib/sectionTemplates.js'
import { generateSlug } from '@tokenpress/shared'
import { getParamAsInt } from '../utils/params.js'
import { revalidateTag } from '../utils/revalidate.js'
import { auditLog } from '../utils/auditLogger.js'

const router = Router()

// ===== 工具函数 =====

/** 合法的版块级 layout 键（不包含 homepage — 首页由 siteSettings 控制） */
const VALID_SECTION_LAYOUT_KEYS = ['section', 'article', 'list'] as const

/**
 * 校验版块级 layouts：
 * - null / undefined → 放行（回退全局默认）
 * - 必须是对象，键必须在 {section, article, list} 范围内
 */
function validateSectionLayouts(value: unknown): { ok: boolean; error?: string } {
  if (value === undefined || value === null) return { ok: true }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'layouts 必须是对象（或 null）' }
  }
  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (!(VALID_SECTION_LAYOUT_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `不允许的 layouts 键：${key}（允许：${VALID_SECTION_LAYOUT_KEYS.join(', ')}）` }
    }
  }
  return { ok: true }
}

/** 将 DB 中的 sections 行转换为 API 输出（解析 layouts / template_config JSON） */
function serializeSection(row: any) {
  if (!row) return row
  let layouts: unknown = null
  if (row.layouts && typeof row.layouts === 'string') {
    try { layouts = JSON.parse(row.layouts) } catch { layouts = null }
  }
  let templateConfig: unknown = null
  if (row.template_config && typeof row.template_config === 'string') {
    try { templateConfig = JSON.parse(row.template_config) } catch { templateConfig = null }
  }
  return {
    ...row,
    layouts,
    template: row.template || 'article-list',
    templateConfig,
  }
}

// ===== 公共路由 =====

// GET /api/v1/sections — public, list all active sections
router.get('/', async (_req, res) => {
  try {
    const all = await db.select().from(sections)
      .where(eq(sections.isActive, 1))
      .orderBy(asc(sections.sortOrder), asc(sections.id))
      .all()
    res.json({ success: true, data: all.map(serializeSection) })
  } catch (err) {
    console.error('List sections error:', err)
    res.status(500).json({ success: false, error: 'Failed to list sections' })
  }
})

// GET /api/v1/sections/all — 受保护，返回全部板块（含未启用），供后台管理界面使用
// 必须定义在 GET /:id 之前，否则会被 /:id 吞掉（getParamAsInt('all') 返回 falsy → 400）
router.get('/all', apiTokenOrAdmin('sections:write'), async (_req, res) => {
  try {
    const all = await db.select().from(sections)
      .orderBy(asc(sections.sortOrder), asc(sections.id))
      .all()
    res.json({ success: true, data: all.map(serializeSection) })
  } catch (err) {
    console.error('List all sections error:', err)
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
    res.json({ success: true, data: serializeSection(section) })
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

// ===== Admin routes (API Token sections:write 或 JWT 管理员) =====
router.use(apiTokenOrAdmin('sections:write'))

// POST /api/v1/sections — create section
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, slug, path, description, externalUrl, sortOrder = 0, isActive = true, layouts, template, templateConfig } = req.body

    if (!name || !path) {
      return res.status(400).json({ success: false, error: 'Name and path are required' })
    }

    // 校验 layouts（如果传入）
    if (layouts !== undefined && layouts !== null) {
      const lv = validateSectionLayouts(layouts)
      if (!lv.ok) return res.status(400).json({ success: false, error: lv.error })
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

    const values: Record<string, unknown> = {
      name,
      slug: sectionSlug,
      path: sectionPath,
      description: description || null,
      externalUrl: externalUrl || null,
      sortOrder,
      isActive: isActive ? 1 : 0,
      template: isTemplateValid(template) ? template : 'article-list',
      templateConfig: templateConfig && typeof templateConfig === 'object' ? JSON.stringify(templateConfig) : null,
    }
    // 将 layouts 序列化为 JSON 字符串存储
    if (layouts !== undefined) {
      values.layouts = layouts === null ? null : JSON.stringify(layouts)
    }

    const result = await db.insert(sections).values(values as any).run()

    const id = Number(result.lastInsertRowid)
    const section = await db.select().from(sections).where(eq(sections.id, id)).get()

    await auditLog(req, 'create', 'section', id, `Created section: ${name}`)
    revalidateTag('sections')
    res.status(201).json({ success: true, data: serializeSection(section) })
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

    const { name, slug, path, description, externalUrl, sortOrder, isActive, layouts, template, templateConfig } = req.body

    const existing = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Section not found' })
    }

    // 校验 layouts（如果传入）
    if (layouts !== undefined) {
      const lv = validateSectionLayouts(layouts)
      if (!lv.ok) return res.status(400).json({ success: false, error: lv.error })
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
    // template：仅接受白名单值
    if (template !== undefined) {
      updates.template = isTemplateValid(template) ? template : 'article-list'
    }
    // templateConfig：对象序列化；null 表示清空
    if (templateConfig !== undefined) {
      updates.templateConfig = templateConfig === null
        ? null
        : (typeof templateConfig === 'object' ? JSON.stringify(templateConfig) : String(templateConfig))
    }
    // layouts：null 表示清空；对象表示覆盖
    if (layouts !== undefined) {
      updates.layouts = layouts === null ? null : JSON.stringify(layouts)
    }

    await db.update(sections).set(updates as any).where(eq(sections.id, sectionId)).run()

    await auditLog(req, 'update', 'section', sectionId, `Updated section: ${existing.name}`)
    const updated = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
    revalidateTag('sections')
    res.json({ success: true, data: serializeSection(updated) })
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
