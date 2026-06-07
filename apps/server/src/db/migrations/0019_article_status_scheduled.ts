import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking article status constraint migration...')

  try {
    // Check current constraint
    const tableInfo = await client.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='articles'")
    const currentSql = tableInfo.rows[0].sql as string

    if (currentSql.includes("'scheduled'")) {
      console.log('✅ Article status already allows scheduled')
      return
    }

    // Drop old check constraint and add new one
    // Note: SQLite doesn't support DROP CONSTRAINT directly, so we recreate the table
    await client.execute('PRAGMA foreign_keys=OFF')

    // Rename existing table
    await client.execute('ALTER TABLE articles RENAME TO articles_old')

    // Create new table with updated constraint
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

    // Copy data from old table
    await client.execute(`
      INSERT INTO articles (id, title, slug, content, excerpt, cover_image, section_id, category_id, status, view_count, author_id, published_at, created_at, updated_at)
      SELECT id, title, slug, content, excerpt, cover_image, section_id, category_id, status, view_count, author_id, published_at, created_at, updated_at
      FROM articles_old
    `)

    // Drop old table
    await client.execute('DROP TABLE articles_old')

    await client.execute('PRAGMA foreign_keys=ON')

    console.log('✅ Article status constraint updated to allow scheduled')
  } catch (err) {
    console.log('❌ Migration failed:', err)
  }
}