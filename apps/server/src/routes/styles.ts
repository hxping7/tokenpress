import { Router } from 'express'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { db } from '../db/index.js'
import { siteSettings } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { STYLES_DIR } from '../utils/paths.js'
import { BUILTIN_SOURCE } from '../utils/initStyles.js'

const router = Router()

// 已注册的首页 section 组件名（防止渲染未知组件）
// CustomBlock：声明式自定义区块（纯 JSON 驱动，无需改代码即可拼装新首页段落）
const REGISTERED_HOMEPAGE_COMPONENTS = ['Hero', 'Features', 'ArticleList', 'CTA', 'Banner', 'CustomBlock'] as const
type HomepageComponent = (typeof REGISTERED_HOMEPAGE_COMPONENTS)[number]

// manifest.themeVariants：包可声明的多套可切换配色（key -> :root{...} CSS）
function validateThemeVariants(manifest: any): { ok: boolean; error?: string } {
  const tv = manifest?.themeVariants
  if (tv === undefined || tv === null) return { ok: true }
  if (typeof tv !== 'object' || Array.isArray(tv)) {
    return { ok: false, error: 'manifest.themeVariants 必须是对象（key -> CSS 字符串）' }
  }
  for (const [k, v] of Object.entries(tv)) {
    if (typeof v !== 'string') return { ok: false, error: `themeVariants.${k} 必须是 CSS 字符串` }
    const r = validateTheme(v)
    if (!r.ok) return { ok: false, error: `themeVariants.${k}: ${r.error}` }
  }
  return { ok: true }
}

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
  const nav = obj?.nav
  if (nav !== undefined) {
    if (nav.position !== undefined && !['top', 'left'].includes(nav.position)) {
      return { ok: false, error: 'header.nav.position 仅允许 top | left' }
    }
    if (nav.height !== undefined && (typeof nav.height !== 'number' || nav.height < 32 || nav.height > 160)) {
      return { ok: false, error: 'header.nav.height 须为 32~160 的数字(px)' }
    }
    if (nav.width !== undefined && (typeof nav.width !== 'number' || nav.width < 140 || nav.width > 400)) {
      return { ok: false, error: 'header.nav.width 须为 140~400 的数字(px)' }
    }
    const colors = nav.colors
    if (colors !== undefined) {
      if (typeof colors !== 'object' || Array.isArray(colors)) return { ok: false, error: 'header.nav.colors 必须是对象' }
      for (const [k, v] of Object.entries(colors)) {
        if (typeof v !== 'string') return { ok: false, error: `header.nav.colors.${k} 必须是字符串` }
        if (/<|javascript:|url\(|@import/i.test(v)) {
          return { ok: false, error: `header.nav.colors.${k} 包含不允许的内容` }
        }
      }
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
    const tv = validateThemeVariants(manifest)
    if (!tv.ok) return res.status(400).json({ success: false, error: tv.error })

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
      const tv = validateThemeVariants(manifest)
      if (!tv.ok) return res.status(400).json({ success: false, error: tv.error })
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

// POST /api/v1/styles/:id/restore — 恢复内置模板包到出厂默认（需 styles:write）
// 仅对 builtin 包有效：从镜像内置源 styles-builtin/<id> 重新拷贝覆盖当前磁盘文件，
// 丢弃用户对布局/配色/导航等的全部个人修改。当前激活状态不变。
router.post('/:id/restore', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const targetDir = path.join(STYLES_DIR, id)
    if (!fs.existsSync(path.join(targetDir, 'manifest.json'))) {
      return res.status(404).json({ success: false, error: 'Style pack not found' })
    }
    const curManifest = parseJsonFile(fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8'))
    if (!curManifest?.builtin) {
      return res.status(400).json({
        success: false,
        error: '只有内置模板包支持恢复默认；自定义包请直接删除后重建',
      })
    }

    const sourceDir = path.join(BUILTIN_SOURCE, id)
    if (!fs.existsSync(path.join(sourceDir, 'manifest.json'))) {
      return res.status(404).json({ success: false, error: `未找到内置源模板包：${id}` })
    }

    // 重新拷贝：先清后拷，确保与出厂源完全一致（含被用户删除的文件复原）
    fs.rmSync(targetDir, { recursive: true, force: true })
    fs.cpSync(sourceDir, targetDir, { recursive: true })

    res.json({ success: true, data: { id, message: 'Style pack restored to default' } })
  } catch (err) {
    console.error('Restore style error:', err)
    res.status(500).json({ success: false, error: 'Failed to restore style' })
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
