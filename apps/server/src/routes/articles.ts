import { Router } from 'express'
import { db } from '../db/index.js'
import { articles, articleTags, tags, users, categories, sections } from '../db/schema.js'
import { eq, and, desc, sql, like } from 'drizzle-orm'
import type { ContentStatus } from '@tokenpress/shared'

const router = Router()

// GET /api/v1/articles — public
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const sectionSlug = req.query.section as string
    const status = (req.query.status as ContentStatus) || 'published'
    const category = req.query.category as string
    const search = req.query.search as string
    const offset = (page - 1) * limit

    const conditions = [eq(articles.status, status)]

    // Resolve section slug to section ID
    let sectionId: number | null = null
    if (sectionSlug) {
      const section = await db.select().from(sections).where(eq(sections.slug, sectionSlug)).get()
      if (section) {
        sectionId = section.id
        conditions.push(eq(articles.sectionId, sectionId))
      }
    }
    if (category) {
      const categoryId = parseInt(category)
      if (!isNaN(categoryId)) {
        conditions.push(eq(articles.categoryId, categoryId))
      } else {
        const cat = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, category)).get()
        if (cat) {
          conditions.push(eq(articles.categoryId, cat.id))
        }
      }
    }
    if (search) conditions.push(like(articles.title, `%${search}%`))

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(and(...conditions))
      .get()

    const rows = await db.select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      excerpt: articles.excerpt,
      coverImage: articles.coverImage,
      sectionId: articles.sectionId,
      status: articles.status,
      meta: articles.meta,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      pinnedAt: articles.pinnedAt,
      pinnedScope: articles.pinnedScope,
      viewCount: articles.viewCount,
      author: { id: users.id, username: users.username, displayName: users.displayName },
      category: { id: categories.id, name: categories.name, slug: categories.slug },
      section: { id: sections.id, name: sections.name, slug: sections.slug, path: sections.path },
    })
      .from(articles)
      .leftJoin(users, eq(articles.authorId, users.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(sections, eq(articles.sectionId, sections.id))
      .where(and(...conditions))
      // 置顶优先：全局视图仅 global 置顶上浮；板块视图 global+section 置顶上浮
      .orderBy(
        sectionSlug
          ? sql`CASE WHEN ${articles.pinnedScope} IN ('global', 'section') THEN 0 ELSE 1 END ASC`
          : sql`CASE WHEN ${articles.pinnedScope} = 'global' THEN 0 ELSE 1 END ASC`,
        desc(articles.pinnedAt),
        desc(articles.publishedAt),
        desc(articles.createdAt),
      )
      .limit(limit)
      .offset(offset)
      .all()

    const articlesWithTags = await Promise.all(rows.map(async (row) => {
      const t = await db.select({ name: tags.name })
        .from(articleTags)
        .innerJoin(tags, eq(articleTags.tagId, tags.id))
        .where(eq(articleTags.articleId, row.id))
        .all()
      return { ...row, tags: t.map((x) => x.name) }
    }))

    res.json({
      success: true,
      data: articlesWithTags,
      pagination: { page, limit, total: countResult?.count || 0, totalPages: Math.ceil((countResult?.count || 0) / limit) },
    })
  } catch (err) {
    console.error('List articles error:', err)
    res.status(500).json({ success: false, error: 'Failed to list articles' })
  }
})

// GET /api/v1/articles/:id — public
router.get('/:id', async (req, res) => {
  try {
    const idParam = req.params.id
    const idValue = Array.isArray(idParam) ? idParam[0] : idParam
    const isNumeric = /^\d+$/.test(idValue)

    let article = await db.select().from(articles).where(eq(articles.slug, idValue)).get()
    if (!article && isNumeric) {
      article = await db.select().from(articles).where(eq(articles.id, parseInt(idValue))).get()
    }
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    if (article.status !== 'published') {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    // 可选：公开详情浏览量 +1（作品集详情页用于统计，普通文章历史走 articleViews 表，不传 view 即不重复计数）
    if (req.query.view === '1') {
      await db.update(articles)
        .set({ viewCount: (article.viewCount || 0) + 1, updatedAt: new Date().toISOString() })
        .where(eq(articles.id, article.id))
        .run()
    }

    const author = await db.select({
      id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
    }).from(users).where(eq(users.id, article.authorId)).get()

    const category = article.categoryId
      ? await db.select().from(categories).where(eq(categories.id, article.categoryId)).get()
      : null

    const articleTags_ = await db.select({ name: tags.name })
      .from(articleTags)
      .innerJoin(tags, eq(articleTags.tagId, tags.id))
      .where(eq(articleTags.articleId, article.id))
      .all()

    // 解析文章模板配置（template_config 为 JSON 字符串）
    let templateConfig: Record<string, unknown> | null = null
    if (article.templateConfig) {
      try { templateConfig = JSON.parse(article.templateConfig) } catch { templateConfig = null }
    }

    res.json({
      success: true,
      data: {
        ...article,
        articleTemplate: article.articleTemplate || 'standard',
        templateConfig,
        author,
        category,
        tags: articleTags_.map((t) => t.name),
      },
    })
  } catch (err) {
    console.error('Get article error:', err)
    res.status(500).json({ success: false, error: 'Failed to get article' })
  }
})

export default router
