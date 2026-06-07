import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking friend_links migration...')

  // Check if friend_links table exists
  const tablesResult = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='friend_links'`
  )

  if (tablesResult.rows.length === 0) {
    console.log('🔄 Creating friend_links table...')

    await client.execute(`
      CREATE TABLE friend_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Insert some default friend links
    const defaultLinks = [
      { name: 'TokenCode', url: 'https://tokencode.com', sortOrder: 0 },
    ]

    for (const link of defaultLinks) {
      await client.execute({
        sql: `INSERT INTO friend_links (name, url, sort_order) VALUES (?, ?, ?)`,
        args: [link.name, link.url, link.sortOrder]
      })
    }

    console.log('✅ friend_links table created with default data')
  } else {
    console.log('✅ friend_links table already exists')
  }
}