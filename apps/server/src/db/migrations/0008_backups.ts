import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Running backups migration...')

  const statements = [
    `CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(type)`,
  ]

  for (const stmt of statements) {
    await client.execute(stmt)
  }

  console.log('✅ Backups table created successfully')
}
