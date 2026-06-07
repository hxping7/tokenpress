import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking api_logs migration...')

  // Check if content_url column exists
  const tableInfo = await client.execute(
    `PRAGMA table_info(api_logs)`
  )

  const hasContentUrl = tableInfo.rows.some((col: any) => col.name === 'content_url')

  if (!hasContentUrl) {
    console.log('🔄 Adding content_url column to api_logs...')
    await client.execute(
      `ALTER TABLE api_logs ADD COLUMN content_url TEXT`
    )
    console.log('✅ Added content_url column')
  } else {
    console.log('✅ content_url column already exists')
  }
}