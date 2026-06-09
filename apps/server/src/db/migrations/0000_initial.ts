import { createClient, type Client } from '@libsql/client'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

async function initializeDefaultData(client: Client, dbPath: string) {
  console.log('🔄 Checking default data...')

  // 检查是否有用户
  const usersResult = await client.execute('SELECT COUNT(*) as count FROM users')
  const userCount = usersResult.rows[0]?.count as number

  if (userCount > 0) {
    console.log('✅ Database already has data, skipping initialization')
    return
  }

  console.log('📦 Initializing default data...')

  // 创建默认管理员 (admin / admin123)
  const passwordHash = await bcrypt.hash('admin123', 10)
  await client.execute({
    sql: 'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
    args: ['admin', passwordHash, 'Admin', 'superadmin']
  })
  console.log('  ✓ Default admin created: admin / admin123 (CHANGE YOUR PASSWORD ON FIRST LOGIN!)')

  // 创建默认板块
  const defaultSections = [
    { name: 'Token 计划', slug: 'token_plan', path: '/token-plan', description: 'Token 计划相关内容', sortOrder: 0 },
    { name: 'AI 编程', slug: 'ai_coding', path: '/ai-coding', description: 'AI 编程教程与项目', sortOrder: 1 },
    { name: 'AI 作品', slug: 'ai_works', path: '/ai-works', description: 'AI 生成作品展示', sortOrder: 2 },
    { name: '博客', slug: 'blog', path: '/blog', description: '博客文章', sortOrder: 3 },
  ]

  const sectionIds: Record<string, number> = {}
  for (const section of defaultSections) {
    const result = await client.execute({
      sql: 'INSERT INTO sections (name, slug, path, description, sort_order) VALUES (?, ?, ?, ?, ?)',
      args: [section.name, section.slug, section.path, section.description || '', section.sortOrder]
    })
    sectionIds[section.slug] = Number(result.lastInsertRowid)
  }
  console.log('  ✓ Default sections created')

  // 创建默认分类
  const categories = [
    { name: '未分类', slug: 'uncategorized', sectionId: sectionIds['blog'], sortOrder: 0 },
    { name: 'AI 教程', slug: 'ai-tutorials', sectionId: sectionIds['ai_coding'], sortOrder: 1 },
    { name: '项目展示', slug: 'project-showcase', sectionId: sectionIds['ai_coding'], sortOrder: 2 },
    { name: '技术解析', slug: 'tech-analysis', sectionId: sectionIds['ai_coding'], sortOrder: 3 },
    { name: 'AI 绘画', slug: 'ai-painting', sectionId: sectionIds['ai_works'], sortOrder: 1 },
    { name: 'AI 视频', slug: 'ai-video', sectionId: sectionIds['ai_works'], sortOrder: 2 },
    { name: '计划公告', slug: 'announcements', sectionId: sectionIds['token_plan'], sortOrder: 1 },
    { name: '进度更新', slug: 'progress-updates', sectionId: sectionIds['token_plan'], sortOrder: 2 },
  ]

  for (const cat of categories) {
    if (!cat.sectionId) continue
    await client.execute({
      sql: 'INSERT INTO categories (name, slug, section_id, sort_order) VALUES (?, ?, ?, ?)',
      args: [cat.name, cat.slug, cat.sectionId, cat.sortOrder]
    })
  }
  console.log('  ✓ Default categories created')

  // 创建默认标签
  const tags = ['AI', '编程', 'Next.js', 'TypeScript', '教程', '作品', 'Token', '全栈']
  for (const tag of tags) {
    await client.execute({
      sql: 'INSERT INTO tags (name) VALUES (?)',
      args: [tag]
    })
  }
  console.log('  ✓ Default tags created')

  // 创建默认站点设置
  const defaultSettings = [
    { key: 'site_name', value: 'TokenPress' },
    { key: 'site_description', value: 'Token 力量无限放大 | AI 赋能综合内容平台' },
    { key: 'header_logo', value: '' },
    { key: 'footer_logo', value: '' },
    { key: 'footer_nav', value: JSON.stringify([
      { name: 'Token 计划', url: '/token-plan' },
      { name: 'AI 编程', url: '/ai-coding' },
      { name: 'AI 作品', url: '/ai-works' },
      { name: '博客', url: '/blog' },
    ]) },
    { key: 'friend_links_columns', value: '2' },
    { key: 'copyright_text', value: '© 2026 TokenPress. All rights reserved.' },
    { key: 'icp_number', value: '' },
    { key: 'frontend_locale', value: 'zh' },
    { key: 'backend_locale', value: 'zh' },
    { key: 'hero_slides', value: JSON.stringify([
      { id: '1', imageUrl: '/uploads/hero-slide-1.svg', linkUrl: '/token-plan', linkTarget: '_self' },
      { id: '2', imageUrl: '/uploads/hero-slide-2.svg', linkUrl: '/ai-coding', linkTarget: '_self' },
      { id: '3', imageUrl: '/uploads/hero-slide-3.svg', linkUrl: '/ai-works', linkTarget: '_self' },
    ]) },
    { key: 'content_review_enabled', value: 'false' },
    { key: 'review_cloud_provider', value: 'none' },
    { key: 'review_tencent_secret_id', value: '' },
    { key: 'review_tencent_secret_key', value: '' },
    { key: 'review_tencent_region', value: 'ap-guangzhou' },
    { key: 'review_aliyun_access_key_id', value: '' },
    { key: 'review_aliyun_access_key_secret', value: '' },
    { key: 'review_aliyun_region', value: 'cn-shanghai' },
    { key: 'review_baidu_app_id', value: '' },
    { key: 'review_baidu_api_key', value: '' },
    { key: 'review_baidu_secret_key', value: '' },
    { key: 'review_builtin_ai_api_url', value: '' },
    { key: 'review_builtin_ai_api_key', value: '' },
  ]

  for (const setting of defaultSettings) {
    await client.execute({
      sql: 'INSERT INTO site_settings (key, value) VALUES (?, ?)',
      args: [setting.key, setting.value]
    })
  }
  console.log('  ✓ Default site settings created')

  // 创建默认友情链接
  await client.execute({
    sql: 'INSERT INTO friend_links (name, url, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
    args: ['词元笔记', 'https://www.token00.com', '词元笔记', 0, 1]
  })
  console.log('  ✓ Default friend links created')

  // 创建默认 Hero Slide SVG 文件 + media 记录
  const UPLOADS_DIR = path.resolve(path.dirname(dbPath), 'uploads')
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })

  const DEFAULTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../defaults')
  const heroSlides = [
    { id: '1', filename: 'hero-slide-1.svg', linkUrl: '/token-plan' },
    { id: '2', filename: 'hero-slide-2.svg', linkUrl: '/ai-coding' },
    { id: '3', filename: 'hero-slide-3.svg', linkUrl: '/ai-works' },
  ]

  for (const slide of heroSlides) {
    const srcPath = path.join(DEFAULTS_DIR, slide.filename)
    const destPath = path.join(UPLOADS_DIR, slide.filename)
    const svgData = fs.readFileSync(srcPath, 'utf-8')
    fs.writeFileSync(destPath, svgData, 'utf-8')

    const stat = fs.statSync(destPath)
    const publicUrl = `/uploads/${slide.filename}`

    await client.execute({
      sql: `INSERT INTO media (filename, original_name, mime_type, size, url, uploaded_by, is_reviewed, created_at)
            VALUES (?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)`,
      args: [slide.filename, slide.filename, 'image/svg+xml', stat.size, publicUrl]
    })
  }
  console.log('  ✓ Default hero slides created')

  console.log('✅ Default data initialized')
}
