import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking media review fields migration...')

  try {
    await client.execute(`ALTER TABLE media ADD COLUMN is_reviewed INTEGER DEFAULT 0`)
    console.log('✅ Added is_reviewed column to media')
  } catch {
    console.log('✅ is_reviewed column already exists in media')
  }

  try {
    await client.execute(`ALTER TABLE media ADD COLUMN review_note TEXT`)
    console.log('✅ Added review_note column to media')
  } catch {
    console.log('✅ review_note column already exists in media')
  }
}
