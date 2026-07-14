import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({ url: `file:${DB_PATH}` })

  console.log('🔄 Running migration: add design_works + sections.kind...')

  try {
    // 1) sections.kind 列
    const sectionInfo = await client.execute(`PRAGMA table_info(sections)`)
    const sectionCols = (sectionInfo.rows as any[]).map((c: any) => c.name)
    if (!sectionCols.includes('kind')) {
      await client.execute(`ALTER TABLE sections ADD COLUMN kind TEXT NOT NULL DEFAULT 'articles'`)
      console.log('  ✅ Added sections.kind column')
    } else {
      console.log('  ⏭️  sections.kind already exists, skipping')
    }

    // 2) design_works 表
    await client.execute(`
      CREATE TABLE IF NOT EXISTS design_works (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        cover_image TEXT,
        summary TEXT,
        content TEXT,
        author_name TEXT,
        author_avatar TEXT,
        category TEXT,
        tags TEXT,
        external_url TEXT,
        gallery_images TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        sort_order INTEGER NOT NULL DEFAULT 0,
        view_count INTEGER NOT NULL DEFAULT 0,
        section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    console.log('  ✅ Ensured design_works table exists')

    // 3) 种子：「设计师作品」板块（kind='design_works'）
    const existingSection = await client.execute(
      `SELECT id FROM sections WHERE slug = 'design-works' LIMIT 1`
    )
    let sectionId: number
    if ((existingSection.rows as any[]).length > 0) {
      sectionId = (existingSection.rows as any[])[0].id
      await client.execute(
        `UPDATE sections SET kind = 'design_works', is_active = 1 WHERE id = ${sectionId}`
      )
      console.log('  ⏭️  设计师作品板块已存在 (id=%d)，更新 kind', sectionId)
    } else {
      const ins = await client.execute({
        sql: `INSERT INTO sections (name, slug, path, description, sort_order, is_active, kind, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 1, 'design_works', datetime('now'), datetime('now'))`,
        args: ['设计师作品', 'design-works', '/design-works', '设计师作品集 · 精选设计案例与创作', 90],
      })
      sectionId = Number(ins.lastInsertRowid)
      console.log('  ✅ 已创建「设计师作品」板块 (id=%d)', sectionId)
    }

    // 4) 种子：示例作品（仅首次，按 slug 去重）
    const samples = [
      {
        title: 'Aurora — 极光品牌视觉系统',
        slug: 'aurora-brand-visual',
        cover: 'https://picsum.photos/seed/aurora/800/600',
        summary: '为极光科技打造的完整品牌视觉识别，涵盖 Logo、色彩、字体与应用规范。',
        author: '林清', avatar: 'https://i.pravatar.cc/100?img=12',
        category: '品牌设计', tags: ['Branding', 'VI'],
        external: 'https://example.com/aurora',
        gallery: ['https://picsum.photos/seed/aurora1/1200/800', 'https://picsum.photos/seed/aurora2/1200/800'],
      },
      {
        title: '潮汐 App — 冥想产品界面',
        slug: 'tide-meditation-app',
        cover: 'https://picsum.photos/seed/tide/800/600',
        summary: '以 ocean 节律为核心的冥想应用，柔和渐变与呼吸式动效。',
        author: '苏晚', avatar: 'https://i.pravatar.cc/100?img=32',
        category: 'UI/UX', tags: ['App', 'Mobile'],
        external: 'https://example.com/tide',
        gallery: ['https://picsum.photos/seed/tide1/1200/800', 'https://picsum.photos/seed/tide2/1200/800'],
      },
      {
        title: '山海经 — 插画海报系列',
        slug: 'classic-myth-illustration',
        cover: 'https://picsum.photos/seed/myth/800/600',
        summary: '以《山海经》异兽为题的东方插画海报，传统笔墨与现代构成。',
        author: '陈墨', avatar: 'https://i.pravatar.cc/100?img=51',
        category: '插画', tags: ['Illustration', 'Poster'],
        external: '',
        gallery: ['https://picsum.photos/seed/myth1/1200/800', 'https://picsum.photos/seed/myth2/1200/800'],
      },
      {
        title: 'Nova 电商官网改版',
        slug: 'nova-ecommerce-web',
        cover: 'https://picsum.photos/seed/nova/800/600',
        summary: '面向年轻群体的电商首页重构，强化商品叙事与转化路径。',
        author: '周野', avatar: 'https://i.pravatar.cc/100?img=68',
        category: '网页设计', tags: ['Web', 'E-commerce'],
        external: 'https://example.com/nova',
        gallery: ['https://picsum.photos/seed/nova1/1200/800', 'https://picsum.photos/seed/nova2/1200/800'],
      },
      {
        title: '拾光 — 独立摄影集',
        slug: 'light-photography-zine',
        cover: 'https://picsum.photos/seed/light/800/600',
        summary: '城市光影的独立摄影 zine，胶片质感与留白排版。',
        author: '阿光', avatar: 'https://i.pravatar.cc/100?img=15',
        category: '摄影', tags: ['Photography', 'Zine'],
        external: '',
        gallery: ['https://picsum.photos/seed/light1/1200/800', 'https://picsum.photos/seed/light2/1200/800'],
      },
      {
        title: 'Pixel 字体 — 实验显示字',
        slug: 'pixel-display-font',
        cover: 'https://picsum.photos/seed/pixel/800/600',
        summary: '一款像素风实验显示字体，兼容屏幕与印刷。',
        author: '何夕', avatar: 'https://i.pravatar.cc/100?img=45',
        category: '字体设计', tags: ['Typeface', 'Pixel'],
        external: 'https://example.com/pixel',
        gallery: ['https://picsum.photos/seed/pixel1/1200/800', 'https://picsum.photos/seed/pixel2/1200/800'],
      },
    ]

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]
      const exist = await client.execute({
        sql: `SELECT id FROM design_works WHERE slug = ? LIMIT 1`,
        args: [s.slug],
      })
      if ((exist.rows as any[]).length > 0) continue
      await client.execute({
        sql: `INSERT INTO design_works
              (title, slug, cover_image, summary, content, author_name, author_avatar, category, tags, external_url, gallery_images, status, sort_order, section_id, published_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
        args: [
          s.title, s.slug, s.cover, s.summary, s.summary,
          s.author, s.avatar, s.category, JSON.stringify(s.tags), s.external,
          JSON.stringify(s.gallery), i, sectionId,
        ],
      })
    }
    console.log('  ✅ 已写入示例作品（如不存在）')
    console.log('✅ 0018 migration completed')
  } finally {
    client.close()
  }
}
