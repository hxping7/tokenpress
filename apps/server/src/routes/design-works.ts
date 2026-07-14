import { Router } from 'express'
import { db } from '../db/index.js'
import { designWorks, sections } from '../db/schema.js'
import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { type AuthRequest } from '../middleware/auth.js'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { generateSlug } from '@tokenpress/shared'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'

const router = Router()

/** 将 DB 行序列化为 API 输出，并解析 JSON 字段 */
function serializeWork(row: any) {
  if (!row) return row
  let tags: string[] = []
  let galleryImages: string[] = []
  try { tags = row.tags ? JSON.parse(row.tags) : [] } catch { tags = [] }
  try { galleryImages = row.gallery_images ? JSON.parse(row.gallery_images) : [] } catch { galleryImages = [] }
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverImage: row.cover_image,
    summary: row.summary,
    content: row.content,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    category: row.category,
    tags,
    externalUrl: row.external_url,
    galleryImages,
    status: row.status,
    sortOrder: row.sort_order,
    viewCount: row.view_count,
    sectionId: row.section_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 根据 section slug 解析 sectionId */
async function resolveSectionId(sectionSlug: string): Promise<number | null> {
  const section = await db.select({ id: sections.id })
    .from(sections)
    .where(and(eq(sections.slug, sectionSlug), eq(sections.isActive, 1)))
    .get()
  return section?.id ?? null
}

// ===== 公共路由 =====

// GET /api/v1/design-works — 列表（按 section 过滤，可选 category / 分页）
router.get('/', async (req, res) => {
  try {
    const sectionSlug = req.query.section as string | undefined
    const category = req.query.category as string | undefined
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12))

    const conditions: any[] = [eq(designWorks.status, 'published')]
    if (category) conditions.push(eq(designWorks.category, category))

    if (sectionSlug) {
      const sectionId = await resolveSectionId(sectionSlug)
      if (!sectionId) {
        return res.json({ success: true, data: [], total: 0, page, pageSize })
      }
      conditions.push(eq(designWorks.sectionId, sectionId))
    }

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(designWorks)
      .where(and(...conditions))
      .get()
    const total = totalResult?.count || 0

    const rows = await db.select()
      .from(designWorks)
      .where(and(...conditions))
      .orderBy(asc(designWorks.sortOrder), desc(designWorks.publishedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all()

    res.json({
      success: true,
      data: rows.map(serializeWork),
      total,
      page,
      pageSize,
    })
  } catch (err) {
    console.error('List design works error:', err)
    res.status(500).json({ success: false, error: 'Failed to list design works' })
  }
})

// GET /api/v1/design-works/categories — 公开，某 section 下的作品分类列表
router.get('/categories', async (req, res) => {
  try {
    const sectionSlug = req.query.section as string | undefined
    const conditions: any[] = []
    if (sectionSlug) {
      const sectionId = await resolveSectionId(sectionSlug)
      if (sectionId) conditions.push(eq(designWorks.sectionId, sectionId))
    }
    const rows = await db.select({ category: designWorks.category })
      .from(designWorks)
      .where(conditions.length ? and(...conditions) : undefined)
      .all()
    const cats = Array.from(new Set(rows.map((r: any) => r.category).filter(Boolean))) as string[]
    res.json({ success: true, data: cats })
  } catch (err) {
    console.error('List work categories error:', err)
    res.status(500).json({ success: false, error: 'Failed to list categories' })
  }
})

// GET /api/v1/design-works/manage — 管理用列表（含草稿，需 works:write）
router.get('/manage', apiTokenOrAdmin('works:write'), async (req, res) => {
  try {
    const sectionSlug = req.query.section as string | undefined
    const conditions: any[] = []
    if (sectionSlug) {
      const sectionId = await resolveSectionId(sectionSlug)
      if (sectionId) conditions.push(eq(designWorks.sectionId, sectionId))
    }
    const rows = await db.select()
      .from(designWorks)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(designWorks.updatedAt))
      .all()
    res.json({ success: true, data: rows.map(serializeWork) })
  } catch (err) {
    console.error('Manage design works error:', err)
    res.status(500).json({ success: false, error: 'Failed to list works' })
  }
})

// GET /api/v1/design-works/:slug — 公开，单条详情
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug
    const work = await db.select().from(designWorks).where(eq(designWorks.slug, slug)).get()
    if (!work) {
      return res.status(404).json({ success: false, error: 'Work not found' })
    }
    // 阅读量 +1（仅公开详情）
    await db.update(designWorks)
      .set({ viewCount: (work.viewCount || 0) + 1, updatedAt: new Date().toISOString() })
      .where(eq(designWorks.id, work.id))
      .run()
    res.json({ success: true, data: serializeWork(work) })
  } catch (err) {
    console.error('Get design work error:', err)
    res.status(500).json({ success: false, error: 'Failed to get design work' })
  }
})

// ===== 管理路由（works:write 或 JWT 管理员）=====
router.use(apiTokenOrAdmin('works:write'))

// POST /api/v1/design-works — 创建
router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      title, slug, coverImage, summary, content, authorName, authorAvatar,
      category, tags, externalUrl, galleryImages, status = 'published',
      sortOrder = 0, sectionId,
    } = req.body

    if (!title || !sectionId) {
      return res.status(400).json({ success: false, error: 'title 和 sectionId 必填' })
    }
    const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
    if (!section) {
      return res.status(400).json({ success: false, error: 'Section 不存在' })
    }

    const workSlug = slug || generateSlug(title)
    const existing = await db.select().from(designWorks).where(eq(designWorks.slug, workSlug)).get()
    if (existing) {
      return res.status(409).json({ success: false, error: '该 slug 已存在' })
    }

    const result = await db.insert(designWorks).values({
      title,
      slug: workSlug,
      coverImage: coverImage || null,
      summary: summary || null,
      content: content || null,
      authorName: authorName || null,
      authorAvatar: authorAvatar || null,
      category: category || null,
      tags: tags ? JSON.stringify(tags) : null,
      externalUrl: externalUrl || null,
      galleryImages: galleryImages ? JSON.stringify(galleryImages) : null,
      status,
      sortOrder,
      sectionId,
      publishedAt: new Date().toISOString(),
    } as any).run()

    const id = Number(result.lastInsertRowid)
    const created = await db.select().from(designWorks).where(eq(designWorks.id, id)).get()
    await auditLog(req, 'create', 'design_work', id, `Created work: ${title}`)
    res.status(201).json({ success: true, data: serializeWork(created) })
  } catch (err) {
    console.error('Create design work error:', err)
    res.status(500).json({ success: false, error: 'Failed to create design work' })
  }
})

// PUT /api/v1/design-works/:id — 更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = getParamAsInt(req.params.id)
    if (!id) return res.status(400).json({ success: false, error: 'Invalid ID' })

    const existing = await db.select().from(designWorks).where(eq(designWorks.id, id)).get()
    if (!existing) return res.status(404).json({ success: false, error: 'Work not found' })

    const {
      title, slug, coverImage, summary, content, authorName, authorAvatar,
      category, tags, externalUrl, galleryImages, status, sortOrder, sectionId,
    } = req.body

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (title !== undefined) updates.title = title
    if (slug !== undefined) updates.slug = slug
    if (coverImage !== undefined) updates.coverImage = coverImage
    if (summary !== undefined) updates.summary = summary
    if (content !== undefined) updates.content = content
    if (authorName !== undefined) updates.authorName = authorName
    if (authorAvatar !== undefined) updates.authorAvatar = authorAvatar
    if (category !== undefined) updates.category = category
    if (tags !== undefined) updates.tags = tags ? JSON.stringify(tags) : null
    if (externalUrl !== undefined) updates.externalUrl = externalUrl
    if (galleryImages !== undefined) updates.galleryImages = galleryImages ? JSON.stringify(galleryImages) : null
    if (status !== undefined) updates.status = status
    if (sortOrder !== undefined) updates.sortOrder = sortOrder
    if (sectionId !== undefined) updates.sectionId = sectionId

    await db.update(designWorks).set(updates as any).where(eq(designWorks.id, id)).run()
    await auditLog(req, 'update', 'design_work', id, `Updated work: ${existing.title}`)
    const updated = await db.select().from(designWorks).where(eq(designWorks.id, id)).get()
    res.json({ success: true, data: serializeWork(updated) })
  } catch (err) {
    console.error('Update design work error:', err)
    res.status(500).json({ success: false, error: 'Failed to update design work' })
  }
})

// DELETE /api/v1/design-works/:id — 删除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = getParamAsInt(req.params.id)
    if (!id) return res.status(400).json({ success: false, error: 'Invalid ID' })

    const existing = await db.select().from(designWorks).where(eq(designWorks.id, id)).get()
    if (!existing) return res.status(404).json({ success: false, error: 'Work not found' })

    await db.delete(designWorks).where(eq(designWorks.id, id)).run()
    await auditLog(req, 'delete', 'design_work', id, `Deleted work: ${existing.title}`)
    res.json({ success: true, message: 'Work deleted' })
  } catch (err) {
    console.error('Delete design work error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete design work' })
  }
})

export default router
