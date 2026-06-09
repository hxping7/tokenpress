import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

export async function migrate() {
  const DB_PATH = getDbPath()
  const client = createClient({
    url: `file:${DB_PATH}`,
  })

  console.log('🔄 Running migration: add article_id to media table...')

  try {
    // 检查列是否已存在（幂等）
    const result = await client.execute(`PRAGMA table_info(media)`)
    const hasColumn = (result.rows as any[]).some(
      (col: any) => col.name === 'article_id'
    )

    if (!hasColumn) {
      await client.execute(`
        ALTER TABLE media ADD COLUMN article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL
      `)
      console.log('  ✅ Added media.article_id column')
    } else {
      console.log('  ⏭️  media.article_id already exists, skipping')
    }
  } finally {
    client.close()
  }
}
