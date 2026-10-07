import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

/**
 * 0023: sections 增加 external_url_target —— 外链板块的打开方式。
 * 取值 '_blank'（新窗口，默认）/ '_self'（当前窗口）。
 */
export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({ url: `file:${DB_PATH}` })

  console.log('🔄 Running migration: add external_url_target column to sections table...')

  try {
    const info = await client.execute(`PRAGMA table_info(sections)`)
    const columns = (info.rows as any[]).map((c: any) => c.name)

    if (columns.includes('external_url_target')) {
      console.log('  ⏭️  sections.external_url_target column already exists, skipping')
      return
    }

    await client.execute(
      `ALTER TABLE sections ADD COLUMN external_url_target TEXT NOT NULL DEFAULT '_blank'`
    )
    console.log('  ✅ Added sections.external_url_target TEXT NOT NULL DEFAULT _blank')
    console.log('✅ 0023 migration completed')
  } finally {
    client.close()
  }
}
