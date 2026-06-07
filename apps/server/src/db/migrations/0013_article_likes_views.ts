import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking article likes/views migration...')

  const likesExists = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='article_likes'`
  )
  const viewsExists = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='article_views'`
  )

  if (likesExists.rows.length === 0) {
    console.log('🔄 Creating article_likes table...')

    await client.execute(`
      CREATE TABLE article_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        ip_address TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
      )
    `)

    await client.execute(`CREATE UNIQUE INDEX idx_article_likes_unique ON article_likes (article_id, ip_address)`)
    await client.execute(`CREATE INDEX idx_article_likes_article ON article_likes (article_id)`)

    console.log('✅ article_likes table created')
  }

  if (viewsExists.rows.length === 0) {
    console.log('🔄 Creating article_views table...')

    await client.execute(`
      CREATE TABLE article_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        referer TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
      )
    `)

    await client.execute(`CREATE INDEX idx_article_views_article ON article_views (article_id)`)
    await client.execute(`CREATE INDEX idx_article_views_created ON article_views (created_at)`)
    await client.execute(`CREATE INDEX idx_article_views_ip ON article_views (ip_address)`)

    console.log('✅ article_views table created')
  }

  console.log('✅ Article likes/views migration complete')
}