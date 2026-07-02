import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({
    url: `file:${DB_PATH}`,
  })

  console.log('🔄 Running migration: add hero carousel settings...')

  try {
    // 插入新的设置项（如果不存在）
    const settings = [
      { key: 'hero_carousel_use_articles', value: 'false' },
      { key: 'hero_carousel_article_source', value: 'latest' },
      { key: 'hero_carousel_max_items', value: '5' },
    ]

    for (const setting of settings) {
      // 检查设置项是否已存在
      const result = await client.execute({
        sql: 'SELECT COUNT(*) as count FROM site_settings WHERE key = ?',
        args: [setting.key],
      })

      const count = (result.rows[0] as any).count

      if (count === 0) {
        await client.execute({
          sql: 'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))',
          args: [setting.key, setting.value],
        })
        console.log(`  ✅ Added setting: ${setting.key} = ${setting.value}`)
      } else {
        console.log(`  ⏭️  Setting already exists: ${setting.key}, skipping`)
      }
    }

    console.log('✅ Hero carousel settings migration completed')
  } finally {
    client.close()
  }
}
