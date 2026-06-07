import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking scheduled articles migration...')

  try {
    const result = await client.execute(`
      UPDATE articles SET status = 'scheduled'
      WHERE status = 'draft'
        AND published_at IS NOT NULL
        AND published_at > datetime('now')
    `)
    if (result.rowsAffected > 0) {
      console.log(`✅ ${result.rowsAffected} draft articles with future publishedAt migrated to scheduled`)
    } else {
      console.log('✅ No draft articles to migrate to scheduled')
    }
  } catch (err) {
    console.log('✅ Scheduled articles migration skipped')
  }
}
