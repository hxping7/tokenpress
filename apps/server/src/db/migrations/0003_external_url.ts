import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking external_url migration...')

  // Check if external_url column already exists
  const columnsResult = await client.execute(
    `PRAGMA table_info(sections)`
  )

  const hasExternalUrl = columnsResult.rows.some(
    (row) => row.name === 'external_url'
  )

  if (!hasExternalUrl) {
    console.log('🔄 Adding external_url column to sections table...')
    await client.execute(`ALTER TABLE sections ADD COLUMN external_url TEXT`)
    console.log('✅ external_url column added')
  } else {
    console.log('✅ external_url column already exists')
  }
}