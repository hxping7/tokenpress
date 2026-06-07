import { Router } from 'express'
import { db } from '../db/index.js'
import { articles, articleTags, tags, categories, sections } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { apiTokenAuth, requirePermission, type ApiAuthRequest } from '../middleware/apiToken.js'
import { generateSlug, extractExcerpt } from '@tokenpress/shared'
import type { ContentStatus } from '@tokenpress/shared'
import { getParam } from '../utils/params.js'
import { revalidateTag, revalidatePath } from '../utils/revalidate.js'
import { scheduleReview } from '../lib/contentReview/index.js'
import { extractText } from '../lib/contentReview/extractText.js'
import { extractImages } from '../lib/contentReview/extractImages.js'

const router = Router()
router.use(apiTokenAuth)

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
    } = req.body

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

    // Determine status — published articles go through review first
    const requestedStatus: ContentStatus = status || 'draft'
    if (!['draft', 'published', 'archived'].includes(requestedStatus)) {
      return res.status(400).json({ success: false, error: `Invalid status "${status}"` })
    }
    const articleStatus: ContentStatus = requestedStatus === 'published' ? 'pending_review' : requestedStatus

    // Generate slug
    let slug = customSlug || generateSlug(title)

    // Check if article with same slug exists (update if so)
    const existing = await db.select().from(articles).where(eq(articles.slug, slug)).get()

    if (existing) {
      // Update existing article
      const effectiveStatus: ContentStatus = requestedStatus === 'published' ? 'pending_review' : requestedStatus
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

      // Schedule content review for updated articles going to pending_review
      if (effectiveStatus === 'pending_review') {
        const reviewText = extractText('article', { title, content })
        const reviewImages = extractImages('article', { coverImage: coverImageUrl, content })
        scheduleReview({
          targetType: 'article',
          targetId: existing.id,
          text: reviewText,
          imageUrls: reviewImages,
        }).catch(err => console.error('Failed to schedule review:', err))
      }

      return res.json({
        success: true,
        data: {
          id: article!.id,
          slug: article!.slug,
          url: `${process.env.SITE_URL || 'http://localhost:4000'}${section.path}/${article!.slug}`,
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

    // Resolve category
    let categoryId: number | null = null
    if (category) {
      const cat = await db.select().from(categories)
        .where(and(
          eq(categories.slug, category),
          eq(categories.sectionId, sectionId)
        )).get()

      if (!cat) {
        // Try by name
        const catByName = await db.select().from(categories)
          .where(eq(categories.name, category)).get()
        if (catByName) categoryId = catByName.id
      } else {
        categoryId = cat.id
      }
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
      status: articleStatus,
      authorId: req.apiToken!.userId,
      publishedAt: (requestedStatus === 'published')
        ? publishedAt || new Date().toISOString()
        : publishedAt || null,
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

    // Schedule content review for pending_review articles
    if (articleStatus === 'pending_review') {
      const reviewText = extractText('article', { title, content })
      const reviewImages = extractImages('article', { coverImage: coverImageUrl, content })
      scheduleReview({
        targetType: 'article',
        targetId: articleId,
        text: reviewText,
        imageUrls: reviewImages,
      }).catch(err => console.error('Failed to schedule review:', err))
    }

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

    const rows = await db.select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      sectionId: articles.sectionId,
      publishedAt: articles.publishedAt,
      section: { id: sections.id, name: sections.name, slug: sections.slug, path: sections.path },
    })
      .from(articles)
      .leftJoin(sections, eq(articles.sectionId, sections.id))
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .limit(limit)
      .offset(offset)
      .all()

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total: rows.length },
    })
  } catch (err) {
    console.error('AI list articles error:', err)
    res.status(500).json({ success: false, error: 'Failed to list articles' })
  }
})

// DELETE /api/v1/ai/articles/:slug — delete article by slug
router.delete('/articles/:slug', requirePermission('content:delete'), async (req: ApiAuthRequest, res) => {
  try {
    const slug = getParam(req.params.slug)
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Invalid slug' })
    }
    const article = await db.select().from(articles).where(eq(articles.slug, slug)).get()
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    await db.delete(articleTags).where(eq(articleTags.articleId, article.id)).run()
    await db.delete(articles).where(eq(articles.id, article.id)).run()

    res.json({ success: true, message: 'Article deleted successfully' })
  } catch (err) {
    console.error('AI delete article error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete article' })
  }
})

export default router
