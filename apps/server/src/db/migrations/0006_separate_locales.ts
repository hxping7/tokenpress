import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking separate locale settings migration...')

  // Add frontend_locale if not exists
  const checkFrontendLocale = await client.execute(
    `SELECT value FROM site_settings WHERE key = 'frontend_locale'`
  )
  if (checkFrontendLocale.rows.length === 0) {
    await client.execute({
      sql: `INSERT INTO site_settings (key, value) VALUES (?, ?)`,
      args: ['frontend_locale', 'zh']
    })
    console.log('✅ Added frontend_locale setting')
  }

  // Add backend_locale if not exists
  const checkBackendLocale = await client.execute(
    `SELECT value FROM site_settings WHERE key = 'backend_locale'`
  )
  if (checkBackendLocale.rows.length === 0) {
    await client.execute({
      sql: `INSERT INTO site_settings (key, value) VALUES (?, ?)`,
      args: ['backend_locale', 'zh']
    })
    console.log('✅ Added backend_locale setting')
  }

  console.log('✅ Separate locale settings migration complete')
}