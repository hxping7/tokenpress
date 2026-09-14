import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

export async function migrate() {
  const DB_PATH = getDbPath()
  const client = createClient({
    url: `file:${DB_PATH}`,
  })

  console.log('🔄 Running database migration...')
  console.log(`  Database path: ${DB_PATH}`)

  // ===== 创建所有表 =====
  const statements = [
    // sections
    `CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL UNIQUE,
      description TEXT,
      external_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // users
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      avatar_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // api_tokens
    `CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      permissions TEXT NOT NULL,
      last_used_at TEXT,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // categories
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,

    // articles
    `CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      excerpt TEXT,
      cover_image TEXT,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived','scheduled','pending_review')),
      view_count INTEGER NOT NULL DEFAULT 0,
      author_id INTEGER NOT NULL REFERENCES users(id),
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // tags
    `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // article_tags
    `CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (article_id, tag_id)
    )`,

    // media
    `CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      width INTEGER,
      height INTEGER,
      duration REAL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      is_reviewed INTEGER NOT NULL DEFAULT 0,
      review_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // api_logs
    `CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id INTEGER NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_time INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      content_url TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // friend_links
    `CREATE TABLE IF NOT EXISTS friend_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // site_settings
    `CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // login_logs
    `CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      username TEXT,
      success INTEGER NOT NULL,
      reason TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // login_protect
    `CREATE TABLE IF NOT EXISTS login_protect (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL UNIQUE,
      fail_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      captcha_required INTEGER NOT NULL DEFAULT 0,
      last_fail_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // backups
    `CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // audit_logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      detail TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // system_events
    `CREATE TABLE IF NOT EXISTS system_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // article_likes
    `CREATE TABLE IF NOT EXISTS article_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      ip_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // article_views
    `CREATE TABLE IF NOT EXISTS article_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      referer TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // content_reviews
    `CREATE TABLE IF NOT EXISTS content_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      content_snapshot TEXT,
      image_urls_json TEXT,
      local_scan_status TEXT NOT NULL DEFAULT 'pending',
      local_matched_words TEXT,
      cloud_provider TEXT,
      cloud_text_status TEXT NOT NULL DEFAULT 'pending',
      cloud_image_status TEXT NOT NULL DEFAULT 'pending',
      cloud_label TEXT,
      cloud_score REAL,
      cloud_detail_json TEXT,
      manual_status TEXT NOT NULL DEFAULT 'pending',
      manual_reviewer INTEGER REFERENCES users(id),
      manual_reviewed_at TEXT,
      manual_note TEXT,
      final_verdict TEXT NOT NULL DEFAULT 'pending',
      ai_patrol_status TEXT,
      ai_patrol_at TEXT,
      ai_patrol_detail_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // sensitive_keywords
    `CREATE TABLE IF NOT EXISTS sensitive_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'general',
      severity TEXT NOT NULL DEFAULT 'medium',
      action TEXT NOT NULL DEFAULT 'review',
      scope TEXT NOT NULL DEFAULT 'all',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // ads
    `CREATE TABLE IF NOT EXISTS ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position TEXT NOT NULL,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      priority INTEGER NOT NULL DEFAULT 0,
      start_at TEXT,
      end_at TEXT,
      target_sections TEXT,
      target_categories TEXT,
      max_impressions INTEGER,
      max_clicks INTEGER,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // ad_logs
    `CREATE TABLE IF NOT EXISTS ad_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id INTEGER REFERENCES ads(id) ON DELETE SET NULL,
      article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      referer TEXT,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // cron_locks
    `CREATE TABLE IF NOT EXISTS cron_locks (
      name TEXT PRIMARY KEY,
      acquired_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      holder_id TEXT NOT NULL
    )`,

    // ===== 索引 =====
    `CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`,
    `CREATE INDEX IF NOT EXISTS idx_articles_section ON articles(section_id)`,
    `CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`,
    `CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id)`,
    `CREATE INDEX IF NOT EXISTS idx_categories_section ON categories(section_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sections_sort ON sections(sort_order)`,
    `CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token)`,
    `CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON media(uploaded_by)`,
    `CREATE INDEX IF NOT EXISTS idx_api_logs_token ON api_logs(token_id)`,
    `CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_login_logs_ip ON login_logs(ip_address)`,
    `CREATE INDEX IF NOT EXISTS idx_login_protect_ip ON login_protect(ip_address)`,
    `CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(type)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type)`,
    `CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_article_likes_unique ON article_likes(article_id, ip_address)`,
    `CREATE INDEX IF NOT EXISTS idx_article_likes_article ON article_likes(article_id)`,
    `CREATE INDEX IF NOT EXISTS idx_article_views_article ON article_views(article_id)`,
    `CREATE INDEX IF NOT EXISTS idx_article_views_created ON article_views(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_article_views_ip ON article_views(ip_address)`,
    `CREATE INDEX IF NOT EXISTS idx_cr_target ON content_reviews(target_type, target_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cr_target_version ON content_reviews(target_type, target_id, version)`,
    `CREATE INDEX IF NOT EXISTS idx_cr_final ON content_reviews(final_verdict)`,
    `CREATE INDEX IF NOT EXISTS idx_cr_manual ON content_reviews(manual_status)`,
    `CREATE INDEX IF NOT EXISTS idx_cr_created ON content_reviews(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sensitive_keywords_enabled ON sensitive_keywords(enabled)`,
    `CREATE INDEX IF NOT EXISTS idx_sensitive_keywords_scope ON sensitive_keywords(scope)`,
    `CREATE INDEX IF NOT EXISTS idx_ads_position_status ON ads(position, status)`,
    `CREATE INDEX IF NOT EXISTS idx_ads_status_startat ON ads(status, start_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ads_status_endat ON ads(status, end_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ad_logs_ad_id ON ad_logs(ad_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ad_logs_type_created ON ad_logs(type, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_cron_locks_expires ON cron_locks(expires_at)`,
  ]

  for (const stmt of statements) {
    await client.execute(stmt)
  }

  console.log('✅ Tables created successfully')

  // ===== FTS5 全文搜索 =====
  await createFts5(client)

  // ===== 初始化默认数据 =====
  await initializeDefaultData(client, DB_PATH)

  console.log('✅ Migration completed')
}

async function createFts5(client: Client) {
  // 创建 FTS5 虚拟表
  await client.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
      title,
      content,
      content='articles',
      content_rowid='id',
      tokenize='unicode61'
    )
  `)

  // 触发器
  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS articles_fts_insert AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END
  `)

  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS articles_fts_delete AFTER DELETE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
    END
  `)

  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS articles_fts_update AFTER UPDATE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
      INSERT INTO articles_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
    END
  `)

  console.log('✅ FTS5 index created')
}

/**
 * 全新数据库的初始数据：**有意留空**。
 *
 * 旧版在这里创建默认管理员（admin/admin123）、旧 IA 的四个板块（Token 计划 /
 * AI 编程 / AI 作品 / 博客）及配套分类、标签、友链、站点设置 —— 既不安全
 * （默认弱口令），也与站点实际定位不符。
 *
 * 首次安装改由 **安装向导 /setup** 完成：创建管理员账号、选择并激活风格包、
 * 可选安装该包自带的演示示例内容（见 apps/server/src/lib/styleDemo.ts）。
 * 用户什么都不选时，站点就是一个干净的全空白站。
 */
async function initializeDefaultData(_client: Client, _dbPath: string) {
  const usersResult = await _client.execute('SELECT COUNT(*) as count FROM users')
  const userCount = usersResult.rows[0]?.count as number
  if (userCount > 0) {
    console.log('✅ Database already has data, skipping initialization')
    return
  }
  console.log('⏭️  全新数据库：跳过默认内容初始化（请访问 /setup 完成安装向导）')
}
