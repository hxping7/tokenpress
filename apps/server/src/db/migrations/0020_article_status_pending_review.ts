import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Adding pending_review to article status...')

  try {
    // Get current table info
    const tableInfo = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='articles'")
    const currentSql = tableInfo.rows[0].sql as string

    if (currentSql.includes("'pending_review'")) {
      console.log('✅ pending_review already allowed')
      return
    }

    // Recreate table with updated constraint
    await client.execute('PRAGMA foreign_keys=OFF')

    await client.execute('ALTER TABLE articles RENAME TO articles_old')

    await client.execute(`
      CREATE TABLE articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE,
        content TEXT NOT NULL,
        excerpt TEXT,
        cover_image TEXT,
        section_id INTEGER NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived','scheduled','pending_review')),
        view_count INTEGER NOT NULL DEFAULT 0,
        author_id INTEGER NOT NULL REFERENCES users(id),
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await client.execute(`
      INSERT INTO articles SELECT * FROM articles_old
    `)

    await client.execute('DROP TABLE articles_old')
    await client.execute('PRAGMA foreign_keys=ON')

    console.log('✅ Added pending_review to article status')
  } catch (err) {
    console.log('❌ Migration failed:', err)
  }
}