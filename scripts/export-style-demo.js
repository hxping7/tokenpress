#!/usr/bin/env node
/**
 * 导出风格包的「演示示例内容」：从当前数据库导出 demo.json + demo-media/，
 * 供首次安装向导 /setup 勾选安装（见 apps/server/src/lib/styleDemo.ts）。
 *
 * 用法（在后端容器内运行，因为要读容器里的 DB 与 uploads）：
 *   docker cp scripts/export-style-demo.js <backend>:/tmp/
 *   docker exec <backend> node /tmp/export-style-demo.js <packId> <outDir>
 *   docker cp <backend>:<outDir> ./_out
 *   cp _out/demo.json apps/web/public/styles/<packId>/
 *   cp -r _out/demo-media apps/web/public/styles/<packId>/
 *
 * 产物：
 *   demo.json          板块/分类/文章/标签/友链/站点设置（媒体引用改写为 demo-media/<rel>）
 *   demo-media/<rel>   对应媒体文件（安装时复制到目标站 uploads 并还原 URL）
 *
 * 注意：
 *   - site_settings.value 是**二次转义**的 JSON 字符串（含 \"），媒体重写正则必须把
 *     反斜杠一并排除，否则 footer_nav 里 HTML 的二维码/图片 URL 会漏改。
 *   - 改完包内容后需**重建后端镜像**（镜像内 styles-builtin 来自 apps/web/public/styles），
 *     否则新部署的环境检测不到该包的演示内容。
 */
const fs = require('fs')
const path = require('path')

function loadBetterSqlite() {
  // 容器内 pnpm 布局；按版本号寻找
  const base = '/app/node_modules/.pnpm'
  const dir = fs.readdirSync(base).find((d) => d.startsWith('better-sqlite3@'))
  if (!dir) throw new Error('未找到 better-sqlite3')
  return require(path.join(base, dir, 'node_modules/better-sqlite3'))
}

const Database = loadBetterSqlite()
const PACK_ID = process.argv[2] || 'enterprise'
const OUT_DIR = process.argv[3] || '/tmp/demo-out'
const DB_PATH = process.env.TP_DB || '/app/apps/server/data/token00.db'
const UPLOADS_DIR = process.env.TP_UPLOADS || '/app/apps/server/data/uploads'
const MEDIA_PREFIX = '/api/v1/media/files/uploads/'
const DEMO_MEDIA = 'demo-media'

// 站点设置白名单：只带演示站必需的信息，不含密钥 / 限流 / 环境相关
const SETTING_KEYS = [
  'site_name', 'site_description', 'copyright_text', 'icp_number', 'icp_url', 'powered_by',
  'footer_nav', 'footer_nav_columns', 'friend_links_columns',
  'home_feature_eyebrow', 'home_feature_title', 'home_feature_title_accent', 'home_feature_intro', 'home_feature_stats',
  'home_about_title', 'home_about_intro',
  'default_theme', 'content_max_width', 'share_config',
]

const db = new Database(DB_PATH, { readonly: true })
const mediaFiles = new Map()
const stats = { rewritten: 0 }

function rewriteMedia(value) {
  if (typeof value !== 'string' || !value) return value
  if (!value.includes(MEDIA_PREFIX)) return value
  const re = new RegExp(MEDIA_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^"\')\\\\\\s]+)', 'g')
  return value.replace(re, (_m, rest) => {
    const abs = path.join(UPLOADS_DIR, rest)
    if (fs.existsSync(abs)) {
      mediaFiles.set(rest, abs)
      stats.rewritten++
      return `${DEMO_MEDIA}/${rest}`
    }
    return _m
  })
}

const sections = db.prepare('SELECT * FROM sections ORDER BY sort_order, id').all()
const categories = db.prepare('SELECT * FROM categories ORDER BY section_id, sort_order, id').all()
const articles = db.prepare('SELECT * FROM articles ORDER BY id').all()
const tags = db.prepare('SELECT * FROM tags ORDER BY id').all()
const links = db.prepare('SELECT * FROM friend_links ORDER BY sort_order, id').all()
const settings = db.prepare('SELECT key, value FROM site_settings').all()

const sectionSlugById = new Map(sections.map((s) => [s.id, s.slug]))
const catSlugById = new Map(categories.map((c) => [c.id, c.slug]))
const tagsByArticle = new Map()
for (const r of db.prepare('SELECT at.article_id, t.name FROM article_tags at JOIN tags t ON t.id = at.tag_id ORDER BY t.id').all()) {
  if (!tagsByArticle.has(r.article_id)) tagsByArticle.set(r.article_id, [])
  tagsByArticle.get(r.article_id).push(r.name)
}

const demo = {
  version: 1,
  packId: PACK_ID,
  generatedAt: new Date().toISOString(),
  note: '演示示例内容。安装时按 slug / key 幂等跳过已存在项；媒体自 demo-media/ 复制到目标站 uploads。',
  siteSettings: {},
  sections: sections.map((s) => ({
    slug: s.slug, name: s.name, path: s.path, description: s.description,
    kind: s.kind, template: s.template,
    templateConfig: s.template_config ? JSON.parse(s.template_config) : null,
    layouts: s.layouts ? JSON.parse(s.layouts) : null,
    sortOrder: s.sort_order, isActive: !!s.is_active,
  })),
  categories: categories.map((c) => ({
    slug: c.slug, name: c.name, sectionSlug: sectionSlugById.get(c.section_id) || null,
    description: c.description, template: c.template,
    templateConfig: c.template_config ? JSON.parse(c.template_config) : null,
    layouts: c.layouts ? JSON.parse(c.layouts) : null, sortOrder: c.sort_order,
  })),
  tags: tags.map((t) => t.name),
  articles: articles.map((a) => ({
    slug: a.slug, title: a.title, excerpt: a.excerpt,
    content: rewriteMedia(a.content), coverImage: rewriteMedia(a.cover_image),
    sectionSlug: sectionSlugById.get(a.section_id) || null,
    categorySlug: a.category_id ? catSlugById.get(a.category_id) || null : null,
    status: a.status, meta: a.meta ? JSON.parse(a.meta) : null,
    articleTemplate: a.article_template,
    templateConfig: a.template_config ? JSON.parse(a.template_config) : null,
    sortOrder: a.sort_order, publishedAt: a.published_at,
    pinnedAt: a.pinned_at, pinnedScope: a.pinned_scope,
    tags: tagsByArticle.get(a.id) || [],
  })),
  friendLinks: links.map((l) => ({
    name: l.name, url: l.url, description: l.description,
    sortOrder: l.sort_order, isActive: !!l.is_active,
  })),
}
for (const s of settings) {
  if (!SETTING_KEYS.includes(s.key)) continue
  demo.siteSettings[s.key] = rewriteMedia(s.value)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'demo.json'), JSON.stringify(demo, null, 2) + '\n', 'utf8')

let copied = 0
for (const [rel, abs] of mediaFiles) {
  const dst = path.join(OUT_DIR, DEMO_MEDIA, rel)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(abs, dst)
  copied++
}

console.log('=== 导出完成 ===')
console.log(` pack: ${PACK_ID}`)
console.log(` sections: ${demo.sections.length} | categories: ${demo.categories.length} | articles: ${demo.articles.length}`)
console.log(` tags: ${demo.tags.length} | friendLinks: ${demo.friendLinks.length} | siteSettings: ${Object.keys(demo.siteSettings).length}`)
console.log(` 媒体引用重写: ${stats.rewritten} | 复制文件: ${copied}`)
console.log(` demo.json: ${fs.statSync(path.join(OUT_DIR, 'demo.json')).size} B`)
console.log(` 输出目录: ${OUT_DIR}`)
