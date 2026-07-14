import { Router } from 'express'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { db } from '../db/index.js'
import { siteSettings } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { STYLES_DIR } from '../utils/paths.js'

const router = Router()

// 已注册的首页 section 组件名（防止渲染未知组件）
const REGISTERED_HOMEPAGE_COMPONENTS = ['Hero', 'Features', 'ArticleList', 'CTA', 'Banner'] as const
type HomepageComponent = (typeof REGISTERED_HOMEPAGE_COMPONENTS)[number]

// ===== 校验工具 =====
function validateId(id: string): { ok: boolean; error?: string } {
  if (!id || typeof id !== 'string') return { ok: false, error: 'id is required' }
  if (!/^[a-z0-9-]+$/.test(id)) return { ok: false, error: 'id 只能包含小写字母、数字与连字符' }
  if (id.includes('..')) return { ok: false, error: 'id 非法' }
  return { ok: true }
}

// theme.css 仅允许 :root{ --var: value; } 声明，禁止脚本/外链/导入
function validateTheme(css: unknown): { ok: boolean; error?: string } {
  if (typeof css !== 'string') return { ok: false, error: 'theme 必须是字符串' }
  const s = css.trim()
  if (!s.startsWith(':root')) return { ok: false, error: 'theme 必须以 :root 开头' }
  if (!s.includes('{') || !s.includes('}')) return { ok: false, error: 'theme 必须是合法 CSS 块' }
  if (/<|>|url\(|@import|javascript:|expression\(/i.test(s)) {
    return { ok: false, error: 'theme 包含不允许的内容（脚本/外链/@import）' }
  }
  return { ok: true }
}

function validateHeader(obj: any): { ok: boolean; error?: string } {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'header 必须是对象' }
  const src = obj?.logo?.src
  if (src !== undefined) {
    if (typeof src !== 'string' || !src.startsWith('/') || src.includes('..') || src.includes('://') || src.includes('<')) {
      return { ok: false, error: 'header.logo.src 仅允许同源相对路径' }
    }
  }
  return { ok: true }
}

function validateLayouts(obj: any): { ok: boolean; error?: string } {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'layouts 必须是对象' }
  const sections = obj?.homepage?.sections
  if (Array.isArray(sections)) {
    for (const s of sections) {
      if (!REGISTERED_HOMEPAGE_COMPONENTS.includes(s?.component)) {
        return { ok: false, error: `未知组件：${s?.component}（允许：${REGISTERED_HOMEPAGE_COMPONENTS.join(', ')}）` }
      }
    }
  }
  return { ok: true }
}

function validateJson(value: unknown, name: string): { ok: boolean; error?: string } {
  if (typeof value === 'string') {
    try { JSON.parse(value) } catch { return { ok: false, error: `${name} 不是合法 JSON` } }
  } else if (value !== undefined && typeof value !== 'object') {
    return { ok: false, error: `${name} 必须是对象或 JSON 字符串` }
  }
  return { ok: true }
}

// ===== 读取辅助 =====
function parseJsonFile(content: string): any {
  return JSON.parse(content)
}

async function readPackConfig(id: string): Promise<{
  id: string
  manifest: any
  theme: string
  layouts: any
  header: any
  footer: any
} | null> {
  const dir = path.join(STYLES_DIR, id)
  if (!fs.existsSync(dir)) return null
  const manifestPath = path.join(dir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null

  const manifest = parseJsonFile(await fsp.readFile(manifestPath, 'utf8'))
  const read = async (file: string): Promise<string | null> => {
    const p = path.join(dir, file)
    return fs.existsSync(p) ? await fsp.readFile(p, 'utf8') : null
  }
  const theme = (await read('theme.css')) || ''
  const layoutsRaw = await read('layouts.json')
  const headerRaw = await read('header.json')
  const footerRaw = await read('footer.json')

  return {
    id,
    manifest,
    theme,
    layouts: layoutsRaw ? parseJsonFile(layoutsRaw) : null,
    header: headerRaw ? parseJsonFile(headerRaw) : null,
    footer: footerRaw ? parseJsonFile(footerRaw) : null,
  }
}

function toJson(value: any): any {
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return null }
  }
  return value
}

async function getActiveStyleId(): Promise<string> {
  try {
    const row = await db.select().from(siteSettings).where(eq(siteSettings.key, 'active_style')).get()
    const v = row?.value
    return v && typeof v === 'string' && v.trim() ? v.trim() : 'blog'
  } catch {
    return 'blog'
  }
}

// ===== 路由 =====

// GET /api/v1/styles/active — 公开（供 SSR 渲染读取当前激活包配置）
router.get('/active', async (_req, res) => {
  try {
    const activeId = await getActiveStyleId()
    const pack = await readPackConfig(activeId)
    if (!pack) {
      return res.status(404).json({ success: false, error: `激活的模板包不存在：${activeId}` })
    }

    // 首页布局覆盖：检查 siteSettings 中的 homepage_layouts，存在则深合并
    let layouts = pack.layouts || null
    try {
      const homepageOverride = await db.select()
        .from(siteSettings)
        .where(eq(siteSettings.key, 'homepage_layouts'))
        .get()
      if (homepageOverride?.value) {
        const override = JSON.parse(homepageOverride.value)
        if (override && typeof override === 'object' && !Array.isArray(override)) {
          const packHomepage = layouts?.homepage || {}
          layouts = {
            ...(layouts || {}),
            homepage: { ...packHomepage, ...override },
          }
        }
      }
    } catch { /* ignore homepage_layouts parse failure */ }

    res.json({
      success: true,
      data: {
        activeStyle: activeId,
        defaultTheme: pack.manifest?.defaultTheme || 'light',
        manifest: pack.manifest,
        theme: pack.theme,
        layouts,
        header: pack.header,
        footer: pack.footer,
      },
    })
  } catch (err) {
    console.error('Get active style error:', err)
    res.status(500).json({ success: false, error: 'Failed to get active style' })
  }
})

// GET /api/v1/styles — 列出全部包（需 styles:read）
router.get('/', apiTokenOrAdmin('styles:read'), async (_req, res) => {
  try {
    const activeId = await getActiveStyleId()
    if (!fs.existsSync(STYLES_DIR)) {
      return res.json({ success: true, data: [] })
    }
    const entries = fs.readdirSync(STYLES_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)

    const result = []
    for (const id of entries) {
      const pack = await readPackConfig(id)
      if (!pack) continue
      result.push({
        id: pack.id,
        name: pack.manifest?.name || id,
        description: pack.manifest?.description || '',
        version: pack.manifest?.version || '',
        builtin: !!pack.manifest?.builtin,
        preview: pack.manifest?.preview || null,
        active: id === activeId,
      })
    }
    res.json({ success: true, data: result })
  } catch (err) {
    console.error('List styles error:', err)
    res.status(500).json({ success: false, error: 'Failed to list styles' })
  }
})

// GET /api/v1/styles/:id — 取某包完整配置（需 styles:read）
router.get('/:id', apiTokenOrAdmin('styles:read'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })
    const pack = await readPackConfig(id)
    if (!pack) return res.status(404).json({ success: false, error: 'Style pack not found' })
    res.json({
      success: true,
      data: {
        id: pack.id,
        manifest: pack.manifest,
        theme: pack.theme,
        layouts: pack.layouts,
        header: pack.header,
        footer: pack.footer,
      },
    })
  } catch (err) {
    console.error('Get style error:', err)
    res.status(500).json({ success: false, error: 'Failed to get style' })
  }
})

// POST /api/v1/styles — 新建/上传模板包（需 styles:write）
router.post('/', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const { id, manifest, theme, layouts, header, footer } = req.body || {}
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const dir = path.join(STYLES_DIR, id)
    if (fs.existsSync(path.join(dir, 'manifest.json'))) {
      const existing = parseJsonFile(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
      if (existing?.builtin) {
        return res.status(409).json({ success: false, error: '内置模板包不可覆盖，请改用 PUT 局部更新或使用其它 id' })
      }
      return res.status(409).json({ success: false, error: '该 id 已存在，请使用 PUT 更新或换用其它 id' })
    }

    if (!manifest || typeof manifest !== 'object') {
      return res.status(400).json({ success: false, error: 'manifest 必填' })
    }
    if (theme !== undefined) {
      const tv = validateTheme(theme)
      if (!tv.ok) return res.status(400).json({ success: false, error: tv.error })
    }
    if (layouts !== undefined) {
      const lv = validateLayouts(toJson(layouts))
      if (!lv.ok) return res.status(400).json({ success: false, error: lv.error })
    }
    if (header !== undefined) {
      const hv = validateHeader(toJson(header))
      if (!hv.ok) return res.status(400).json({ success: false, error: hv.error })
    }

    fs.mkdirSync(dir, { recursive: true })
    await fsp.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ ...manifest, id, builtin: false }, null, 2))
    if (theme !== undefined) await fsp.writeFile(path.join(dir, 'theme.css'), theme)
    if (layouts !== undefined) await fsp.writeFile(path.join(dir, 'layouts.json'), JSON.stringify(toJson(layouts), null, 2))
    if (header !== undefined) await fsp.writeFile(path.join(dir, 'header.json'), JSON.stringify(toJson(header), null, 2))
    if (footer !== undefined) await fsp.writeFile(path.join(dir, 'footer.json'), JSON.stringify(toJson(footer), null, 2))

    res.status(201).json({ success: true, data: { id, message: 'Style pack created' } })
  } catch (err) {
    console.error('Create style error:', err)
    res.status(500).json({ success: false, error: 'Failed to create style' })
  }
})

// PUT /api/v1/styles/:id — 局部更新（需 styles:write）
router.put('/:id', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const dir = path.join(STYLES_DIR, id)
    if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
      return res.status(404).json({ success: false, error: 'Style pack not found' })
    }

    const { manifest, theme, layouts, header, footer } = req.body || {}
    if (theme !== undefined) {
      const tv = validateTheme(theme)
      if (!tv.ok) return res.status(400).json({ success: false, error: tv.error })
    }
    if (layouts !== undefined) {
      const lv = validateLayouts(toJson(layouts))
      if (!lv.ok) return res.status(400).json({ success: false, error: lv.error })
    }
    if (header !== undefined) {
      const hv = validateHeader(toJson(header))
      if (!hv.ok) return res.status(400).json({ success: false, error: hv.error })
    }

    if (manifest !== undefined && typeof manifest === 'object') {
      const cur = parseJsonFile(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
      await fsp.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ ...cur, ...manifest, id }, null, 2))
    }
    if (theme !== undefined) await fsp.writeFile(path.join(dir, 'theme.css'), theme)
    if (layouts !== undefined) await fsp.writeFile(path.join(dir, 'layouts.json'), JSON.stringify(toJson(layouts), null, 2))
    if (header !== undefined) await fsp.writeFile(path.join(dir, 'header.json'), JSON.stringify(toJson(header), null, 2))
    if (footer !== undefined) await fsp.writeFile(path.join(dir, 'footer.json'), JSON.stringify(toJson(footer), null, 2))

    res.json({ success: true, data: { id, message: 'Style pack updated' } })
  } catch (err) {
    console.error('Update style error:', err)
    res.status(500).json({ success: false, error: 'Failed to update style' })
  }
})

// DELETE /api/v1/styles/:id — 删除自定义包（需 styles:write）
router.delete('/:id', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const dir = path.join(STYLES_DIR, id)
    if (!fs.existsSync(dir)) return res.status(404).json({ success: false, error: 'Style pack not found' })
    const manifest = parseJsonFile(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
    if (manifest?.builtin) {
      return res.status(403).json({ success: false, error: '内置模板包受保护，不可删除' })
    }
    fs.rmSync(dir, { recursive: true, force: true })
    res.json({ success: true, message: 'Style pack deleted' })
  } catch (err) {
    console.error('Delete style error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete style' })
  }
})

export default router
