import { Router } from 'express'
import { client } from '../db/index.js'

const router = Router()

// GET /api/v1/search?q=关键词&section=slug&page=1&limit=20
router.get('/', async (req, res) => {
  try {
    const q = req.query.q as string
    const section = req.query.section as string
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit

    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      })
    }

    // 清理搜索词，防止 FTS5 语法注入
    const cleanQuery = q
      .replace(/['"]/g, '')
      .replace(/[()*/:]/g, ' ')
      .trim()

    if (cleanQuery.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      })
    }

    // 构建查询
    let countSql: string
    let resultsSql: string

    if (section) {
      countSql = `SELECT COUNT(*) as count FROM articles_fts
         JOIN articles a ON articles_fts.rowid = a.id
         JOIN sections s ON a.section_id = s.id
         WHERE articles_fts MATCH ? AND a.status = 'published' AND s.slug = ?`

      resultsSql = `SELECT
            a.id,
            a.title,
            a.slug,
            a.excerpt,
            a.cover_image as coverImage,
            a.published_at as publishedAt,
            s.name as sectionName,
            s.slug as sectionSlug,
            s.path as sectionPath,
            highlight(articles_fts, 0, '<mark>', '</mark>') as titleHighlight,
            snippet(articles_fts, 1, '<mark>', '</mark>', '...', 32) as contentSnippet
          FROM articles_fts
          JOIN articles a ON articles_fts.rowid = a.id
          JOIN sections s ON a.section_id = s.id
          WHERE articles_fts MATCH ? AND a.status = 'published' AND s.slug = ?
          ORDER BY rank
          LIMIT ? OFFSET ?`
    } else {
      countSql = `SELECT COUNT(*) as count FROM articles_fts
         JOIN articles a ON articles_fts.rowid = a.id
         WHERE articles_fts MATCH ? AND a.status = 'published'`

      resultsSql = `SELECT
            a.id,
            a.title,
            a.slug,
            a.excerpt,
            a.cover_image as coverImage,
            a.published_at as publishedAt,
            s.name as sectionName,
            s.slug as sectionSlug,
            s.path as sectionPath,
            highlight(articles_fts, 0, '<mark>', '</mark>') as titleHighlight,
            snippet(articles_fts, 1, '<mark>', '</mark>', '...', 32) as contentSnippet
          FROM articles_fts
          JOIN articles a ON articles_fts.rowid = a.id
          JOIN sections s ON a.section_id = s.id
          WHERE articles_fts MATCH ? AND a.status = 'published'
          ORDER BY rank
          LIMIT ? OFFSET ?`
    }

    // 查询总数
    const countResult = section
      ? await client.execute({ sql: countSql, args: [cleanQuery, section] })
      : await client.execute({ sql: countSql, args: [cleanQuery] })

    const total = Number(countResult.rows[0]?.count) || 0

    // 查询结果
    const results = section
      ? await client.execute({ sql: resultsSql, args: [cleanQuery, section, limit, offset] })
      : await client.execute({ sql: resultsSql, args: [cleanQuery, limit, offset] })

    return res.json({
      success: true,
      data: results.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '搜索失败',
    })
  }
})

export default router