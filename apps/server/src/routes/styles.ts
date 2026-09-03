import { Router } from 'express'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { db } from '../db/index.js'
import { siteSettings } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { STYLES_DIR } from '../utils/paths.js'
import { auditLog } from '../utils/auditLogger.js'
import { BUILTIN_SOURCE } from '../utils/initStyles.js'
import {
  applyBatchPatch,
  applyHomepageSections,
  applyPatch,
  applyScheme,
  getIn,
  readPackConfig,
  STYLE_JSON,
  validateId,
  validatePack,
  writePack,
  type PatchOp,
  type StylePack,
  buildThemeCssFromTokens,
} from '../lib/stylePack.js'
import { renderStylePreview } from '../lib/styleAi.js'
import { withLock } from '../lib/previewLock.js'

const router = Router()

// ===== 读取辅助 =====
function parseJsonFile(content: string): any {
  return JSON.parse(content)
}

// 深合并 site_settings 全局默认 + 风格包 site 覆盖
// 未覆盖字段回落全局值，覆盖字段以风格包为准
async function resolveSiteInfo(pack: StylePack): Promise<Record<string, any>> {
  const rows = await db.select().from(siteSettings).all()
  const settings: Record<string, string> = {}
  for (const r of rows) settings[r.key] = r.value ?? ''
  const ov = pack.site || {}

  const resolve = (packKey: string, settingKey: string, fallback: any = '') => {
    const v = ov[packKey]
    return v === undefined || v === null ? settings[settingKey] ?? fallback : v
  }

  return {
    name: resolve('name', 'site_name', 'TokenPress'),
    description: resolve('description', 'site_description', ''),
    titleFormat: ov.titleFormat ?? '%s | TokenPress',
    copyright: resolve('copyright', 'copyright_text', ''),
    icp: resolve('icp', 'icp_number', ''),
    icpUrl: resolve('icpUrl', 'icp_url', ''),
    poweredBy: resolve('poweredBy', 'powered_by', ''),
    footerLogo: ov.footerLogo ?? null,
  }
}

// ===== 组合单个包的完整配置（供 /active 与 /:id 返回）=====
async function buildPackResponse(pack: StylePack, activeId: string) {
  // 首页布局覆盖：siteSettings.homepage_layouts 深合并（向后兼容旧字段）
  let layouts = pack.layouts || null
  try {
    const homepageOverride = await db.select().from(siteSettings).where(eq(siteSettings.key, 'homepage_layouts')).get()
    if (homepageOverride?.value) {
      const override = JSON.parse(homepageOverride.value)
      if (override && typeof override === 'object' && !Array.isArray(override)) {
        const packHomepage = layouts?.homepage || {}
        layouts = { ...(layouts || {}), homepage: { ...packHomepage, ...override } }
      }
    }
  } catch { /* ignore */ }

  const site = await resolveSiteInfo(pack)

  return {
    activeStyle: activeId,
    defaultTheme: pack.$?.defaultTheme || 'light',
    manifest: pack.$,
    // SSR 注入的主题 CSS：以 design.tokens 为单一事实来源，旧 design.theme 字符串作兜底合并
    theme: buildThemeCssFromTokens(pack.design?.tokens, pack.design?.theme || ''),
    themeVariants: pack.design?.themeVariants || null,
    layouts,
    header: pack.header,
    footer: pack.footer,
    // ===== 新增：全站可定制字段 =====
    site,
    hero: pack.hero || null,
    features: pack.features || null,
    homepage: layouts?.homepage || null,
    // ===== 完整合并对象（Agent 首选读取 = 整个 style 单文件）=====
    style: {
      $: pack.$,
      design: pack.design || {},
      header: pack.header,
      footer: pack.footer,
      layouts,
      site: pack.site || null,
      hero: pack.hero || null,
      features: pack.features || null,
    },
  }
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

async function setActiveStyleId(id: string): Promise<void> {
  await db.insert(siteSettings)
    .values({ key: 'active_style', value: id })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: id } })
}

// ===== 路由 =====

// GET /api/v1/styles/active — 公开（供 SSR 渲染读取当前激活包配置）
router.get('/active', async (_req, res) => {
  try {
    const activeId = await getActiveStyleId()
    const pack = await readPackConfig(activeId)
    if (!pack) return res.status(404).json({ success: false, error: `激活的模板包不存在：${activeId}` })
    res.json({ success: true, data: await buildPackResponse(pack, activeId) })
  } catch (err) {
    console.error('Get active style error:', err)
    res.status(500).json({ success: false, error: 'Failed to get active style' })
  }
})

// GET /api/v1/styles — 列出全部包（需 styles:read）
router.get('/', apiTokenOrAdmin('styles:read'), async (_req, res) => {
  try {
    const activeId = await getActiveStyleId()
    if (!fs.existsSync(STYLES_DIR)) return res.json({ success: true, data: [] })
    const entries = fs.readdirSync(STYLES_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)

    const result = []
    for (const id of entries) {
      const pack = await readPackConfig(id)
      if (!pack) continue
      result.push({
        id: pack.id,
        name: pack.$?.name || id,
        description: pack.$?.description || '',
        version: pack.$?.version || '',
        builtin: !!pack.$?.builtin,
        preview: pack.$?.preview || null,
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
    res.json({ success: true, data: await buildPackResponse(pack, id) })
  } catch (err) {
    console.error('Get style error:', err)
    res.status(500).json({ success: false, error: 'Failed to get style' })
  }
})

// GET /api/v1/styles/:id/schema — JSON Schema（Agent 读取以理解可配置字段与校验规则）
router.get('/:id/schema', apiTokenOrAdmin('styles:read'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })
    const pack = await readPackConfig(id)
    if (!pack) return res.status(404).json({ success: false, error: 'Style pack not found' })
    // 读共享 schema 文件（多候选路径：
    // ① 风格包目录同级（本地开发 = apps/web/public/style-json.schema.json）
    // ② 内置包来源目录同级（Docker = /app/apps/server/style-json.schema.json）
    //    data/ 整目录是持久卷，镜像内文件会被挂载遮蔽，故不能只查 ①）
    const schemaPath = [
      path.join(STYLES_DIR, '..', 'style-json.schema.json'),
      path.join(BUILTIN_SOURCE, '..', 'style-json.schema.json'),
    ].find((p) => fs.existsSync(p))
    if (schemaPath) {
      const schema = parseJsonFile(fs.readFileSync(schemaPath, 'utf8'))
      return res.json({ success: true, data: schema })
    }
    res.status(404).json({ success: false, error: 'Schema not found' })
  } catch (err) {
    console.error('Get style schema error:', err)
    res.status(500).json({ success: false, error: 'Failed to get style schema' })
  }
})

// GET /api/v1/styles/:id/playbook — ai-playbook.md（Agent 设计约束说明书）
router.get('/:id/playbook', apiTokenOrAdmin('styles:read'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })
    const dir = path.join(STYLES_DIR, id)
    const pb = path.join(dir, 'ai-playbook.md')
    if (!fs.existsSync(pb)) return res.status(404).json({ success: false, error: 'ai-playbook.md not found' })
    const markdown = await fsp.readFile(pb, 'utf8')
    res.json({ success: true, data: { id, markdown } })
  } catch (err) {
    console.error('Get style playbook error:', err)
    res.status(500).json({ success: false, error: 'Failed to get style playbook' })
  }
})

// PATCH /api/v1/styles/:id — 单字段/批量原子修改（需 styles:write）
// Body: { "path":"section.layout", "value":"sidebar-left" } 或 { "patch":[ {path,value}, ... ] }
router.patch('/:id', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const pack = await readPackConfig(id)
    if (!pack) return res.status(404).json({ success: false, error: 'Style pack not found' })

    const body = req.body || {}
    let patches: PatchOp[]
    if (Array.isArray(body.patch)) {
      patches = body.patch
    } else if (typeof body.path === 'string') {
      patches = [{ path: body.path, value: body.value, op: body.op }]
    } else {
      return res.status(400).json({ success: false, error: '请求体需包含 path+value 或 patch 数组' })
    }

    const r = applyBatchPatch(pack, patches)
    if (!r.ok) return res.status(400).json({ success: false, error: r.error })

    await writePack(id, r.pack!)
    await auditLog(req as any, 'update', 'style_pack', undefined,
      `[${id}] PATCH ${patches.length} op(s): ${patches.map((p) => p.path).join(', ')}`)
    res.json({ success: true, data: { id, applied: patches.length, style: r.pack } })
  } catch (err) {
    console.error('Patch style error:', err)
    res.status(500).json({ success: false, error: 'Failed to patch style' })
  }
})

// PATCH /api/v1/styles/:id/homepage-sections — 首页组件数组操作
// Body: { "op":"insert|remove|replace|move", "index":2, "element":{...}, "toIndex":3 }
router.patch('/:id/homepage-sections', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })
    const pack = await readPackConfig(id)
    if (!pack) return res.status(404).json({ success: false, error: 'Style pack not found' })

    const { op, index, element, toIndex } = req.body || {}
    const r = applyHomepageSections(pack, op, index, element, toIndex)
    if (!r.ok) return res.status(400).json({ success: false, error: r.error })

    await writePack(id, r.pack!)
    await auditLog(req as any, 'update', 'style_pack', undefined,
      `[${id}] homepage-sections ${op || '?'}@${index ?? ''}`)
    res.json({ success: true, data: { id, sections: r.pack?.layouts?.homepage?.sections } })
  } catch (err) {
    console.error('Patch homepage sections error:', err)
    res.status(500).json({ success: false, error: 'Failed to patch homepage sections' })
  }
})

// POST /api/v1/styles/:id/scheme — 配色方案批量重算
router.post('/:id/scheme', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })
    const pack = await readPackConfig(id)
    if (!pack) return res.status(404).json({ success: false, error: 'Style pack not found' })

    const { mode, accent, accentAlt } = req.body || {}
    const r = applyScheme(pack, { mode, accent, accentAlt })
    if (!r.ok) return res.status(400).json({ success: false, error: r.error })

    await writePack(id, r.pack!)
    await auditLog(req as any, 'update', 'style_pack', undefined,
      `[${id}] scheme mode=${mode || 'auto'} accent=${accent ?? ''}${accentAlt ? ` accentAlt=${accentAlt}` : ''}`)
    res.json({ success: true, data: { id, design: r.pack?.design } })
  } catch (err) {
    console.error('Apply scheme error:', err)
    res.status(500).json({ success: false, error: 'Failed to apply scheme' })
  }
})

// POST /api/v1/styles/:id/activate — 激活为当前使用风格包
router.post('/:id/activate', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })
    const pack = await readPackConfig(id)
    if (!pack) return res.status(404).json({ success: false, error: 'Style pack not found' })
    await setActiveStyleId(id)
    await auditLog(req as any, 'activate', 'style_pack', undefined, `[${id}] activated`)
    res.json({ success: true, data: { id, message: `已激活风格包：${id}` } })
  } catch (err) {
    console.error('Activate style error:', err)
    res.status(500).json({ success: false, error: 'Failed to activate style' })
  }
})

// GET /api/v1/styles/:id/diff — 对比两个风格包差异
router.get('/:id/diff', apiTokenOrAdmin('styles:read'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const target = String(req.query.target || '')
    const v1 = validateId(id)
    const v2 = validateId(target)
    if (!v1.ok || !v2.ok) return res.status(400).json({ success: false, error: 'id 或 target 非法' })
    const a = await readPackConfig(id)
    const b = await readPackConfig(target)
    if (!a || !b) return res.status(404).json({ success: false, error: 'Style pack not found' })

    const changes: { path: string; from: any; to: any }[] = []
    const roots = ['header', 'footer', 'layouts', 'site', 'hero', 'features', 'design']
    const walk = (pa: any, pb: any, prefix: string) => {
      const keys = new Set([...(pa && typeof pa === 'object' ? Object.keys(pa) : []), ...(pb && typeof pb === 'object' ? Object.keys(pb) : [])])
      for (const k of keys) {
        const pathKey = prefix ? `${prefix}.${k}` : k
        const va = getIn(a, pathKey)
        const vb = getIn(b, pathKey)
        const isObj = (x: any) => x && typeof x === 'object' && !Array.isArray(x)
        if (isObj(va) || isObj(vb)) {
          if (isObj(va) && isObj(vb)) { walk(va, vb, pathKey); continue }
        }
        if (JSON.stringify(va) !== JSON.stringify(vb)) changes.push({ path: pathKey, from: va, to: vb })
      }
    }
    for (const root of roots) walk((a as any)[root], (b as any)[root], root)

    res.json({ success: true, data: { from: id, to: target, changes } })
  } catch (err) {
    console.error('Diff style error:', err)
    res.status(500).json({ success: false, error: 'Failed to diff style' })
  }
})

// POST /api/v1/styles/:id/preview — 渲染预览图（需 styles:write）
// Body: { "view":"home|section", "patches":[{path,value},...], "baseUrl":"https://..." }
// - 依赖 playwright-core（可选）+ 系统 Chrome；未安装时返回 501。
// - 带 patches 时临时写入渲染、完成后恢复（非破坏性）。
// - SSR 依据 active_style 决定渲染哪一包，故预览需临时把 active_style 切到目标 id，
//   使前端能读取到打了 patch 的 token；渲染完成后在 finally 恢复。
// - 锁取全局：active_style 是共享单例，预览并发或预览 vs activate 都会竞争它。
//   restore 时仅当 active_style 仍为 id 才回滚，避免并发 activate 的切换被覆盖。
router.post('/:id/preview', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const pack = await readPackConfig(id)
    if (!pack) return res.status(404).json({ success: false, error: 'Style pack not found' })

    const { view, patches, baseUrl } = req.body || {}

    const r = await withLock('style-preview-global', async () => {
      const prevActive = await getActiveStyleId()
      let switched = false
      try {
        if (prevActive !== id) { await setActiveStyleId(id); switched = true }
        return await renderStylePreview({
          id,
          view: view === 'section' ? 'section' : 'home',
          patches,
          baseUrl,
        })
      } finally {
        // 仍指向 id 才回滚：如果期间 activate 切到了别的包，不要把它覆盖掉
        if (switched && (await getActiveStyleId()) === id) {
          await setActiveStyleId(prevActive)
        }
      }
    })

    if (!r.ok) {
      const status = /未配置|playwright-core/.test(r.error) ? 501 : 400
      return res.status(status).json({ success: false, error: r.error })
    }
    await auditLog(req as any, 'render', 'style_pack', undefined, `[${id}] preview view=${view || 'home'}`)
    res.json({ success: true, data: { id, imageUrl: r.imageUrl } })
  } catch (err) {
    console.error('Preview style error:', err)
    res.status(500).json({ success: false, error: 'Failed to render style preview' })
  }
})

// POST /api/v1/styles — 新建/上传模板包（需 styles:write）
// 直接提交：兼容旧多文件格式 + 新 style 单文件格式。
// AI Agent 在本地用 LLM 生成完整 style.json 后，通过本接口提交落盘。
router.post('/', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const body = req.body || {}

    // ===== 直接提交 =====
    const id = body.id || body.$?.id
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const dir = path.join(STYLES_DIR, id)
    const metaPath = path.join(dir, STYLE_JSON)
    if (fs.existsSync(metaPath)) {
      const existing = parseJsonFile(fs.readFileSync(metaPath, 'utf8'))
      if (existing?.$?.builtin) return res.status(409).json({ success: false, error: '内置模板包不可覆盖，请改用 PUT 局部更新或使用其它 id' })
      return res.status(409).json({ success: false, error: '该 id 已存在，请使用 PUT 更新或换用其它 id' })
    }

    // 构造 pack
    let pack: StylePack
    if (body.style && typeof body.style === 'object') {
      pack = { id, ...body.style }
    } else {
      pack = {
        id,
        $: { ...(body.manifest || {}), id, builtin: false },
        design: { theme: body.theme, themeVariants: body.manifest?.themeVariants, themeOptions: body.manifest?.themeOptions },
        header: body.header,
        footer: body.footer,
        layouts: body.layouts,
      }
    }
    const pv = validatePack(pack)
    if (!pv.ok) return res.status(400).json({ success: false, error: pv.error })

    await writePack(id, pack)
    await auditLog(req as any, 'create', 'style_pack', undefined, `[${id}] created`)
    res.status(201).json({ success: true, data: { id, message: 'Style pack created' } })
  } catch (err) {
    console.error('Create style error:', err)
    res.status(500).json({ success: false, error: 'Failed to create style' })
  }
})

// PUT /api/v1/styles/:id — 局部更新（需 styles:write）兼容旧接口
router.put('/:id', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const pack = await readPackConfig(id)
    if (!pack) return res.status(404).json({ success: false, error: 'Style pack not found' })

    const body = req.body || {}
    const next: StylePack = { ...pack }

    if (body.style && typeof body.style === 'object') {
      // 整份 style 替换（保留 id 与元数据）
      const merged = { ...body.style, $: { ...pack.$, ...(body.style.$ || {}) } }
      const pv = validatePack({ id, ...merged })
      if (!pv.ok) return res.status(400).json({ success: false, error: pv.error })
      await writePack(id, { id, ...merged })
      await auditLog(req as any, 'update', 'style_pack', undefined, `[${id}] full style.json replace`)
      return res.json({ success: true, data: { id, message: 'Style pack updated' } })
    }

    // 旧字段局部更新
    if (body.theme !== undefined) next.design = { ...(next.design || {}), theme: body.theme }
    if (body.manifest !== undefined && typeof body.manifest === 'object') next.$ = { ...(next.$ || {}), ...body.manifest, id }
    if (body.layouts !== undefined) next.layouts = body.layouts
    if (body.header !== undefined) next.header = body.header
    if (body.footer !== undefined) next.footer = body.footer
    if (body.site !== undefined) next.site = body.site
    if (body.hero !== undefined) next.hero = body.hero
    if (body.features !== undefined) next.features = body.features

    const pv = validatePack(next)
    if (!pv.ok) return res.status(400).json({ success: false, error: pv.error })

    await writePack(id, next)
    await auditLog(req as any, 'update', 'style_pack', undefined, `[${id}] legacy fields update`)
    res.json({ success: true, data: { id, message: 'Style pack updated' } })
  } catch (err) {
    console.error('Update style error:', err)
    res.status(500).json({ success: false, error: 'Failed to update style' })
  }
})

// POST /api/v1/styles/:id/restore — 恢复内置模板包到出厂默认（需 styles:write）
router.post('/:id/restore', apiTokenOrAdmin('styles:write'), async (req, res) => {
  try {
    const id = String(req.params.id)
    const v = validateId(id)
    if (!v.ok) return res.status(400).json({ success: false, error: v.error })

    const targetDir = path.join(STYLES_DIR, id)
    if (!fs.existsSync(targetDir)) return res.status(404).json({ success: false, error: 'Style pack not found' })
    const curPack = await readPackConfig(id)
    if (!curPack?.$?.builtin) return res.status(400).json({ success: false, error: '只有内置模板包支持恢复默认；自定义包请直接删除后重建' })

    const sourceDir = path.join(BUILTIN_SOURCE, id)
    if (!fs.existsSync(sourceDir)) return res.status(404).json({ success: false, error: `未找到内置源模板包：${id}` })

    fs.rmSync(targetDir, { recursive: true, force: true })
    fs.cpSync(sourceDir, targetDir, { recursive: true })
    await auditLog(req as any, 'restore', 'style_pack', undefined, `[${id}] restored to builtin default`)
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
    const pack = await readPackConfig(id)
    if (pack?.$?.builtin) return res.status(403).json({ success: false, error: '内置模板包受保护，不可删除' })
    fs.rmSync(dir, { recursive: true, force: true })
    await auditLog(req as any, 'delete', 'style_pack', undefined, `[${id}] deleted`)
    res.json({ success: true, message: 'Style pack deleted' })
  } catch (err) {
    console.error('Delete style error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete style' })
  }
})

export default router