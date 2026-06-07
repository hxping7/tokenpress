import { Router } from 'express'
import { db, client } from '../db/index.js'
import { sql } from 'drizzle-orm'

const router = Router()

// GET /api/v1/tags - 获取热门标签
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))

    const result = await client.execute(
      `SELECT t.id, t.name, COUNT(at.article_id) as article_count
       FROM tags t
       LEFT JOIN article_tags at ON t.id = at.tag_id
       GROUP BY t.id, t.name
       HAVING article_count > 0
       ORDER BY article_count DESC
       LIMIT ${limit}`
    )

    return res.json({
      success: true,
      data: result.rows,
    })
  } catch (error: any) {
    console.error('Tags error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '获取标签失败',
    })
  }
})

export default router