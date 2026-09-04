// Style Pack 预览渲染
// =====================================================================
// 架构说明：
//   AI Agent 跑在用户 PC 上，用本地 LLM 生成/修改完整 style.json，
//   再通过技能调用 TokenPress 远程 API 提交（POST /、PATCH /:id 等）。
//   因此本模块【不】承担 LLM 生成——后端不接任何 LLM 提供方。
//
// 本模块仅负责「预览渲染」：
//   renderStylePreview —— 渲染风格包预览图（可选，依赖 playwright-core + 系统 Chrome）
//   - 若未安装 playwright-core 或未配置渲染目标，返回"未配置"错误（501 由调用方处理）
// =====================================================================

import fs from 'node:fs'
import path from 'node:path'
import { STYLES_DIR } from '../utils/paths.js'
import {
  applyBatchPatch,
  readPackConfig,
  writePack,
  type PatchOp,
} from './stylePack.js'

export interface PreviewOptions {
  id: string
  view: 'home' | 'section'
  patches?: PatchOp[]
  baseUrl?: string
}

// 渲染预览图，返回相对 URL（/styles/previews/<id>_<ts>.png）
// 依赖：playwright-core（可选依赖）+ 系统 Chrome（通过 executablePath / channel）
// 未配置时返回未配置错误（501 由调用方处理）。
export async function renderStylePreview(opts: PreviewOptions): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string }> {
  let playwright: any
  try {
    playwright = await import('playwright-core')
  } catch {
    return { ok: false, error: '预览渲染未安装 playwright-core（可选依赖）。安装后可启用真实截图预览。' }
  }

  const chromium = playwright?.chromium
  if (!chromium) return { ok: false, error: 'playwright-core 缺少 chromium 导出' }

  // 找到系统 Chrome/Edge 可执行路径
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/microsoft-edge',
      ]
  const exe = candidates.find((p) => fs.existsSync(p))

  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      ...(exe ? { executablePath: exe } : { channel: process.platform === 'win32' ? 'chrome' : 'chromium' }),
    })
  } catch (err: any) {
    return { ok: false, error: `无法启动浏览器渲染预览：${err?.message || err}` }
  }

  const base = await readPackConfig(opts.id)
  if (!base) return { ok: false, error: `风格包不存在：${opts.id}` }

  // 若带 patches：临时写入真实包以便 SSR 读取，渲染完成后在 finally 恢复原包（非破坏性）。
  let originalJson: string | null = null
  const styleJsonPath = path.join(STYLES_DIR, opts.id, 'style.json')
  const patched = opts.patches?.length ? applyBatchPatch(base, opts.patches) : { ok: true, pack: base }
  if (!patched.ok || !patched.pack) return { ok: false, error: `patches 应用失败：${patched.error}` }

  try {
    if (opts.patches?.length) {
      if (fs.existsSync(styleJsonPath)) originalJson = fs.readFileSync(styleJsonPath, 'utf8')
      await writePack(opts.id, patched.pack)
    }

    const baseUrl = (opts.baseUrl || '').replace(/\/$/, '')
    // 预览目标：首页 / 板块页（作为 section 代表）
    const targetUrl = opts.view === 'section' ? `${baseUrl}/blog` : `${baseUrl}/`

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(800)
    } catch (err: any) {
      return { ok: false, error: `渲染页面失败：${err?.message || err}` }
    }

    const shotDir = path.join(STYLES_DIR, 'previews')
    fs.mkdirSync(shotDir, { recursive: true })
    const ts = Date.now()
    const filename = `${opts.id}_${ts}.png`
    const outPath = path.join(shotDir, filename)
    await page.screenshot({ path: outPath, fullPage: true })
    await page.close()
    return { ok: true, imageUrl: `/styles/previews/${filename}` }
  } finally {
    await browser.close().catch(() => {})
    // 恢复原包（若发生过临时写入）
    if (opts.patches?.length) {
      if (originalJson != null) {
        fs.writeFileSync(styleJsonPath, originalJson)
      } else {
        fs.rmSync(path.join(STYLES_DIR, opts.id, 'style.json'), { force: true })
      }
    }
  }
}