import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({
    url: `file:${DB_PATH}`,
  })

  console.log('🔄 Running migration: add article pin columns...')

  try {
    const result = await client.execute(`PRAGMA table_info(articles)`)
    const columns = (result.rows as any[]).map((c: any) => c.name)

    // 置顶时间：非空即已置顶
    if (!columns.includes('pinned_at')) {
      await client.execute(`ALTER TABLE articles ADD COLUMN pinned_at TEXT`)
      console.log('  ✅ Added articles.pinned_at column')
    } else {
      console.log('  ⏭️  articles.pinned_at already exists, skipping')
    }

    // 置顶范围：global=全局置顶，section=板块内置顶
    if (!columns.includes('pinned_scope')) {
      await client.execute(`ALTER TABLE articles ADD COLUMN pinned_scope TEXT`)
      console.log('  ✅ Added articles.pinned_scope column')
    } else {
      console.log('  ⏭️  articles.pinned_scope already exists, skipping')
    }
  } finally {
    client.close()
  }
}
