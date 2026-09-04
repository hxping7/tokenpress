import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({ url: `file:${DB_PATH}` })

  console.log('🔄 Running migration: add layouts TEXT column to sections table...')

  try {
    const info = await client.execute(`PRAGMA table_info(sections)`)
    const columns = (info.rows as any[]).map((c: any) => c.name)

    if (columns.includes('layouts')) {
      console.log('  ⏭️  sections.layouts column already exists, skipping')
      return
    }

    await client.execute(`ALTER TABLE sections ADD COLUMN layouts TEXT DEFAULT NULL`)
    console.log('  ✅ Added sections.layouts TEXT column')
    console.log('✅ 0017 migration completed')
  } finally {
    client.close()
  }
}
