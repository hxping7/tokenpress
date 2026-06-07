import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking content_reviews migration...')

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS content_reviews (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        target_type       TEXT    NOT NULL,
        target_id         INTEGER NOT NULL,
        version           INTEGER NOT NULL DEFAULT 1,
        content_snapshot  TEXT,
        image_urls_json   TEXT,
        local_scan_status TEXT DEFAULT 'pending',
        local_matched_words TEXT,
        cloud_provider    TEXT,
        cloud_text_status TEXT DEFAULT 'pending',
        cloud_image_status TEXT DEFAULT 'pending',
        cloud_label       TEXT,
        cloud_score       REAL,
        cloud_detail_json TEXT,
        manual_status     TEXT DEFAULT 'pending',
        manual_reviewer   INTEGER REFERENCES users(id),
        manual_reviewed_at TEXT,
        manual_note       TEXT,
        final_verdict     TEXT DEFAULT 'pending',
        ai_patrol_status  TEXT,
        ai_patrol_at      TEXT,
        ai_patrol_detail_json TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_cr_target ON content_reviews(target_type, target_id)
    `)
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_cr_target_version ON content_reviews(target_type, target_id, version)
    `)
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_cr_final ON content_reviews(final_verdict)
    `)
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_cr_manual ON content_reviews(manual_status)
    `)
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_cr_created ON content_reviews(created_at)
    `)

    console.log('✅ content_reviews table created')
  } catch (err) {
    console.log('✅ content_reviews migration skipped (table may already exist)')
  }
}
