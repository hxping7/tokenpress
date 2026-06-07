import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking sensitive_keywords migration...')

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sensitive_keywords (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword     TEXT    NOT NULL UNIQUE,
        category    TEXT    NOT NULL DEFAULT 'general',
        severity    TEXT    NOT NULL DEFAULT 'medium',
        action      TEXT    NOT NULL DEFAULT 'review',
        scope       TEXT    NOT NULL DEFAULT 'all',
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_by  INTEGER REFERENCES users(id),
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_sensitive_keywords_enabled ON sensitive_keywords(enabled)
    `)
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_sensitive_keywords_scope ON sensitive_keywords(scope)
    `)

    console.log('✅ sensitive_keywords table created')
  } catch (err) {
    console.log('✅ sensitive_keywords migration skipped (table may already exist)')
  }
}
