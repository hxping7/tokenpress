import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import { getDbPath } from '../config.js'

const DB_PATH = getDbPath()
const client = createClient({
  url: `file:${DB_PATH}`,
})

export async function migrate() {
  console.log('🔄 Running database migration...')

  // 创建表
  const statements = [
    `CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL UNIQUE,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
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
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      section_id INTEGER NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      excerpt TEXT,
      cover_image TEXT,
      section_id INTEGER NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      view_count INTEGER NOT NULL DEFAULT 0,
      author_id INTEGER NOT NULL REFERENCES users(id),
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (article_id, tag_id)
    )`,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id INTEGER NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_time INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
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
  ]

  for (const stmt of statements) {
    await client.execute(stmt)
  }

  console.log('✅ Tables created successfully')

  // 初始化默认数据
  await initializeDefaultData()
}

async function initializeDefaultData() {
  console.log('🔄 Checking default data...')

  // 检查是否有用户
  const usersResult = await client.execute('SELECT COUNT(*) as count FROM users')
  const userCount = usersResult.rows[0]?.count as number

  if (userCount === 0) {
    console.log('📦 Initializing default data...')

    // 创建默认管理员 (admin / admin123) - 首次登录后请修改密码!
    const passwordHash = await bcrypt.hash('admin123', 10)
    await client.execute({
      sql: 'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
      args: ['admin', passwordHash, 'Admin', 'admin']
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

    console.log('✅ Default data initialized')
  } else {
    console.log('✅ Database already has data, skipping initialization')
  }
}
