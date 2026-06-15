import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { db } from '../db/index.js'
import { articles, articleTags, tags, categories, sections, media, articleLikes, articleViews, adLogs, users, siteSettings } from '../db/schema.js'
import { eq, and, inArray, isNull, sql } from 'drizzle-orm'
import { apiTokenAuth, requirePermission, type ApiAuthRequest } from '../middleware/apiToken.js'
import { generateSlug, extractExcerpt } from '@tokenpress/shared'
import type { ContentStatus } from '@tokenpress/shared'
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

    // 防御性处理：去除 coverImageUrl 可能的引号包裹
    if (coverImageUrl && typeof coverImageUrl === 'string') {
      coverImageUrl = coverImageUrl.trim()
      if (
        coverImageUrl.length >= 2 &&
        coverImageUrl[0] === coverImageUrl[coverImageUrl.length - 1] &&
        (coverImageUrl[0] === '"' || coverImageUrl[0] === "'")
      ) {
        coverImageUrl = coverImageUrl.slice(1, -1)
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
      status: effectiveStatus,
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
