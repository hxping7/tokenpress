import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking review_cloud_provider setting...')

  try {
    const result = await client.execute(
      "SELECT value FROM site_settings WHERE key = 'review_cloud_provider'"
    )

    if (result.rows.length === 0) {
      await client.execute({
        sql: `INSERT INTO site_settings (key, value) VALUES (?, ?)`,
        args: ['review_cloud_provider', 'none']
      })
      console.log('✅ Added review_cloud_provider setting (default: none)')
    } else {
      console.log('✅ review_cloud_provider setting already exists')
    }
  } catch (err) {
    console.log('❌ Migration failed:', err)
  }
}
