import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

/**
 * 0018: 为「设计师作品」内容形态补齐 sections.kind 列与 design_works 表。
 *
 * 注：本迁移**不再写入任何板块与示例数据**。
 * 内容模型已在 0020 收敛：design_works 并入 articles（作品字段存 meta.kind='design_work'），
 * 「设计师作品」板块不再预置——板块由站点自行组织（如「作品集」/works）。
 * 迁移器每次启动全量重跑，故此前的「不存在则补建板块 + 种示例作品」会让板块与作品
 * 在每次重启后重新长出来（配合 0020 的合并逻辑，表现为内容不断重复）。
 */
export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({ url: `file:${DB_PATH}` })

  console.log('🔄 Running migration: add design_works + sections.kind...')

  try {
    // 1) sections.kind 列
    const sectionInfo = await client.execute(`PRAGMA table_info(sections)`)
    const sectionCols = (sectionInfo.rows as any[]).map((c: any) => c.name)
    if (!sectionCols.includes('kind')) {
      await client.execute(`ALTER TABLE sections ADD COLUMN kind TEXT NOT NULL DEFAULT 'articles'`)
      console.log('  ✅ Added sections.kind column')
    } else {
      console.log('  ⏭️  sections.kind already exists, skipping')
    }

    // 2) design_works 表（0020 会将其数据并入 articles 后 DROP）
    await client.execute(`
      CREATE TABLE IF NOT EXISTS design_works (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        cover_image TEXT,
        summary TEXT,
        content TEXT,
        author_name TEXT,
        author_avatar TEXT,
        category TEXT,
        tags TEXT,
        external_url TEXT,
        gallery_images TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        sort_order INTEGER NOT NULL DEFAULT 0,
        view_count INTEGER NOT NULL DEFAULT 0,
        section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    console.log('  ✅ Ensured design_works table exists')

    console.log('✅ 0018 migration completed')
  } finally {
    client.close()
  }
}
