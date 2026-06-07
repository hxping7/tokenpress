/**
 * 添加 'claw' section 到数据库
 * 运行: node scripts/migrate-add-claw.mjs
 */

import { createClient } from '@libsql/client'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../data')

const client = createClient({
  url: `file:${path.join(DATA_DIR, 'token00.db')}`,
})

async function migrate() {
  console.log('🔄 Adding claw section...')

  try {
    // SQLite doesn't support ALTER TABLE to modify CHECK constraints
    // We need to recreate the tables

    // 1. Create new articles table with claw section
    await client.execute(`
      CREATE TABLE IF NOT EXISTS articles_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        excerpt TEXT,
        cover_image TEXT,
        section TEXT NOT NULL CHECK(section IN ('token_plan','ai_coding','ai_works','blog','claw')),
        category_id INTEGER REFERENCES categories(id),
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
        author_id INTEGER NOT NULL REFERENCES users(id),
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    console.log('  ✅ Created articles_new table')

    // 2. Copy data
    await client.execute(`
      INSERT INTO articles_new SELECT * FROM articles
    `)
    console.log('  ✅ Copied articles data')

    // 3. Drop old table
    await client.execute(`DROP TABLE articles`)
    console.log('  ✅ Dropped old articles table')

    // 4. Rename new table
    await client.execute(`ALTER TABLE articles_new RENAME TO articles`)
    console.log('  ✅ Renamed articles_new to articles')

    // 5. Recreate indexes
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_articles_section ON articles(section)`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id)`)
    console.log('  ✅ Recreated indexes')

    // 6. Same for categories table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS categories_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        section TEXT NOT NULL CHECK(section IN ('token_plan','ai_coding','ai_works','blog','claw')),
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)
    await client.execute(`INSERT INTO categories_new SELECT * FROM categories`)
    await client.execute(`DROP TABLE categories`)
    await client.execute(`ALTER TABLE categories_new RENAME TO categories`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_categories_section ON categories(section)`)
    console.log('  ✅ Updated categories table')

    console.log('\n✅ Migration completed! Claw section added.')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  }

  process.exit(0)
}

migrate()
