import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

/**
 * 0020: 将 design_works 表并入 articles 表。
 *
 * 设计作品集本质是"另一种内容形态"，与文章共用板块/分类/标签/封面等概念。
 * 为避免每新增一种内容类型就新建一张表，这里统一到 articles：
 *   - articles 增加 meta(TEXT, JSON) 存储作品专属字段；sort_order 用于排序
 *   - design_works 行（含示例数据）整体并入 articles，section_id 保留
 *   - 作品专属字段（summary/authorName/authorAvatar/category/tags/externalUrl/galleryImages）
 *     全部塞进 meta.kind='design_work' 的 JSON 中
 *   - 随后删除 design_works 表
 *
 * 不重建 articles 表：content / author_id 保持 NOT NULL，
 * 迁移时作品 content 用 '' 兜底、author_id 用首个用户兜底。
 */
export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({ url: `file:${DB_PATH}` })

  console.log('🔄 Running migration 0020: merge design_works into articles...')

  try {
    // 幂等：若 design_works 已不存在，说明已合并过
    const dwCheck = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='design_works'`
    )
    if ((dwCheck.rows as any[]).length === 0) {
      console.log('  ⏭️  design_works already merged, skipping')
      return
    }

    // 1) 给 articles 增加 meta 与 sort_order
    const info = await client.execute(`PRAGMA table_info(articles)`)
    const cols = (info.rows as any[]).map((c: any) => c.name)
    if (!cols.includes('meta')) {
      await client.execute(`ALTER TABLE articles ADD COLUMN meta TEXT`)
      console.log('  ✅ Added articles.meta column')
    }
    if (!cols.includes('sort_order')) {
      await client.execute(`ALTER TABLE articles ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)
      console.log('  ✅ Added articles.sort_order column')
    }

    // 2) 取首个用户作为迁移作品的 author_id（articles.author_id 为 NOT NULL）
    const userRes = await client.execute(`SELECT id FROM users ORDER BY id LIMIT 1`)
    const defaultAuthorId = (userRes.rows as any[])[0]?.id ?? 1

    // 3) 合并数据
    // 使用 INSERT OR IGNORE 保证幂等：若上次迁移在插入后、DROP 前崩溃，
    // 已合并的行（slug 形如 <slug>-dw<id>）会再次生成相同 slug 而被忽略，
    // 未合并的行照常插入，最终 DROP 成功，避免 UNIQUE 冲突导致无限重启。
    await client.execute({
      sql: `
        INSERT OR IGNORE INTO articles
          (title, slug, content, excerpt, cover_image, section_id, status, view_count,
           author_id, meta, sort_order, published_at, created_at, updated_at)
        SELECT
          dw.title,
          CASE
            WHEN EXISTS (SELECT 1 FROM articles a WHERE a.slug = dw.slug)
            THEN dw.slug || '-dw' || dw.id
            ELSE dw.slug
          END,
          COALESCE(dw.content, ''),
          dw.summary,
          dw.cover_image,
          dw.section_id,
          dw.status,
          dw.view_count,
          ${defaultAuthorId},
          json_object(
            'kind', 'design_work',
            'summary', dw.summary,
            'authorName', dw.author_name,
            'authorAvatar', dw.author_avatar,
            'category', dw.category,
            'tags', CASE WHEN dw.tags IS NULL THEN NULL ELSE json(dw.tags) END,
            'externalUrl', dw.external_url,
            'galleryImages', CASE WHEN dw.gallery_images IS NULL THEN NULL ELSE json(dw.gallery_images) END
          ),
          dw.sort_order,
          dw.published_at,
          dw.created_at,
          dw.updated_at
        FROM design_works dw
      `,
      args: [],
    })
    console.log('  ✅ Migrated design_works rows into articles')

    // 4) 删除旧表
    await client.execute(`DROP TABLE design_works`)
    console.log('  ✅ Dropped design_works table')
    console.log('✅ 0020 migration completed')
  } finally {
    client.close()
  }
}
