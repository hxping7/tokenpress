import { Router } from 'express'
import { db } from '../db/index.js'
import { articles, articleTags, tags, categories, sections } from '../db/schema.js'
import { eq, and, desc, sql, like } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { generateSlug, extractExcerpt } from '@token00/shared'
import type { ContentStatus } from '@token00/shared'
import { revalidateTag } from '../utils/revalidate.js'
import { auditLog } from '../utils/auditLogger.js'
import { scheduleReview } from '../lib/contentReview/index.js'
import { extractText as extractReviewText } from '../lib/contentReview/extractText.js'
import { extractImages as extractReviewImages } from '../lib/contentReview/extractImages.js'

const router = Router()

router.use(authMiddleware)

// GET /api/v1/admin/articles — admin/superadmin看全部, user只看自己的
router.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const sectionSlug = req.query.section as string
    const status = req.query.status as string
    const search = req.query.search as string
    const offset = (page - 1) * limit

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
      section: { id: sections.id, name: sections.name, slug: sections.slug, path: sections.path },
    })
      .from(articles)
      .leftJoin(sections, eq(articles.sectionId, sections.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(articles.createdAt))
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

    // Schedule content review for pending_review articles
    if (articleStatus === 'pending_review') {
      const reviewText = extractReviewText('article', { title, content })
      const reviewImages = extractReviewImages('article', { coverImage, content })
      scheduleReview({
        targetType: 'article',
        targetId: articleId,
        text: reviewText,
        imageUrls: reviewImages,
      }).catch(err => console.error('Failed to schedule review:', err))
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
      const effectiveStatus = req.body.status === 'published' ? 'pending_review' : req.body.status
      updates.status = effectiveStatus
      if (req.body.status === 'published' && !existing.publishedAt) {
        updates.publishedAt = new Date().toISOString()
      }
      if (effectiveStatus === 'scheduled' && req.body.publishedAt) {
        updates.publishedAt = req.body.publishedAt
      }
    }
    if (req.body.publishedAt !== undefined) updates.publishedAt = req.body.publishedAt

    await db.update(articles).set(updates).where(eq(articles.id, articleId)).run()

    if (req.body.tags !== undefined) {
      await db.delete(articleTags).where(eq(articleTags.articleId, articleId)).run()

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

    // Schedule content review if status changed to pending_review
    if (req.body.status === 'published') {
      const reviewText = extractReviewText('article', {
        title: (updates.title as string) || existing.title,
        content: (updates.content as string) || existing.content,
      })
      const reviewImages = extractReviewImages('article', {
        coverImage: (updates.coverImage as string) || existing.coverImage,
        content: (updates.content as string) || existing.content,
      })
      scheduleReview({
        targetType: 'article',
        targetId: articleId,
        text: reviewText,
        imageUrls: reviewImages,
      }).catch(err => console.error('Failed to schedule review:', err))
    }

    revalidateTag('articles')
    revalidateTag('sections')
    await auditLog(req, 'update', 'article', articleId, `Updated article: ${existing.title}`)
    res.json({ success: true, data: article })
  } catch (err) {
    console.error('Update article error:', err)
    res.status(500).json({ success: false, error: 'Failed to update article' })
  }
})

// DELETE /api/v1/admin/articles/:id — user只能删自己的, admin/superadmin可删全部
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

    await db.delete(articleTags).where(eq(articleTags.articleId, articleId)).run()
    await db.delete(articles).where(eq(articles.id, articleId)).run()

    revalidateTag('articles')
    revalidateTag('sections')
    await auditLog(req, 'delete', 'article', articleId, `Deleted article: ${existing.title}`)
    res.json({ success: true, message: 'Article deleted successfully' })
  } catch (err) {
    console.error('Delete article error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete article' })
  }
})

export default router
