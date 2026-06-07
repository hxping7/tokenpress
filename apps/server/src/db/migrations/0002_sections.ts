import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking sections migration...')

  // Check if sections table exists
  const tablesResult = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='sections'`
  )

  const defaultSections = [
    { name: 'Token 计划', slug: 'token_plan', path: '/token-plan', description: 'Token 计划相关内容', sortOrder: 0 },
    { name: 'AI 编程', slug: 'ai_coding', path: '/ai-coding', description: 'AI 编程教程与项目', sortOrder: 1 },
    { name: 'AI 作品', slug: 'ai_works', path: '/ai-works', description: 'AI 生成作品展示', sortOrder: 2 },
    { name: '博客', slug: 'blog', path: '/blog', description: '博客文章', sortOrder: 3 },
  ]

  if (tablesResult.rows.length === 0) {
    console.log('🔄 Running sections migration (upgrade from old schema)...')

    // 1. Create sections table
    await client.execute(`
      CREATE TABLE sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        path TEXT NOT NULL UNIQUE,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 2. Insert default sections
    for (const section of defaultSections) {
      await client.execute({
        sql: `INSERT INTO sections (name, slug, path, description, sort_order) VALUES (?, ?, ?, ?, ?)`,
        args: [section.name, section.slug, section.path, section.description, section.sortOrder]
      })
    }

    // 3. Add section_id to categories table
    await client.execute(`ALTER TABLE categories ADD COLUMN section_id INTEGER`)

    // Migrate data: copy section string to section_id
    await client.execute(`
      UPDATE categories SET section_id = (
        SELECT id FROM sections WHERE sections.slug = categories.section
      )
    `)

    // 4. Add section_id to articles table
    await client.execute(`ALTER TABLE articles ADD COLUMN section_id INTEGER`)

    await client.execute(`
      UPDATE articles SET section_id = (
        SELECT id FROM sections WHERE sections.slug = articles.section
      )
    `)

    // Create indexes
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_categories_section ON categories(section_id)`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_articles_section ON articles(section_id)`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_sections_sort ON sections(sort_order)`)

    console.log('✅ Sections migration completed')
  } else {
    console.log('✅ Sections table already exists, checking default data...')

    // Check and insert default sections if missing
    for (const section of defaultSections) {
      const exists = await client.execute({
        sql: `SELECT id FROM sections WHERE slug = ?`,
        args: [section.slug]
      })
      if (exists.rows.length === 0) {
        await client.execute({
          sql: `INSERT INTO sections (name, slug, path, description, sort_order) VALUES (?, ?, ?, ?, ?)`,
          args: [section.name, section.slug, section.path, section.description, section.sortOrder]
        })
        console.log(`  ✅ Added missing section: ${section.name}`)
      }
    }
  }
}
