import { Router } from 'express'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import { db } from '../db/index.js'
import { siteSettings, users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { STYLES_DIR } from '../utils/paths.js'
import { auditLog } from '../utils/auditLogger.js'
import { readPackConfig } from '../lib/stylePack.js'
import { getDemoSummary, installDemo } from '../lib/styleDemo.js'

/**
 * 首次安装向导（/setup）专用接口。
 *
 * 「是否已安装」沿用既有约定：users 表非空即视为已初始化。
 * 全新库的板块/分类/内容/站点设置**全部为空**，由向导决定：
 *   - 创建管理员（替代旧的 admin/admin123 硬编码默认账号）
 *   - 选择并激活一个风格包
 *   - 可选：安装该包自带的演示示例内容（幂等，按 slug/key 跳过已存在项）
 *
 * 后台「激活风格包」**不会**触发内容初始化，避免误动用户数据。
 */

const router = Router()

async function isInstalled(): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).limit(1)
  return rows.length > 0
}

/** 已就绪的风格包清单（目录里有合法 style.json 的） */
async function listPacks(): Promise<Array<{ id: string; name: string; previewUrl: string; hasDemo: boolean; demo: ReturnType<typeof getDemoSummary> }>> {
  if (!fs.existsSync(STYLES_DIR)) return []
  const dirs = fs
    .readdirSync(STYLES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
  const packs: Array<{ id: string; name: string; previewUrl: string; hasDemo: boolean; demo: ReturnType<typeof getDemoSummary> }> = []
  for (const d of dirs) {
    const pack = await readPackConfig(d.name)
    if (!pack) continue
    const previewPath = `${STYLES_DIR}/${d.name}/preview.png`
    packs.push({
      id: d.name,
      name: pack.$?.name || d.name,
      previewUrl: fs.existsSync(previewPath) ? `/styles/${d.name}/preview.png` : '',
      hasDemo: fs.existsSync(`${STYLES_DIR}/${d.name}/demo.json`),
      demo: getDemoSummary(d.name),
    })
  }
  return packs
}

// GET /api/v1/setup/status — 公开：向导需要知道安装状态与可选包（无敏感数据）
router.get('/status', async (_req, res) => {
  try {
    const installed = await isInstalled()
    if (installed) {
      return res.json({ success: true, data: { installed: true, packs: [] } })
    }
    res.json({ success: true, data: { installed: false, packs: await listPacks() } })
  } catch (err) {
    console.error('Setup status error:', err)
    res.status(500).json({ success: false, error: 'Failed to get setup status' })
  }
})

// POST /api/v1/setup — 仅在未安装时可用；一次性完成：管理员 + 风格包 +（可选）示例内容
router.post('/', async (req, res) => {
  try {
    if (await isInstalled()) {
      return res.status(403).json({ success: false, error: '站点已初始化，安装向导不可用' })
    }

    const { username, password, displayName, stylePackId, installDemo: withDemo } = req.body || {}

    // ---- 校验（与后台用户管理保持一致的宽松度）----
    if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      return res.status(400).json({ success: false, error: '用户名需为 3-32 位字母/数字/下划线' })
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: '密码至少 8 位' })
    }
    if (username.toLowerCase() === 'admin' && password.toLowerCase() === 'admin123') {
      return res.status(400).json({ success: false, error: '不能使用默认的 admin/admin123 弱口令' })
    }
    const pack = stylePackId ? await readPackConfig(String(stylePackId)) : null
    if (!pack) {
      return res.status(400).json({ success: false, error: '请选择一个有效的风格包' })
    }
    const packId = String(stylePackId)

    // ---- 竞态保护：事务内再次确认 users 为空 ----
    const existing = await db.select({ id: users.id }).from(users).limit(1)
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: '站点已初始化' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const [user] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : null,
        role: 'superadmin',
        isActive: 1,
      })
      .returning({ id: users.id })

    // 激活所选风格包
    await db
      .insert(siteSettings)
      .values({ key: 'active_style', value: packId })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: packId } })

    let demoResult = null
    if (withDemo === true) {
      demoResult = await installDemo(packId, user.id)
    }

    await auditLog(req as any, 'create', 'setup', undefined, `[setup] admin=${username}, pack=${packId}, demo=${withDemo === true}`)

    res.json({
      success: true,
      data: {
        username,
        stylePackId: packId,
        demo: demoResult,
        message: `初始化完成：管理员 ${username}，风格包 ${packId}${demoResult ? '，已安装演示示例内容' : ''}`,
      },
    })
  } catch (err: any) {
    console.error('Setup error:', err)
    // 常见并发/重复初始化
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: '站点已初始化或用户名已存在' })
    }
    res.status(500).json({ success: false, error: '初始化失败，请重试' })
  }
})

export default router
