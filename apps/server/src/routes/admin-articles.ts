import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { db } from '../db/index.js'
import { articles, articleTags, tags, categories, sections, users, siteSettings, articleLikes, articleViews, adLogs, media } from '../db/schema.js'
import { eq, and, desc, asc, sql, like, inArray } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { generateSlug, extractExcerpt, isValidPinScope } from '@tokenpress/shared'
import type { ContentStatus, PinScope } from '@tokenpress/shared'
import { revalidateTag } from '../utils/revalidate.js'
import { auditLog } from '../utils/auditLogger.js'
import { UPLOAD_DIR, MEDIA_URL_PREFIX } from '../utils/paths.js'
import { scheduleReview } from '../lib/contentReview/index.js'
import { extractText as extractReviewText } from '../lib/contentReview/extractText.js'
import { extractImages as extractReviewImages } from '../lib/contentReview/extractImages.js'

// 删除单篇文章（含关联记录与可选媒体清理），供单条删除与批量删除复用。
async function performArticleDelete(articleId: number, deleteMedia: boolean): Promise<{ found: boolean }> {
  const existing = await db.select().from(articles).where(eq(articles.id, articleId)).get()
  if (!existing) return { found: false }

  if (deleteMedia) {
    const linkedMedia = await db.select().from(media)
      .where(eq(media.articleId, articleId)).all()

    for (const m of linkedMedia) {
      for (const urlField of [m.url, m.thumbnailUrl]) {
        if (urlField && urlField.startsWith(MEDIA_URL_PREFIX)) {
          const relativePath = urlField.replace(MEDIA_URL_PREFIX, '').replace(/^uploads\//, '')
          const filePath = path.resolve(UPLOAD_DIR, relativePath)
          if (filePath.startsWith(UPLOAD_DIR)) {
            try { fs.unlinkSync(filePath) } catch { /* ignore cleanup failures */ }
          }
        }
      }
    }

    if (linkedMedia.length > 0) {
      await db.delete(media).where(eq(media.articleId, articleId)).run()
    }
  }

  // 按外键顺序删除关联记录
  await db.delete(articleTags).where(eq(articleTags.articleId, articleId)).run()
  await db.delete(articleLikes).where(eq(articleLikes.articleId, articleId)).run()
  await db.delete(articleViews).where(eq(articleViews.articleId, articleId)).run()
  await db.delete(adLogs).where(eq(adLogs.articleId, articleId)).run()
  await db.delete(articles).where(eq(articles.id, articleId)).run()

  return { found: true }
}

const router = Router()

router.use(authMiddleware)

// GET /api/v1/admin/articles — admin/superadmin看全部, user只看自己的
router.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10))
    const sectionSlug = req.query.section as string
    const status = req.query.status as string
    const search = req.query.search as string
    const sort = (req.query.sort as string) || 'createdAt'
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc'
    const offset = (page - 1) * limit

    const allowedSortFields = ['title', 'section', 'status', 'createdAt'] as const
    const sortField = allowedSortFields.includes(sort as any) ? sort : 'createdAt'

    const conditions: any[] = []

    // user role: only see own articles
    if (req.user!.role === 'user') {
      conditions.push(eq(articles.authorId, req.user!.userId))
    }

    if (sectionSlug) {
      const section = await db.select().from(sections).where(eq(sections.slug, sectionSlug)).get()
      if (section) {
        conditions.push(eq(articles.sectionId, section.id))
      }
    }
    if (status) conditions.push(eq(articles.status, status as ContentStatus))
    if (search) conditions.push(like(articles.title, `%${search}%`))

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get()

    const sortColumn = sortField === 'title' ? articles.title
      : sortField === 'status' ? articles.status
      : sortField === 'createdAt' ? articles.createdAt
      : sections.name
    const sortOrder = order === 'asc' ? asc : desc

    const rows = await db.select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      excerpt: articles.excerpt,
      coverImage: articles.coverImage,
      sectionId: articles.sectionId,
      status: articles.status,
      categoryId: articles.categoryId,
      authorId: articles.authorId,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      publishedAt: articles.publishedAt,
      pinnedAt: articles.pinnedAt,
      pinnedScope: articles.pinnedScope,
      section: { id: sections.id, name: sections.name, slug: sections.slug, path: sections.path },
    })
      .from(articles)
      .leftJoin(sections, eq(articles.sectionId, sections.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortOrder(sortColumn))
      .limit(limit)
      .offset(offset)
      .all()

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total: countResult?.count || 0, totalPages: Math.ceil((countResult?.count || 0) / limit) },
    })
  } catch (err) {
    console.error('List admin articles error:', err)
    res.status(500).json({ success: false, error: 'Failed to list articles' })
  }
})

// GET /api/v1/admin/articles/:id — 获取单篇文章详情（包含草稿/待审核）
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id
    const articleId = parseInt(Array.isArray(id) ? id[0] : id)

    if (isNaN(articleId)) {
      return res.status(400).json({ success: false, error: 'Invalid article ID' })
    }

    const article = await db.select().from(articles).where(eq(articles.id, articleId)).get()

    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    // user can only view own articles
    if (req.user!.role === 'user' && article.authorId !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Cannot view other users articles' })
    }

    // Get section and category info
    const section = await db.select().from(sections).where(eq(sections.id, article.sectionId)).get()
    let category = null
    if (article.categoryId) {
      category = await db.select().from(categories).where(eq(categories.id, article.categoryId)).get()
    }

    // Get tags
    const articleTagRecords = await db.select().from(articleTags).where(eq(articleTags.articleId, articleId))
    const tagIds = articleTagRecords.map(t => t.tagId)
    const tagsList = tagIds.length > 0 ? await db.select().from(tags).where(inArray(tags.id, tagIds)).all() : []
    const tagNames = tagsList.map(t => t.name)

    // Get author
    const author = await db.select().from(users).where(eq(users.id, article.authorId)).get()

    res.json({
      success: true,
      data: {
        ...article,
        section,
        category,
        tags: tagNames,
        author: author ? { id: author.id, username: author.username, displayName: author.displayName } : null,
      },
    })
  } catch (err) {
    console.error('Get admin article error:', err)
    res.status(500).json({ success: false, error: 'Failed to get article' })
  }
})

// POST /api/v1/admin/articles — 任意登录用户可创建文章
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, content, section: sectionSlug, categoryId, tags: tagNames, coverImage, status, publishedAt } = req.body

    if (!title || !content || !sectionSlug) {
      return res.status(400).json({ success: false, error: 'Title, content, and section are required' })
    }

    const section = await db.select().from(sections).where(eq(sections.slug, sectionSlug)).get()
    if (!section) {
      return res.status(400).json({ success: false, error: `Invalid section "${sectionSlug}". Section not found.` })
    }
    const sectionId = section.id

    if (status && !['draft', 'published', 'archived', 'scheduled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' })
    }

    let slug = req.body.slug || generateSlug(title)

    const existing = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).get()
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    let resolvedCategoryId: number | null = null
    if (categoryId) {
      if (typeof categoryId === 'string') {
        const cat = await db.select().from(categories)
          .where(and(eq(categories.slug, categoryId), eq(categories.sectionId, sectionId)))
          .get()
        if (cat) resolvedCategoryId = cat.id
      } else {
        resolvedCategoryId = categoryId
      }
    }

    const requestedStatus: ContentStatus = status || 'draft'
    const articleStatus: ContentStatus = requestedStatus === 'published' ? 'pending_review' : requestedStatus
    const excerpt = req.body.excerpt || extractExcerpt(content)

    // 置顶范围：none=不置顶 / global=全局置顶 / section=板块内置顶
    const pinScopeRaw = req.body.pinnedScope
    const pinScope: PinScope = isValidPinScope(pinScopeRaw) ? pinScopeRaw : 'none'
    const pinFields = pinScope !== 'none'
      ? { pinnedAt: new Date().toISOString(), pinnedScope: pinScope }
      : { pinnedAt: null, pinnedScope: null }

    let resolvedPublishedAt: string | null = null
    if (requestedStatus === 'published' && !publishedAt) {
      resolvedPublishedAt = new Date().toISOString()
    } else if (articleStatus === 'scheduled' && publishedAt) {
      resolvedPublishedAt = publishedAt
    } else {
      resolvedPublishedAt = publishedAt || null
    }

    const result = await db.insert(articles).values({
      title,
      slug,
      content,
      excerpt,
      coverImage: coverImage || null,
      sectionId,
      categoryId: resolvedCategoryId,
      status: articleStatus,
      authorId: req.user!.userId,
      publishedAt: resolvedPublishedAt,
      ...pinFields,
    }).run()

    const articleId = Number(result.lastInsertRowid)

    if (tagNames?.length) {
      for (const tagName of tagNames) {
        let tag = await db.select().from(tags).where(eq(tags.name, tagName)).get()
        if (!tag) {
          const tagResult = await db.insert(tags).values({ name: tagName }).run()
          tag = await db.select().from(tags).where(eq(tags.id, Number(tagResult.lastInsertRowid))).get()
        }

        if (tag) {
          await db.insert(articleTags).values({
            articleId,
            tagId: tag.id,
          }).run()
        }
      }
    }

    const article = await db.select().from(articles).where(eq(articles.id, articleId)).get()

    // Schedule content review for pending_review articles — fire-and-forget, isolated from response
    if (articleStatus === 'pending_review') {
      setImmediate(() => {
        try {
          const reviewText = extractReviewText('article', { title, content })
          const reviewImages = extractReviewImages('article', { coverImage, content })
          scheduleReview({
            targetType: 'article',
            targetId: articleId,
            text: reviewText,
            imageUrls: reviewImages,
          }).catch(err => console.error('Failed to schedule review:', err))
        } catch (err) {
          console.error('Schedule review error:', err)
        }
      })
    }

    revalidateTag('articles')
    await auditLog(req, 'create', 'article', articleId, `Created article: ${title}`)
    res.status(201).json({
      success: true,
      data: article,
    })
  } catch (err) {
    console.error('Create article error:', err)
    res.status(500).json({ success: false, error: 'Failed to create article' })
  }
})

// POST /api/v1/admin/articles/batch — 批量操作：delete / updateStatus / updateCategory
router.post('/batch', async (req: AuthRequest, res) => {
  try {
    const { action, ids, data } = req.body as {
      action?: string
      ids?: number[]
      data?: { status?: string; categoryId?: number | null; sectionId?: number | null; pinnedScope?: string }
    }

    const allowedActions = ['delete', 'updateStatus', 'updateCategory', 'updateSection', 'updatePin']
    if (!action || !allowedActions.includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid or missing action' })
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array' })
    }

    const validIds = ids.filter(id => Number.isInteger(id) && id > 0)
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid IDs provided' })
    }

    // 取出目标文章，校验权限（user 只能操作自己的文章）
    const targets = await db.select().from(articles).where(inArray(articles.id, validIds)).all()
    if (req.user!.role === 'user') {
      const notOwn = targets.find(a => a.authorId !== req.user!.userId)
      if (notOwn) {
        return res.status(403).json({ success: false, error: 'Cannot modify other users articles' })
      }
    }
    if (targets.length === 0) {
      return res.status(404).json({ success: false, error: 'No matching articles found' })
    }

    const now = new Date().toISOString()

    if (action === 'delete') {
      const deleteMedia = req.query.deleteMedia === 'true'
      let deleted = 0
      for (const a of targets) {
        const r = await performArticleDelete(a.id, deleteMedia)
        if (r.found) deleted++
      }
      revalidateTag('articles')
      revalidateTag('sections')
      await auditLog(req, 'batch_delete', 'article', undefined, `Batch deleted ${deleted} articles${deleteMedia ? ' (+media)' : ''}`)
      return res.json({ success: true, message: `${deleted} article(s) deleted`, data: { deleted } })
    }

    if (action === 'updateStatus') {
      const requestedStatus = data?.status
      const validStatuses = ['draft', 'published', 'archived', 'scheduled']
      if (!requestedStatus || !validStatuses.includes(requestedStatus)) {
        return res.status(400).json({ success: false, error: 'Invalid status' })
      }

      // 与单条更新一致：开启内容审核时发布进入 pending_review
      const reviewSetting = await db.select().from(siteSettings).where(eq(siteSettings.key, 'content_review_enabled')).get()
      const contentReviewEnabled = reviewSetting?.value === 'true'
      const effectiveStatus: ContentStatus = requestedStatus === 'published'
        ? (contentReviewEnabled ? 'pending_review' : 'published')
        : (requestedStatus as ContentStatus)

      for (const a of targets) {
        const updates: Record<string, unknown> = { status: effectiveStatus, updatedAt: now }
        if (effectiveStatus === 'published' && !a.publishedAt) {
          updates.publishedAt = now
        }
        await db.update(articles).set(updates).where(eq(articles.id, a.id)).run()

        // 发布时触发内容审核（fire-and-forget）
        if (requestedStatus === 'published') {
          setImmediate(() => {
            try {
              const reviewText = extractReviewText('article', { title: a.title, content: a.content || '' })
              const reviewImages = extractReviewImages('article', { coverImage: a.coverImage, content: a.content || '' })
              scheduleReview({
                targetType: 'article',
                targetId: a.id,
                text: reviewText,
                imageUrls: reviewImages,
              }).catch(err => console.error('Failed to schedule review:', err))
            } catch (err) {
              console.error('Schedule review error:', err)
            }
          })
        }
      }
      revalidateTag('articles')
      revalidateTag('sections')
      await auditLog(req, 'batch_update', 'article', undefined, `Batch updated status to "${effectiveStatus}" for ${targets.length} articles`)
      return res.json({ success: true, message: `${targets.length} article(s) updated`, data: { updated: targets.length, status: effectiveStatus } })
    }

    if (action === 'updateCategory') {
      const categoryId = data?.categoryId
      if (categoryId != null) {
        const cat = await db.select().from(categories).where(eq(categories.id, categoryId)).get()
        if (!cat) {
          return res.status(400).json({ success: false, error: 'Category not found' })
        }
      }
      await db.update(articles)
        .set({ categoryId: categoryId ?? null, updatedAt: now })
        .where(inArray(articles.id, targets.map(a => a.id)))
        .run()
      revalidateTag('articles')
      await auditLog(req, 'batch_update', 'article', undefined, `Batch updated category to ${categoryId ?? 'none'} for ${targets.length} articles`)
      return res.json({ success: true, message: `${targets.length} article(s) updated`, data: { updated: targets.length } })
    }

    if (action === 'updateSection') {
      const sectionId = data?.sectionId
      if (sectionId == null) {
        return res.status(400).json({ success: false, error: 'sectionId is required' })
      }
      const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get()
      if (!section) {
        return res.status(400).json({ success: false, error: 'Section not found' })
      }
      await db.update(articles)
        .set({ sectionId: section.id, updatedAt: now })
        .where(inArray(articles.id, targets.map(a => a.id)))
        .run()
      revalidateTag('articles')
      revalidateTag('sections')
      await auditLog(req, 'batch_update', 'article', undefined, `Batch updated section to "${section.slug}" for ${targets.length} articles`)
      return res.json({ success: true, message: `${targets.length} article(s) updated`, data: { updated: targets.length } })
    }

    if (action === 'updatePin') {
      const pinScopeRaw = data?.pinnedScope || 'none'
      if (!isValidPinScope(pinScopeRaw)) {
        return res.status(400).json({ success: false, error: 'Invalid pinnedScope' })
      }
      const pinNow = new Date().toISOString()
      const updates: Record<string, unknown> = pinScopeRaw === 'none'
        ? { pinnedAt: null, pinnedScope: null, updatedAt: pinNow }
        : { pinnedAt: pinNow, pinnedScope: pinScopeRaw, updatedAt: pinNow }
      await db.update(articles)
        .set(updates)
        .where(inArray(articles.id, targets.map(a => a.id)))
        .run()
      revalidateTag('articles')
      revalidateTag('sections')
      await auditLog(req, 'batch_update', 'article', undefined, `Batch updated pin to "${pinScopeRaw}" for ${targets.length} articles`)
      return res.json({ success: true, message: `${targets.length} article(s) pin updated`, data: { updated: targets.length, pinnedScope: pinScopeRaw } })
    }

    return res.status(400).json({ success: false, error: 'Unhandled action' })
  } catch (err) {
    console.error('Batch article operation error:', err)
    res.status(500).json({ success: false, error: 'Failed to perform batch operation' })
  }
})

// PUT /api/v1/admin/articles/:id — user只能编辑自己的, admin/superadmin可编辑全部
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id
    const articleId = parseInt(Array.isArray(id) ? id[0] : id)
    const existing = await db.select().from(articles).where(eq(articles.id, articleId)).get()

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    // user can only edit own articles
    if (req.user!.role === 'user' && existing.authorId !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Cannot edit other users articles' })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }

    if (req.body.title !== undefined) {
      updates.title = req.body.title
      if (!req.body.slug) {
        updates.slug = generateSlug(req.body.title)
      }
    }
    if (req.body.slug !== undefined) updates.slug = req.body.slug
    if (req.body.content !== undefined) {
      updates.content = req.body.content
      if (!req.body.excerpt) {
        updates.excerpt = extractExcerpt(req.body.content)
      }
    }
    if (req.body.excerpt !== undefined) updates.excerpt = req.body.excerpt
    if (req.body.coverImage !== undefined) updates.coverImage = req.body.coverImage

    if (req.body.section !== undefined) {
      const section = await db.select().from(sections).where(eq(sections.slug, req.body.section)).get()
      if (section) {
        updates.sectionId = section.id
      }
    }
    if (req.body.sectionId !== undefined) updates.sectionId = req.body.sectionId
    if (req.body.categoryId !== undefined) updates.categoryId = req.body.categoryId
    if (req.body.status !== undefined) {
      // Check if content review is enabled
      const reviewSetting = await db.select().from(siteSettings).where(eq(siteSettings.key, 'content_review_enabled')).get()
      const contentReviewEnabled = reviewSetting?.value === 'true'

      // If content review is disabled, publish directly without pending_review
      let effectiveStatus = req.body.status
      if (req.body.status === 'published') {
        effectiveStatus = contentReviewEnabled ? 'pending_review' : 'published'
      }
      updates.status = effectiveStatus
      if (req.body.status === 'published' && !existing.publishedAt) {
        updates.publishedAt = new Date().toISOString()
      }
      if (effectiveStatus === 'scheduled' && req.body.publishedAt) {
        updates.publishedAt = req.body.publishedAt
      }
    }
    if (req.body.publishedAt !== undefined) updates.publishedAt = req.body.publishedAt

    // 置顶范围：none=取消置顶 / global=全局置顶 / section=板块内置顶
    if (req.body.pinnedScope !== undefined) {
      const pinScopeRaw = req.body.pinnedScope
      if (!isValidPinScope(pinScopeRaw)) {
        return res.status(400).json({ success: false, error: 'Invalid pinnedScope' })
      }
      if (pinScopeRaw === 'none') {
        updates.pinnedAt = null
        updates.pinnedScope = null
      } else {
        updates.pinnedAt = new Date().toISOString()
        updates.pinnedScope = pinScopeRaw
      }
    }

    await db.update(articles).set(updates).where(eq(articles.id, articleId)).run()

    if (req.body.tags !== undefined) {
      await db.run(sql`DELETE FROM article_tags WHERE article_id = ${articleId}`)

      const tagsList = Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]
      for (const tagName of tagsList as string[]) {
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

    // Schedule content review if status changed to pending_review — fire-and-forget, isolated from response
    if (req.body.status === 'published') {
      const reviewTitle = (updates.title as string) || existing.title
      const reviewContent = (updates.content as string) || existing.content
      const reviewCoverImage = (updates.coverImage as string) || existing.coverImage
      setImmediate(() => {
        try {
          const reviewText = extractReviewText('article', { title: reviewTitle, content: reviewContent })
          const reviewImages = extractReviewImages('article', { coverImage: reviewCoverImage, content: reviewContent })
          scheduleReview({
            targetType: 'article',
            targetId: articleId,
            text: reviewText,
            imageUrls: reviewImages,
          }).catch(err => console.error('Failed to schedule review:', err))
        } catch (err) {
          console.error('Schedule review error:', err)
        }
      })
    }

    revalidateTag('articles')
    revalidateTag('sections')
    await auditLog(req, 'update', 'article', articleId, `Updated article: ${existing.title}`)
    res.json({ success: true, data: article })
  } catch (err) {
    console.error('Update article error:', err)
    console.error('Article ID:', req.params.id, 'Body keys:', Object.keys(req.body), 'Status:', req.body.status)
    res.status(500).json({ success: false, error: 'Failed to update article' })
  }
})

// DELETE /api/v1/admin/articles/:id — user只能删自己的, admin/superadmin可删全部
// ?deleteMedia=true 可选：同时删除关联的媒体文件
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id
    const articleId = parseInt(Array.isArray(id) ? id[0] : id)
    const existing = await db.select().from(articles).where(eq(articles.id, articleId)).get()

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    // user can only delete own articles
    if (req.user!.role === 'user' && existing.authorId !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Cannot delete other users articles' })
    }

    const deleteMedia = req.query.deleteMedia === 'true'
    await performArticleDelete(articleId, deleteMedia)

    revalidateTag('articles')
    revalidateTag('sections')
    await auditLog(req, 'delete', 'article', articleId, `Deleted article: ${existing.title}${deleteMedia ? ' (+media)' : ''}`)
    res.json({
      success: true,
      message: 'Article deleted successfully',
      data: deleteMedia ? { mediaDeleted: true } : undefined,
    })
  } catch (err) {
    console.error('Delete article error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete article' })
  }
})

export default router
