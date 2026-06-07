import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking content_review_enabled setting...')

  try {
    const result = await client.execute(
      "SELECT value FROM site_settings WHERE key = 'content_review_enabled'"
    )

    if (result.rows.length === 0) {
      await client.execute({
        sql: `INSERT INTO site_settings (key, value) VALUES (?, ?)`,
        args: ['content_review_enabled', 'false']
      })
      console.log('✅ Added content_review_enabled setting (default: false)')
    } else {
      console.log('✅ content_review_enabled setting already exists')
    }
  } catch (err) {
    console.log('❌ Migration failed:', err)
  }
}