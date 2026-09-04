// Style Pack 统一读写模块
// 目标：风格包 = 单文件 style.json（人机/AI 双读）。
// 旧卷（v1.0 多文件：manifest.json + theme.css + header.json + footer.json + layouts.json）
// 在首次读取时被一次性迁移为 style.json（迁移即落盘、此后不再读旧文件；幂等可重入）。
// 读取与写入一律以 style.json 为准。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { STYLES_DIR } from '../utils/paths.js'

// ===== 已注册的首页 section 组件名（防止渲染未知组件）=====
export const REGISTERED_HOMEPAGE_COMPONENTS = ['Hero', 'Features', 'ArticleList', 'CTA', 'Banner', 'CustomBlock'] as const
export type HomepageComponent = (typeof REGISTERED_HOMEPAGE_COMPONENTS)[number]

export const STYLE_JSON = 'style.json'

// ===== 类型 =====
export interface StylePack {
  id: string
  // 元数据（= 旧 manifest）
  $: any
  // 设计令牌 + 原始 theme.css
  design: {
    tokens?: Record<string, string>   // 解析出的 CSS 变量
    theme?: string                    // 原始 theme.css（前端 StyleProvider 直接注入）
    themeVariants?: Record<string, string>
    themeOptions?: any[]
    mode?: 'light' | 'dark' | 'auto'
  }
  header: any
  footer: any
  layouts: any                        // 含 homepage.sections / section / category / article / list / templates
  hero?: any                          // Hero 配置（variant/position/ctaButtons/height）
  features?: Record<string, any>
}

// ===== 校验工具 =====
export function validateId(id: string): { ok: boolean; error?: string } {
  if (!id || typeof id !== 'string') return { ok: false, error: 'id is required' }
  if (!/^[a-z0-9-]+$/.test(id)) return { ok: false, error: 'id 只能包含小写字母、数字与连字符' }
  if (id.includes('..')) return { ok: false, error: 'id 非法' }
  return { ok: true }
}

function validateCssValue(v: string): boolean {
  return !/<|javascript:|url\(|@import|expression\(/i.test(v)
}

// 解析 :root{--k:v;...} 为 {--k:'v'}（容错格式偏差：无分号、换行分隔等）
function parseThemeCss(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  const inner = css.replace(/^\s*:root\s*\{/, '').replace(/\}\s*$/, '')
  for (let decl of inner.split(/[;\n]/)) {
    decl = decl.trim()
    if (!decl) continue
    const idx = decl.indexOf(':')
    if (idx <= 0) continue
    const k = decl.slice(0, idx).trim()
    const v = decl.slice(idx + 1).trim().replace(/;+$/g, '').trim()
    if (k.startsWith('--') && v) out[k] = v
  }
  return out
}

// 派生 SSR 注入用 :root CSS。
// tokens 为单一事实来源；baseThemeCss（旧字段）作为兜底合并（tokens 优先），
// 保证 PATCH tokens 后 SSR 必反映变更，且不丢弃旧 theme 字符串中的既有变量。
export function buildThemeCssFromTokens(tokens: unknown, baseThemeCss = ''): string {
  const merged: Record<string, string> = { ...parseThemeCss(baseThemeCss) }
  if (tokens && typeof tokens === 'object' && !Array.isArray(tokens)) {
    for (const [k, v] of Object.entries(tokens)) {
      if (typeof k !== 'string' || !k.startsWith('--')) continue
      if (typeof v !== 'string' || !v.trim()) continue
      if (!validateCssValue(v)) continue
      merged[k] = v.replace(/\s+/g, ' ').trim()
    }
  }
  const keys = Object.keys(merged)
  if (!keys.length) return ''
  return `:root{${keys.map((k) => `${k}:${merged[k]};`).join('')}}`
}

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
    if (nav.style !== undefined && !['plain', 'underline', 'pill', 'split', 'minimal'].includes(nav.style)) {
      return { ok: false, error: 'header.nav.style 仅允许 plain | underline | pill | split | minimal' }
    }
    if (nav.align !== undefined && !['left', 'center', 'right'].includes(nav.align)) {
      return { ok: false, error: 'header.nav.align 仅允许 left | center | right' }
    }
    if (nav.source !== undefined && !['sections', 'custom', 'mixed'].includes(nav.source)) {
      return { ok: false, error: 'header.nav.source 仅允许 sections | custom | mixed' }
    }
    const colors = nav.colors
    if (colors !== undefined) {
      if (typeof colors !== 'object' || Array.isArray(colors)) return { ok: false, error: 'header.nav.colors 必须是对象' }
      for (const [k, v] of Object.entries(colors)) {
        if (typeof v !== 'string' || !validateCssValue(v)) {
          return { ok: false, error: `header.nav.colors.${k} 必须是非恶意 CSS 字符串` }
        }
      }
    }
  }
  if (obj.variant !== undefined && !['sticky-solid', 'sticky-glass', 'sticky-transparent', 'static', 'hidden'].includes(obj.variant)) {
    return { ok: false, error: 'header.variant 仅允许 sticky-solid | sticky-glass | sticky-transparent | static | hidden' }
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

function validateFooter(obj: any): { ok: boolean; error?: string } {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'footer 必须是对象' }
  if (obj.variant !== undefined && !['multi-column', 'simple', 'minimal', 'mega'].includes(obj.variant)) {
    return { ok: false, error: 'footer.variant 仅允许 multi-column | simple | minimal | mega' }
  }
  return { ok: true }
}

function validateDesign(design: any): { ok: boolean; error?: string } {
  if (design === undefined || design === null) return { ok: true }
  if (typeof design !== 'object' || Array.isArray(design)) return { ok: false, error: 'design 必须是对象' }
  if (design.theme !== undefined) {
    const r = validateTheme(design.theme)
    if (!r.ok) return { ok: false, error: r.error }
  }
  const tv = design.themeVariants
  if (tv !== undefined && tv !== null) {
    if (typeof tv !== 'object' || Array.isArray(tv)) return { ok: false, error: 'design.themeVariants 必须是对象' }
    for (const [k, v] of Object.entries(tv)) {
      if (typeof v !== 'string') return { ok: false, error: `themeVariants.${k} 必须是 CSS 字符串` }
      const r = validateTheme(v)
      if (!r.ok) return { ok: false, error: `themeVariants.${k}: ${r.error}` }
    }
  }
  if (design.tokens !== undefined) {
    if (typeof design.tokens !== 'object' || Array.isArray(design.tokens)) return { ok: false, error: 'design.tokens 必须是对象' }
    for (const [k, v] of Object.entries(design.tokens)) {
      if (typeof v !== 'string' || !validateCssValue(v)) return { ok: false, error: `design.tokens.${k} 必须是非恶意 CSS 字符串` }
    }
  }
  return { ok: true }
}

// ===== 整体校验 =====
export function validatePack(pack: StylePack): { ok: boolean; error?: string } {
  if (!pack || typeof pack !== 'object') return { ok: false, error: 'pack 必须是对象' }
  const checks = [
    validateHeader(pack.header),
    validateLayouts(pack.layouts),
    validateFooter(pack.footer),
    validateDesign(pack.design),
  ]
  for (const c of checks) if (!c.ok) return c
  return { ok: true }
}

// ===== 不可变嵌套读写 =====
export function getIn(obj: any, path: string): any {
  if (!path) return obj
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setIn(obj: any, path: string, value: any): any {
  const keys = path.split('.')
  const clone: any = obj == null ? {} : Array.isArray(obj) ? [...obj] : { ...obj }
  let cur = clone
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    const next = cur[k]
    cur[k] = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : {}
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = value
  return clone
}

export function deleteIn(obj: any, path: string): any {
  const keys = path.split('.')
  const clone: any = obj == null ? {} : { ...obj }
  let cur = clone
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (cur[k] == null) return clone
    cur[k] = { ...cur[k] }
    cur = cur[k]
  }
  delete cur[keys[keys.length - 1]]
  return clone
}

// 允许 patch 的顶层根（防止 agent 写未受控字段）
// 注：风格包只负责「装修」（布局/配色/结构），站点信息（名称/版权/备案等）
// 统一由 site_settings 全局设置管理，故 site 不在可写根之列。
export const PATCHABLE_ROOTS = ['design', 'header', 'footer', 'layouts', 'hero', 'features'] as const

// 校验单字段 patch 的 path 是否合法（必须在可 patch 根下）
export function validatePatchPath(pack: StylePack, path: string): { ok: boolean; error?: string } {
  if (!path || typeof path !== 'string') return { ok: false, error: 'path 必填且必须为字符串' }
  const root = path.split('.')[0]
  if (!PATCHABLE_ROOTS.includes(root as any)) {
    return { ok: false, error: `path 根必须为：${PATCHABLE_ROOTS.join(' | ')}（禁止修改 $ 元数据）` }
  }
  return { ok: true }
}

// ===== 读取：一律以 style.json 为准（旧多文件仅在迁移时被读取一次）=====
function parseJsonFile(content: string): any {
  return JSON.parse(content)
}

// v1.0 遗留格式文件名（manifest + theme.css + header + footer + layouts）
const LEGACY_FILES = {
  manifest: 'manifest.json',
  theme: 'theme.css',
  header: 'header.json',
  footer: 'footer.json',
  layouts: 'layouts.json',
} as const

// v1.0 多文件包 → style.json 的一次性确定性迁移：
// 目录存在 manifest.json（旧格式特征）且无 style.json 时，合并 5 个旧文件、
// 立即校验落盘 style.json，随后以 style.json 为准。迁移后旧文件不再参与读取，
// 仅保留在磁盘作为恢复参考；迁移失败返回 null 并在日志中报错。
async function migrateLegacyPack(id: string): Promise<StylePack | null> {
  const dir = path.join(STYLES_DIR, id)
  const manifestPath = path.join(dir, LEGACY_FILES.manifest)
  if (!fs.existsSync(manifestPath)) return null

  const readJson = async (file: string): Promise<any | null> => {
    const p = path.join(dir, file)
    if (!fs.existsSync(p)) return null
    try {
      return parseJsonFile(await fsp.readFile(p, 'utf8'))
    } catch (err) {
      console.error(`[stylePack] ${id}/${file} 解析失败`, err)
      return null
    }
  }
  const readText = async (file: string): Promise<string> => {
    const p = path.join(dir, file)
    if (!fs.existsSync(p)) return ''
    try {
      return await fsp.readFile(p, 'utf8')
    } catch {
      return ''
    }
  }

  const manifest = (await readJson(LEGACY_FILES.manifest)) || { id }
  const theme = await readText(LEGACY_FILES.theme)
  const header = await readJson(LEGACY_FILES.header)
  const footer = await readJson(LEGACY_FILES.footer)
  const layouts = await readJson(LEGACY_FILES.layouts)

  const pack: StylePack = {
    id,
    $: manifest,
    design: {
      theme,
      ...(manifest.themeVariants ? { themeVariants: manifest.themeVariants } : {}),
      ...(manifest.themeOptions ? { themeOptions: manifest.themeOptions } : {}),
    },
    header: header || {},
    footer: footer || {},
    layouts: layouts || {},
  }
  // 合并完成立即落盘 style.json：此后读取路径不再触碰旧文件
  await writePack(id, pack)
  console.log(`[stylePack] 已迁移旧格式包 <${id}> → ${STYLE_JSON}`)
  return pack
}

export async function readPackConfig(id: string): Promise<StylePack | null> {
  const dir = path.join(STYLES_DIR, id)
  const styleJsonPath = path.join(dir, STYLE_JSON)
  if (!fs.existsSync(styleJsonPath)) {
    // 无 style.json：一次性迁移旧多文件 → style.json（迁移成功即返回，无内存回退路径）
    return await migrateLegacyPack(id)
  }
  try {
    const style = parseJsonFile(await fsp.readFile(styleJsonPath, 'utf8'))
    return { id, ...style }
  } catch (err) {
    console.error(`[stylePack] ${id}/style.json 解析失败`, err)
    return null
  }
}

// 解析 theme.css 中的 --var: value; 为对象
export function parseThemeTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  if (!css) return tokens
  const re = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    tokens[m[1]] = m[2].trim()
  }
  return tokens
}

// ===== 写 style.json =====
export async function writePack(id: string, pack: StylePack): Promise<void> {
  const dir = path.join(STYLES_DIR, id)
  fs.mkdirSync(dir, { recursive: true })
  const { id: _id, $: meta, ...rest } = pack
  const style = { $: meta || { id }, ...rest }
  await fsp.writeFile(path.join(dir, STYLE_JSON), JSON.stringify(style, null, 2))
}

// ===== PATCH =====
export interface PatchOp {
  path: string
  value?: any
  op?: 'set' | 'delete'
}

export function applyPatch(pack: StylePack, patch: PatchOp): { ok: boolean; pack?: StylePack; error?: string } {
  const pv = validatePatchPath(pack, patch.path)
  if (!pv.ok) return { ok: false, error: pv.error }

  let next: StylePack
  if (patch.op === 'delete' || patch.value === undefined) {
    next = { ...pack, ...deleteIn(pack, patch.path) }
  } else {
    next = { ...pack, ...setIn(pack, patch.path, patch.value) }
  }

  // 校验修改后的包（若 path 落入 header/layouts/design/footer 则逐字段校验）
  const root = patch.path.split('.')[0]
  let check: { ok: boolean; error?: string } = { ok: true }
  if (root === 'header') check = validateHeader(getIn(next, 'header'))
  else if (root === 'layouts') check = validateLayouts(getIn(next, 'layouts'))
  else if (root === 'footer') check = validateFooter(getIn(next, 'footer'))
  else if (root === 'design') check = validateDesign(getIn(next, 'design'))
  if (!check.ok) return { ok: false, error: check.error }

  return { ok: true, pack: next }
}

export function applyBatchPatch(pack: StylePack, patches: PatchOp[]): { ok: boolean; pack?: StylePack; error?: string } {
  let cur = pack
  for (const p of patches) {
    const r = applyPatch(cur, p)
    if (!r.ok) return r
    cur = r.pack!
  }
  return { ok: true, pack: cur }
}

// ===== 首页 section 数组操作 =====
export function applyHomepageSections(
  pack: StylePack,
  op: 'insert' | 'remove' | 'replace' | 'move',
  index: number,
  element?: any,
  toIndex?: number,
): { ok: boolean; pack?: StylePack; error?: string } {
  const sections = Array.isArray(pack.layouts?.homepage?.sections) ? [...pack.layouts.homepage.sections] : []
  const MAX = 20

  if (op === 'insert') {
    if (!element || typeof element !== 'object') return { ok: false, error: 'insert 需要 element' }
    if (!REGISTERED_HOMEPAGE_COMPONENTS.includes(element?.component)) {
      return { ok: false, error: `未知组件：${element?.component}` }
    }
    const idx = index == null ? sections.length : index
    if (idx < 0 || idx > sections.length || sections.length >= MAX) return { ok: false, error: 'index 越界或超出上限' }
    sections.splice(idx, 0, element)
  } else if (op === 'remove') {
    if (index == null || index < 0 || index >= sections.length) return { ok: false, error: 'remove index 越界' }
    sections.splice(index, 1)
  } else if (op === 'replace') {
    if (index == null || index < 0 || index >= sections.length) return { ok: false, error: 'replace index 越界' }
    if (!element || !REGISTERED_HOMEPAGE_COMPONENTS.includes(element?.component)) return { ok: false, error: 'replace 需要合法 element' }
    sections[index] = element
  } else if (op === 'move') {
    if (index == null || toIndex == null) return { ok: false, error: 'move 需要 index 与 toIndex' }
    if (index < 0 || index >= sections.length || toIndex < 0 || toIndex >= sections.length) return { ok: false, error: 'move 越界' }
    const [item] = sections.splice(index, 1)
    sections.splice(toIndex, 0, item)
  } else {
    return { ok: false, error: 'op 仅允许 insert | remove | replace | move' }
  }

  const next: StylePack = { ...pack, layouts: { ...(pack.layouts || {}), homepage: { ...(pack.layouts?.homepage || {}), sections } } }
  return { ok: true, pack: next }
}

// ===== 配色方案批量重算 =====
// 根据 mode/accent/accentAlt 重写 design.tokens 中的关键色，并同步 header/footer 的引用色
export function applyScheme(
  pack: StylePack,
  scheme: { mode?: 'light' | 'dark' | 'auto'; accent?: string; accentAlt?: string },
): { ok: boolean; pack?: StylePack; error?: string } {
  const tokens = { ...(pack.design?.tokens || {}) }
  const mode = scheme.mode || tokens['--mode'] || 'light'

  if (scheme.mode) tokens['--mode'] = mode

  const bgPrimary = mode === 'dark' ? '#0a0a0f' : '#ffffff'
  const bgSecondary = mode === 'dark' ? '#17171f' : '#f5f5f7'
  const bgTertiary = mode === 'dark' ? '#232330' : '#e8e8ed'
  const textPrimary = mode === 'dark' ? '#f5f5f7' : '#1d1d1f'
  const textSecondary = mode === 'dark' ? '#c9c9d1' : '#3a3a3f'
  const textMuted = mode === 'dark' ? '#8a8a95' : '#8a8a8f'

  tokens['--mode'] = mode
  tokens['--bg-primary'] = bgPrimary
  tokens['--bg-secondary'] = bgSecondary
  tokens['--bg-tertiary'] = bgTertiary
  tokens['--text-primary'] = textPrimary
  tokens['--text-secondary'] = textSecondary
  tokens['--text-muted'] = textMuted
  if (scheme.accent) {
    tokens['--accent-blue'] = scheme.accent
    tokens['--accent-blue-dim'] = scheme.accent
    tokens['--hover-bg'] = `${scheme.accent}1f`
    tokens['--gradient-from'] = scheme.accent
    tokens['--gradient-to'] = scheme.accentAlt || scheme.accent
  }
  if (scheme.accentAlt) {
    tokens['--accent-purple'] = scheme.accentAlt
    tokens['--gradient-via'] = scheme.accentAlt
  }

  // 同步 header.nav.colors 中的强调色引用
  let header = pack.header
  if (header?.nav?.colors) {
    header = setIn(header, 'nav.colors.activeBg', scheme.accent || tokens['--accent-blue'])
  }

  const next: StylePack = { ...pack, design: { ...(pack.design || {}), tokens }, header }
  return { ok: true, pack: next }
}