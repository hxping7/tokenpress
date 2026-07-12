import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({ url: `file:${DB_PATH}` })

  console.log('🔄 Running migration: rebuild articles table (remove legacy section, fix stale CHECKs)...')

  try {
    const info = await client.execute(`PRAGMA table_info(articles)`)
    const columns = (info.rows as any[]).map((c: any) => c.name)

    if (!columns.includes('section')) {
      console.log('  ⏭️  articles.section column already removed, skipping rebuild')
      return
    }

    // ============ 12-step rebuild ============
    // SQLite's table rebuild pattern: https://sqlite.org/lang_altertable.html#making_other_kinds_of_table_schema_changes
    // This removes legacy CHECKs (status restricted to draft/published/archived, section restricted to old slugs)
    // and backfills section_id from the legacy section column for all existing rows.

    // Step 0: disable FK checks — PRAGMA must run outside any transaction
    await client.execute(`PRAGMA foreign_keys = OFF`)

    // Step 1-3: create new table, copy data, drop old, rename — all atomic in one batch
    await client.executeMultiple(`
      -- Step 1: create new articles table without section column, without stale CHECKs
      CREATE TABLE articles_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        excerpt TEXT,
        cover_image TEXT,
        section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id),
        status TEXT NOT NULL DEFAULT 'draft',
        author_id INTEGER NOT NULL REFERENCES users(id),
        published_at TEXT,
        view_count INTEGER NOT NULL DEFAULT 0,
        pinned_at TEXT,
        pinned_scope TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Step 2: copy data — COALESCE section_id from existing value, legacy section mapping, or fallback
      INSERT INTO articles_new (
        id, title, slug, content, excerpt, cover_image,
        section_id, category_id, status, author_id,
        published_at, view_count, pinned_at, pinned_scope,
        created_at, updated_at
      )
      SELECT
        a.id, a.title, a.slug, a.content, a.excerpt, a.cover_image,
        COALESCE(
          a.section_id,
          (SELECT s.id FROM sections s WHERE s.slug = a.section),
          (SELECT MIN(id) FROM sections)
        ),
        a.category_id, a.status, a.author_id,
        a.published_at, a.view_count, a.pinned_at, a.pinned_scope,
        a.created_at, a.updated_at
      FROM articles a;

      -- Step 3: drop old table (this also auto-drops legacy FTS triggers and index on section)
      DROP TABLE articles;

      -- Step 4: rename
      ALTER TABLE articles_new RENAME TO articles;

      -- Step 5: rebuild important indexes
      CREATE INDEX idx_articles_author ON articles(author_id);
      CREATE INDEX idx_articles_status ON articles(status);
      CREATE INDEX idx_articles_slug ON articles(slug);
    `)

    // Step 6: rebuild FTS triggers (articles_fts table survives DROP; recreate sync triggers)
    // Check if articles_fts exists first (it should, unless this is a fresh DB migrated from 0000_initial)
    const ftsTables = (await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='articles_fts'`
    )).rows
    const hasFts = ftsTables.length > 0

    if (hasFts) {
      await client.executeMultiple(`
        CREATE TRIGGER articles_fts_insert AFTER INSERT ON articles BEGIN
          INSERT INTO articles_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
        END;
        CREATE TRIGGER articles_fts_delete AFTER DELETE ON articles BEGIN
          INSERT INTO articles_fts(articles_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
        END;
        CREATE TRIGGER articles_fts_update AFTER UPDATE ON articles BEGIN
          INSERT INTO articles_fts(articles_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
          INSERT INTO articles_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
        END;
      `)
    }

    // Step 7: re-enable FK checks
    await client.execute(`PRAGMA foreign_keys = ON`)

    // Verify
    const newInfo = await client.execute(`PRAGMA table_info(articles)`)
    const newCols = (newInfo.rows as any[]).map((c: any) => c.name)
    const rowCount = (await client.execute(`SELECT COUNT(*) AS c FROM articles`)).rows[0].c as number
    const nullSecId = (await client.execute(`SELECT COUNT(*) AS c FROM articles WHERE section_id IS NULL`)).rows[0].c as number
    const hasSectionCol = newCols.includes('section')

    console.log(`  📊 Rebuild complete: ${rowCount} rows, section_id nulls=${nullSecId}, has section column=${hasSectionCol}`)

    if (hasSectionCol || nullSecId > 0) {
      throw new Error(`Migration failed: hasSection=${hasSectionCol}, nullSectionId=${nullSecId}`)
    }

    console.log('  ✅ articles table rebuilt successfully (legacy section + stale CHECKs removed)')
  } finally {
    client.close()
  }
}
