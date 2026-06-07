import { sql } from 'drizzle-orm'
import { db } from '../index.js'

/**
 * Migration 0009: 创建 FTS5 全文搜索虚拟表
 * 用于文章标题和内容的全文搜索
 */
export async function migrate() {
  console.log('Running migration 0009_fts5...')

  // 创建 FTS5 虚拟表
  await db.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
      title,
      content,
      content='articles',
      content_rowid='id',
      tokenize='unicode61'
    )
  `)

  // 插入触发器：文章插入时同步到 FTS
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS articles_fts_insert AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END
  `)

  // 插入触发器：文章删除时从 FTS 移除
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS articles_fts_delete AFTER DELETE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
    END
  `)

  // 插入触发器：文章更新时同步 FTS
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS articles_fts_update AFTER UPDATE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
      INSERT INTO articles_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END
  `)

  // 重建已有文章的索引
  await db.run(sql`
    INSERT INTO articles_fts(rowid, title, content)
    SELECT id, title, content FROM articles WHERE status = 'published'
  `)

  console.log('Migration 0009_fts5 completed')
}
