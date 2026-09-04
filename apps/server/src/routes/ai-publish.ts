import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { db } from '../db/index.js'
import { articles, articleTags, tags, categories, sections, media, articleLikes, articleViews, adLogs, users, siteSettings } from '../db/schema.js'
import { eq, and, inArray, isNull, sql } from 'drizzle-orm'
import { apiTokenAuth, requirePermission, type ApiAuthRequest } from '../middleware/apiToken.js'
import { isTemplateValid } from '../lib/sectionTemplates.js'
import { auditLog } from '../utils/auditLogger.js'
import { generateSlug, extractExcerpt, isValidPinScope } from '@tokenpress/shared'
import type { ContentStatus, PinScope } from '@tokenpress/shared'
import { getParam } from '../utils/params.js'
import { revalidateTag, revalidatePath } from '../utils/revalidate.js'
import { UPLOAD_DIR, MEDIA_URL_PREFIX } from '../utils/paths.js'
import { scheduleReview } from '../lib/contentReview/index.js'
import { extractText } from '../lib/contentReview/extractText.js'
import { extractImages } from '../lib/contentReview/extractImages.js'

const router = Router()
router.use(apiTokenAuth)

/**
 * 从文章内容中提取所有媒体文件 URL
 * 匹配 Markdown 图片、HTML img/video/audio/source 标签中的 src
 */
function extractMediaUrls(content: string, coverImageUrl?: string | null): string[] {
  const urls: Set<string> = new Set()

  // 1. 封面图
  if (coverImageUrl && coverImageUrl.startsWith(MEDIA_URL_PREFIX)) {
    urls.add(coverImageUrl)
  }

  // 2. Markdown 图片: ![alt](url) 或 ![alt](url "title")
  const mdImgRegex = /!\[.*?\]\(([^\s"')]+)/g
  let match: RegExpExecArray | null
  while ((match = mdImgRegex.exec(content)) !== null) {
    const url = match[1].trim()
    if (url.startsWith(MEDIA_URL_PREFIX)) {
      urls.add(url)
    }
  }

  // 3. HTML 标签: <img src="...">, <video src="...">, <audio src="...">, <source src="...">
  const htmlTagRegex = /<(?:img|video|audio|source)\s[^>]*src=["']([^"']+)["']/gi
  while ((match = htmlTagRegex.exec(content)) !== null) {
    const url = match[1].trim()
    if (url.startsWith(MEDIA_URL_PREFIX)) {
      urls.add(url)
    }
  }

  return Array.from(urls)
}

/**
 * 将媒体文件关联到文章（异步非阻塞）
 * 发布/更新文章后自动调用，从 content 中提取 URL 并回填 articleId
 */
async function linkMediaToArticle(articleId: number, content: string, coverImageUrl?: string | null) {
  try {
    const mediaUrls = extractMediaUrls(content, coverImageUrl)
    if (mediaUrls.length === 0) return

    await db.update(media)
      .set({ articleId })
      .where(and(
        inArray(media.url, mediaUrls),
        isNull(media.articleId),       // 只更新未关联的，避免覆盖手动指定
      ))
      .run()
  } catch (err) {
    // 非阻塞：回填失败不影响发布结果
    console.error('Failed to link media to article:', err)
  }
}

/**
 * AI Publishing API
 *
 * This endpoint allows AI agents (WorkBuddy, OpenClaw, QClaw, etc.)
 * to publish articles remotely via API Token authentication.
 *
 * Usage:
 *   POST /api/v1/ai/publish
 *   Authorization: Bearer t00_sk_xxxxx
 *   Content-Type: application/json
 *   {
 *     "title": "Article Title",
 *     "content": "# Markdown content...",
 *     "section": "blog",
 *     "category": "ai-tools",
 *     "tags": ["AI", "Tutorial"],
 *     "coverImageUrl": "https://...",
 *     "status": "published"
 *   }
 */

/**
 * 解析发布接口中的分类参数（创建与更新共用）。
 *
 * 规则：
 *  - category 与 categoryId 都未提供 → skip（创建时默认 null，更新时不改动）
 *  - category 为 null / 空串，或 categoryId 为 null → 显式清空（set null）
 *  - 非空 category（所属板块 slug 优先，否则按名称匹配）或数字 categoryId → 解析后 set
 *  - 提供了值但解析不到 → error（不再静默丢弃，返回 400 让调用方感知）
 */
async function resolveCategoryForPublish(
  rawCategory: unknown,
  rawCategoryId: unknown,
  sectionId: number,
): Promise<
  | { action: 'skip' }
  | { action: 'set'; categoryId: number | null }
  | { action: 'error'; message: string }
> {
  const categoryProvided = rawCategory !== undefined
  const categoryIdProvided = rawCategoryId !== undefined

  if (!categoryProvided && !categoryIdProvided) {
    return { action: 'skip' }
  }

  // 显式清空
  if (rawCategory === null || rawCategoryId === null) {
    return { action: 'set', categoryId: null }
  }
  if (typeof rawCategory === 'string' && rawCategory.trim() === '') {
    return { action: 'set', categoryId: null }
  }

  // category 文本：slug（限当前板块）优先，其次按名称
  if (categoryProvided && typeof rawCategory === 'string' && rawCategory.trim() !== '') {
    const term = rawCategory.trim()
    const bySlug = await db.select().from(categories)
      .where(and(eq(categories.slug, term), eq(categories.sectionId, sectionId)))
      .get()
    if (bySlug) return { action: 'set', categoryId: bySlug.id }
    const byName = await db.select().from(categories).where(eq(categories.name, term)).get()
    if (byName) return { action: 'set', categoryId: byName.id }
    return { action: 'error', message: `Category "${term}" not found` }
  }

  // categoryId 数字
  if (categoryIdProvided) {
    const id = typeof rawCategoryId === 'number' ? rawCategoryId : Number(rawCategoryId)
    if (!Number.isInteger(id) || id <= 0) {
      return { action: 'error', message: `Invalid categoryId "${String(rawCategoryId)}"` }
    }
    const cat = await db.select().from(categories).where(eq(categories.id, id)).get()
    if (!cat) return { action: 'error', message: `Category id ${id} not found` }
    return { action: 'set', categoryId: cat.id }
  }

  return { action: 'skip' }
}

// POST /api/v1/ai/publish — create or update article
router.post('/publish', requirePermission('article:write'), async (req: ApiAuthRequest, res) => {
  try {
    const {
      title,
      content,
      section: sectionSlug,
      category,
      tags: tagNames,
      coverImageUrl,
      status,
      publishedAt,
      slug: customSlug,
      pinnedScope: pinnedScopeRaw,
    } = req.body

    // 防御性处理：去除 coverImageUrl 可能的引号包裹
    let processedCoverImageUrl = coverImageUrl
    if (processedCoverImageUrl && typeof processedCoverImageUrl === 'string') {
      processedCoverImageUrl = processedCoverImageUrl.trim()
      if (
        processedCoverImageUrl.length >= 2 &&
        processedCoverImageUrl[0] === processedCoverImageUrl[processedCoverImageUrl.length - 1] &&
        (processedCoverImageUrl[0] === '"' || processedCoverImageUrl[0] === "'")
      ) {
        processedCoverImageUrl = processedCoverImageUrl.slice(1, -1)
      }
    }

    if (!title || !content || !sectionSlug) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: title, content, section',
        hint: 'section must be a valid section slug (e.g., blog, ai_coding, token_plan)',
      })
    }

    // Resolve section slug to section ID
    const section = await db.select().from(sections).where(eq(sections.slug, sectionSlug)).get()
    if (!section) {
      return res.status(400).json({
        success: false,
        error: `Invalid section "${sectionSlug}". Section not found.`,
      })
    }
    const sectionId = section.id

    // Determine status — check if content review is enabled
    const requestedStatus: ContentStatus = status || 'draft'
    if (!['draft', 'published', 'archived'].includes(requestedStatus)) {
      return res.status(400).json({ success: false, error: `Invalid status "${status}"` })
    }
    const reviewSetting = await db.select().from(siteSettings).where(eq(siteSettings.key, 'content_review_enabled')).get()
    const contentReviewEnabled = reviewSetting?.value === 'true'

    let effectiveStatus: ContentStatus = requestedStatus
    if (requestedStatus === 'published') {
      effectiveStatus = contentReviewEnabled ? 'pending_review' : 'published'
    }

    // 置顶范围校验：仅当显式提供时生效；不提供则不改动已有置顶状态
    let pinnedScope: PinScope | undefined
    if (pinnedScopeRaw !== undefined) {
      if (!isValidPinScope(pinnedScopeRaw)) {
        return res.status(400).json({ success: false, error: `Invalid pinnedScope "${pinnedScopeRaw}"` })
      }
      pinnedScope = pinnedScopeRaw
    }

    // Generate slug
    let slug = customSlug || generateSlug(title)

    // Check if article with same slug exists (update if so)
    const existing = await db.select().from(articles).where(eq(articles.slug, slug)).get()

    if (existing) {
      // Ownership check: admin/superadmin can update any article, users only own articles
      const tokenUser = await db.select({ role: users.role }).from(users).where(eq(users.id, req.apiToken!.userId)).get()
      if (tokenUser?.role !== 'superadmin' && tokenUser?.role !== 'admin' && existing.authorId !== req.apiToken!.userId) {
        return res.status(403).json({
          success: false,
          error: 'Cannot update articles owned by other users',
        })
      }

      // Update existing article (reuse effectiveStatus determined above)
      const updates: Record<string, unknown> = {
        title,
        content,
        excerpt: extractExcerpt(content),
        sectionId,
        status: effectiveStatus,
        updatedAt: new Date().toISOString(),
      }

      if (coverImageUrl) updates.coverImage = coverImageUrl
      if (effectiveStatus === 'pending_review' && !existing.publishedAt) {
        updates.publishedAt = publishedAt || new Date().toISOString()
      }

      // 置顶范围（仅当显式提供）
      if (pinnedScope !== undefined) {
        if (pinnedScope === 'none') {
          updates.pinnedAt = null
          updates.pinnedScope = null
        } else {
          updates.pinnedAt = new Date().toISOString()
          updates.pinnedScope = pinnedScope
        }
      }

      // 分类：创建/更新共用解析逻辑。更新时若提供 category/categoryId 则落地，
      // 解析失败直接 400（不再静默丢弃），与新建行为一致。
      const catResolve = await resolveCategoryForPublish(category, req.body.categoryId, sectionId)
      if (catResolve.action === 'error') {
        return res.status(400).json({ success: false, error: catResolve.message })
      }
      if (catResolve.action === 'set') {
        updates.categoryId = catResolve.categoryId
      }

      await db.update(articles).set(updates).where(eq(articles.id, existing.id)).run()

      // Trigger ISR revalidation
      revalidateTag('articles')
      revalidateTag(`article-${slug}`)
      revalidatePath(`/${section.path}/${slug}`)
      revalidatePath(`/${section.path}`)

      // Update tags
      if (tagNames?.length) {
        await db.delete(articleTags).where(eq(articleTags.articleId, existing.id)).run()
        for (const tagName of tagNames) {
          let tag = await db.select().from(tags).where(eq(tags.name, tagName)).get()
          if (!tag) {
            const tagResult = await db.insert(tags).values({ name: tagName }).run()
            tag = await db.select().from(tags).where(eq(tags.id, Number(tagResult.lastInsertRowid))).get()
          }
          if (tag) {
            await db.insert(articleTags).values({ articleId: existing.id, tagId: tag.id }).run()
          }
        }
      }

      const article = await db.select().from(articles).where(eq(articles.id, existing.id)).get()

      // Schedule content review — fire-and-forget, isolated from response
      if (effectiveStatus === 'pending_review') {
        scheduleReviewAsync(existing.id, title, content, coverImageUrl)
      }

      // 自动关联媒体文件到文章
      linkMediaToArticle(existing.id, content, coverImageUrl)

      return res.json({
        success: true,
        data: {
          id: article!.id,
          slug: article!.slug,
          url: `${process.env.SITE_URL || 'http://localhost:3000'}${section.path}/${article!.slug}`,
          status: article!.status,
          action: 'updated',
        },
        message: 'Article updated successfully',
      })
    }

    // Ensure slug uniqueness for new article
    const slugExists = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).get()
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    // Resolve category (create path) — reuse the same helper as update.
    let categoryId: number | null = null
    const createCatResolve = await resolveCategoryForPublish(category, req.body.categoryId, sectionId)
    if (createCatResolve.action === 'error') {
      return res.status(400).json({ success: false, error: createCatResolve.message })
    }
    if (createCatResolve.action === 'set') {
      categoryId = createCatResolve.categoryId
    }

    // Create new article
    const result = await db.insert(articles).values({
      title,
      slug,
      content,
      excerpt: extractExcerpt(content),
      coverImage: coverImageUrl || null,
      sectionId,
      categoryId,
      status: effectiveStatus,
      authorId: req.apiToken!.userId,
      publishedAt: (requestedStatus === 'published')
        ? publishedAt || new Date().toISOString()
        : publishedAt || null,
      pinnedScope: (pinnedScope && pinnedScope !== 'none') ? pinnedScope : null,
      pinnedAt: (pinnedScope && pinnedScope !== 'none') ? new Date().toISOString() : null,
    }).run()

    const articleId = Number(result.lastInsertRowid)

    // Handle tags
    if (tagNames?.length) {
      for (const tagName of tagNames) {
        let tag = await db.select().from(tags).where(eq(tags.name, tagName)).get()
        if (!tag) {
          const tagResult = await db.insert(tags).values({ name: tagName }).run()
          tag = await db.select().from(tags).where(eq(tags.id, Number(tagResult.lastInsertRowid))).get()
        }
        if (tag) {
          await db.insert(articleTags).values({ articleId, tagId: tag.id }).run()
        }
      }
    }

    const article = await db.select().from(articles).where(eq(articles.id, articleId)).get()

    // Schedule content review — fire-and-forget, isolated from response
    if (effectiveStatus === 'pending_review') {
      scheduleReviewAsync(articleId, title, content, coverImageUrl)
    }

    // 自动关联媒体文件到文章
    linkMediaToArticle(articleId, content, coverImageUrl)

    // Trigger ISR revalidation
    revalidateTag('articles')
    revalidateTag(`article-${slug}`)
    revalidatePath(`/${section.path}/${slug}`)
    revalidatePath(`/${section.path}`)

    res.status(201).json({
      success: true,
      data: {
        id: article!.id,
        slug: article!.slug,
        url: `${process.env.SITE_URL || 'http://localhost:3000'}${section.path}/${article!.slug}`,
        status: article!.status,
        action: 'created',
      },
      message: 'Article published successfully',
    })
  } catch (err) {
    console.error('AI publish error:', err)
    res.status(500).json({ success: false, error: 'Failed to publish article' })
  }
})

// ============================================================
// 分类管理（AI 远程，article:write 已隐含 categories:write）
// ============================================================

/** 规范化 layouts：接受对象或 JSON 字符串，返回存储用的字符串；非法/空 → null */
function normalizeLayouts(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    try { JSON.parse(s); return s } catch { return null }
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return null
}

/** 将 DB 中的 categories 行转换为 API 输出（解析 template_config / layouts JSON） */
function serializeCategory(row: any) {
  if (!row) return row
  let templateConfig: unknown = null
  if (row.templateConfig && typeof row.templateConfig === 'string') {
    try { templateConfig = JSON.parse(row.templateConfig) } catch { templateConfig = null }
  }
  let layouts: unknown = null
  if (row.layouts && typeof row.layouts === 'string') {
    try { layouts = JSON.parse(row.layouts) } catch { layouts = null }
  }
  return {
    ...row,
    template: row.template === '' ? '' : (row.template || 'article-list'),
    templateConfig,
    layouts,
  }
}

/**
 * 分类字段白名单：article:write 隐含 categories:write，因此只允许合理字段。
 * 后台完整的 categories 管理（含排序、模板完整性校验等）仍走 /api/v1/categories。
 */
function buildCategoryValues(
  input: Record<string, unknown>,
  sectionId: number,
): { values: Record<string, unknown>; error?: string } {
  const values: Record<string, unknown> = { sectionId }
  if (input.name !== undefined) values.name = String(input.name)
  if (input.slug !== undefined && input.slug !== '') {
    values.slug = String(input.slug)
  }
  if (input.description !== undefined) values.description = input.description ? String(input.description) : null
  if (input.sortOrder !== undefined) values.sortOrder = Number(input.sortOrder) || 0
  if (input.template !== undefined) {
    const t = input.template === '' ? '' : String(input.template)
    values.template = isTemplateValid(t) ? t : 'article-list'
  }
  if (input.templateConfig !== undefined) {
    values.templateConfig = input.templateConfig === null
      ? null
      : (typeof input.templateConfig === 'object' ? JSON.stringify(input.templateConfig) : String(input.templateConfig))
  }
  if (input.layouts !== undefined) {
    values.layouts = normalizeLayouts(input.layouts)
  }
  if (!values.name) return { values, error: 'name is required' }
  return { values }
}

// POST /api/v1/ai/categories — create category under a section
router.post('/categories', requirePermission('article:write'), async (req: ApiAuthRequest, res) => {
  try {
    const {
      name,
      slug,
      section: sectionSlug,
      sectionId: sectionIdRaw,
      description,
      sortOrder = 0,
      template,
      templateConfig,
      layouts,
    } = req.body

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }

    let sectionId: number
    if (sectionIdRaw) {
      const id = Number(sectionIdRaw)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: `Invalid sectionId "${String(sectionIdRaw)}"` })
      }
      const sec = await db.select().from(sections).where(eq(sections.id, id)).get()
      if (!sec) return res.status(400).json({ success: false, error: `Section id ${id} not found` })
      sectionId = sec.id
    } else if (sectionSlug) {
      const sec = await db.select().from(sections).where(eq(sections.slug, String(sectionSlug))).get()
      if (!sec) return res.status(400).json({ success: false, error: `Section "${String(sectionSlug)}" not found` })
      sectionId = sec.id
    } else {
      return res.status(400).json({ success: false, error: 'section or sectionId is required', hint: 'e.g. section: "blog"' })
    }

    const categorySlug = slug || generateSlug(String(name))
    const existing = await db.select().from(categories).where(eq(categories.slug, categorySlug)).get()
    if (existing) {
      return res.status(409).json({ success: false, error: `Category slug "${categorySlug}" already exists` })
    }

    const { values, error } = buildCategoryValues(
      { name, slug: categorySlug, description, sortOrder, template, templateConfig, layouts },
      sectionId,
    )
    if (error) return res.status(400).json({ success: false, error })

    const result = await db.insert(categories).values(values as any).run()
    const id = Number(result.lastInsertRowid)
    const category = await db.select().from(categories).where(eq(categories.id, id)).get()

    // 合成 req.user 供 auditLog 记录操作人（AI 认证走 req.apiToken，非 req.user）
    ;(req as any).user = { userId: req.apiToken!.userId, username: 'api-token', role: 'admin' }
    await auditLog(req as any, 'create', 'category', id, `Created category via AI API: ${name}`)
    res.status(201).json({ success: true, data: serializeCategory(category) })
  } catch (err) {
    console.error('AI create category error:', err)
    res.status(500).json({ success: false, error: 'Failed to create category' })
  }
})

// PUT /api/v1/ai/categories/:id — modify an existing category
router.put('/categories/:id', requirePermission('article:write'), async (req: ApiAuthRequest, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: `Invalid category id "${req.params.id}"` })
    }

    const {
      name,
      slug,
      section: sectionSlug,
      sectionId: sectionIdRaw,
      description,
      sortOrder,
      template,
      templateConfig,
      layouts,
    } = req.body

    const existing = await db.select().from(categories).where(eq(categories.id, id)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }

    // 若改 slug，校验唯一性
    if (slug && slug !== existing.slug) {
      const dup = await db.select().from(categories).where(eq(categories.slug, String(slug))).get()
      if (dup) return res.status(409).json({ success: false, error: `Category slug "${slug}" already exists` })
    }

    // 若改所属板块，校验存在
    let sectionId = existing.sectionId
    if (sectionIdRaw) {
      const sid = Number(sectionIdRaw)
      if (!Number.isInteger(sid) || sid <= 0) {
        return res.status(400).json({ success: false, error: `Invalid sectionId "${String(sectionIdRaw)}"` })
      }
      const sec = await db.select().from(sections).where(eq(sections.id, sid)).get()
      if (!sec) return res.status(400).json({ success: false, error: `Section id ${sid} not found` })
      sectionId = sec.id
    } else if (sectionSlug) {
      const sec = await db.select().from(sections).where(eq(sections.slug, String(sectionSlug))).get()
      if (!sec) return res.status(400).json({ success: false, error: `Section "${String(sectionSlug)}" not found` })
      sectionId = sec.id
    }

    const { values, error } = buildCategoryValues(
      { name, slug, description, sortOrder, template, templateConfig, layouts },
      sectionId,
    )
    if (error) return res.status(400).json({ success: false, error })

    await db.update(categories).set(values as any).where(eq(categories.id, id)).run()

    ;(req as any).user = { userId: req.apiToken!.userId, username: 'api-token', role: 'admin' }
    await auditLog(req as any, 'update', 'category', id, `Updated category via AI API: ${existing.name}`)
    const updated = await db.select().from(categories).where(eq(categories.id, id)).get()
    res.json({ success: true, data: serializeCategory(updated) })
  } catch (err) {
    console.error('AI update category error:', err)
    res.status(500).json({ success: false, error: 'Failed to update category' })
  }
})

// GET /api/v1/ai/articles — list articles (for AI agent to check existing content)
router.get('/articles', async (req: ApiAuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
    const sectionSlug = req.query.section as string | undefined
    const offset = (page - 1) * limit

    const conditions = [eq(articles.status, 'published')]

    // Resolve section slug to section ID
    if (sectionSlug) {
      const section = await db.select().from(sections).where(eq(sections.slug, sectionSlug)).get()
      if (section) {
        conditions.push(eq(articles.sectionId, section.id))
      }
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

    const countResult = await db.select({ total: sql<number>`count(*)` })
      .from(articles)
      .where(whereClause)
      .get()
    const total = countResult?.total || 0

    const rows = await db.select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      sectionId: articles.sectionId,
      publishedAt: articles.publishedAt,
      pinnedAt: articles.pinnedAt,
      pinnedScope: articles.pinnedScope,
      section: { id: sections.id, name: sections.name, slug: sections.slug, path: sections.path },
    })
      .from(articles)
      .leftJoin(sections, eq(articles.sectionId, sections.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .all()

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total },
    })
  } catch (err) {
    console.error('AI list articles error:', err)
    res.status(500).json({ success: false, error: 'Failed to list articles' })
  }
})

// DELETE /api/v1/ai/articles/:slug — delete article by slug
// ?deleteMedia=true 可选：同时删除关联的媒体文件
router.delete('/articles/:slug', requirePermission('content:delete'), async (req: ApiAuthRequest, res) => {
  try {
    const slug = getParam(req.params.slug)
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Invalid slug' })
    }
    const deleteMedia = req.query.deleteMedia === 'true'

    const article = await db.select().from(articles).where(eq(articles.slug, slug)).get()
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    // Ownership check: admin/superadmin can delete any article, users only own articles
    const tokenUser = await db.select({ role: users.role }).from(users).where(eq(users.id, req.apiToken!.userId)).get()
    if (tokenUser?.role !== 'superadmin' && tokenUser?.role !== 'admin' && article.authorId !== req.apiToken!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete articles owned by other users',
      })
    }

    // 可选：清理关联媒体
    if (deleteMedia) {
      const linkedMedia = await db.select().from(media)
        .where(eq(media.articleId, article.id)).all()

      let deleteFailures = 0
      for (const m of linkedMedia) {
        // 删除物理文件（含路径遍历防护）
        if (m.url.startsWith(MEDIA_URL_PREFIX)) {
          const relativePath = m.url.replace(MEDIA_URL_PREFIX, '').replace(/^uploads\//, '')
          const filePath = path.resolve(UPLOAD_DIR, relativePath)
          if (filePath.startsWith(UPLOAD_DIR)) {
            try { fs.unlinkSync(filePath) } catch (_) { deleteFailures++ }
          } else {
            deleteFailures++
          }
        }
        if (m.thumbnailUrl?.startsWith(MEDIA_URL_PREFIX)) {
          const relativePath = m.thumbnailUrl.replace(MEDIA_URL_PREFIX, '').replace(/^uploads\//, '')
          const filePath = path.resolve(UPLOAD_DIR, relativePath)
          if (filePath.startsWith(UPLOAD_DIR)) {
            try { fs.unlinkSync(filePath) } catch (_) { deleteFailures++ }
          } else {
            deleteFailures++
          }
        }
      }

      // 删数据库记录
      if (linkedMedia.length > 0) {
        await db.delete(media).where(eq(media.articleId, article.id)).run()
      }

      console.log(`[mediaCleanup] Deleted article #${article.id}: ${linkedMedia.length} media records, ${deleteFailures} file deletion failures`)
    }

    await db.delete(articleTags).where(eq(articleTags.articleId, article.id)).run()
    await db.delete(articleLikes).where(eq(articleLikes.articleId, article.id)).run()
    await db.delete(articleViews).where(eq(articleViews.articleId, article.id)).run()
    await db.delete(adLogs).where(eq(adLogs.articleId, article.id)).run()
    await db.delete(articles).where(eq(articles.id, article.id)).run()

    res.json({
      success: true,
      message: 'Article deleted successfully',
      data: deleteMedia ? { mediaDeleted: true } : undefined,
    })
  } catch (err) {
    console.error('AI delete article error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete article' })
  }
})

// POST /api/v1/ai/articles/:slug/pin — 远程设置/取消置顶
// 请求体: { "pinnedScope": "global" | "section" | "none" }
router.post('/articles/:slug/pin', requirePermission('article:write'), async (req: ApiAuthRequest, res) => {
  try {
    const slug = getParam(req.params.slug)
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Invalid slug' })
    }
    const pinnedScope = req.body.pinnedScope
    if (!isValidPinScope(pinnedScope)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pinnedScope',
        hint: 'pinnedScope must be one of: none, global, section',
      })
    }

    const article = await db.select().from(articles).where(eq(articles.slug, slug)).get()
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    // 所有权校验：admin/superadmin 可操作任意文章，user 仅限自己的
    const tokenUser = await db.select({ role: users.role }).from(users).where(eq(users.id, req.apiToken!.userId)).get()
    if (tokenUser?.role !== 'superadmin' && tokenUser?.role !== 'admin' && article.authorId !== req.apiToken!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Cannot update articles owned by other users',
      })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (pinnedScope === 'none') {
      updates.pinnedAt = null
      updates.pinnedScope = null
    } else {
      updates.pinnedAt = new Date().toISOString()
      updates.pinnedScope = pinnedScope
    }

    await db.update(articles).set(updates).where(eq(articles.id, article.id)).run()

    // 重新校验文章详情页（定位其所属板块路径）
    const sec = article.sectionId
      ? await db.select({ path: sections.path }).from(sections).where(eq(sections.id, article.sectionId)).get()
      : null
    revalidateTag('articles')
    revalidateTag(`article-${slug}`)
    revalidatePath(sec?.path ? `${sec.path}/${slug}` : `/${slug}`)

    res.json({
      success: true,
      data: {
        id: article.id,
        slug: article.slug,
        pinnedScope: pinnedScope === 'none' ? null : pinnedScope,
        pinnedAt: pinnedScope === 'none' ? null : updates.pinnedAt,
      },
      message: pinnedScope === 'none' ? 'Article unpinned' : `Article pinned (${pinnedScope})`,
    })
  } catch (err) {
    console.error('AI pin article error:', err)
    res.status(500).json({ success: false, error: 'Failed to update article pin' })
  }
})

export default router

// ============================================================
// 内容审核调度（fire-and-forget，完全隔离于主请求响应）
// ============================================================

function scheduleReviewAsync(targetId: number, title: string, content: string, coverImageUrl?: string) {
  setImmediate(() => {
    try {
      const reviewText = extractText('article', { title, content })
      const reviewImages = extractImages('article', { coverImage: coverImageUrl, content })
      scheduleReview({
        targetType: 'article',
        targetId,
        text: reviewText,
        imageUrls: reviewImages,
      }).catch(err => console.error('Failed to schedule review:', err))
    } catch (err) {
      console.error('Review scheduling failed (non-blocking):', err)
    }
  })
}
