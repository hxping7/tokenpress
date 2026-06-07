import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking ads system migration...')

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ads (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        position           TEXT    NOT NULL,
        title              TEXT    NOT NULL,
        code               TEXT    NOT NULL,
        status             TEXT    NOT NULL DEFAULT 'pending_review',
        priority           INTEGER NOT NULL DEFAULT 0,
        start_at           TEXT,
        end_at             TEXT,
        target_sections    TEXT,
        target_categories  TEXT,
        max_impressions    INTEGER,
        max_clicks         INTEGER,
        impressions        INTEGER NOT NULL DEFAULT 0,
        clicks             INTEGER NOT NULL DEFAULT 0,
        is_active          INTEGER NOT NULL DEFAULT 1,
        created_by         INTEGER NOT NULL REFERENCES users(id),
        created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `)
    console.log('✅ Created ads table')
  } catch {
    console.log('✅ ads table already exists')
  }

  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_ads_position_status ON ads(position, status)`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_ads_status_startat ON ads(status, start_at)`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_ads_status_endat ON ads(status, end_at)`)
    console.log('✅ Created ads indexes')
  } catch {
    console.log('✅ ads indexes already exist')
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ad_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ad_id       INTEGER REFERENCES ads(id) ON DELETE SET NULL,
        article_id  INTEGER REFERENCES articles(id) ON DELETE SET NULL,
        ip_address  TEXT    NOT NULL,
        user_agent  TEXT,
        referer     TEXT,
        type        TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `)
    console.log('✅ Created ad_logs table')
  } catch {
    console.log('✅ ad_logs table already exists')
  }

  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_ad_logs_ad_id ON ad_logs(ad_id)`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_ad_logs_type_created ON ad_logs(type, created_at)`)
    console.log('✅ Created ad_logs indexes')
  } catch {
    console.log('✅ ad_logs indexes already exist')
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS cron_locks (
        name        TEXT PRIMARY KEY,
        acquired_at TEXT    NOT NULL,
        expires_at  TEXT    NOT NULL,
        holder_id   TEXT    NOT NULL
      )
    `)
    console.log('✅ Created cron_locks table')
  } catch {
    console.log('✅ cron_locks table already exists')
  }

  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_cron_locks_expires ON cron_locks(expires_at)`)
    console.log('✅ Created cron_locks indexes')
  } catch {
    console.log('✅ cron_locks indexes already exist')
  }
}
