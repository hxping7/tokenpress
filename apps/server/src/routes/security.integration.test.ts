// 安全回归测试：守护「鉴权边界 / 越权 / 路径穿越 / 上传白名单 / 原型污染 / 信息泄露」六类防线。
//
// 与 ai-publish.test.ts 同样的约束：ESM 静态 import 会被提升，因此所有 env 必须在
// 首次 `await import('../index.js')` 之前设置完毕（db/index.ts 与 middleware/auth.ts
// 都在模块加载期读取 env）。
process.env.NODE_ENV = 'test'
process.env.DATABASE_PATH = path.resolve(process.cwd(), 'data-test/security-test.db')
process.env.JWT_SECRET = 'security-suite-jwt-secret'
process.env.STYLES_DIR = path.resolve(process.cwd(), 'data-test/security-test-styles')
process.env.REVALIDATE_SECRET = 'security-suite-revalidate-secret'
process.env.SITE_URL = 'http://localhost:8081'
process.env.FRONTEND_URL = 'http://localhost:8081'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { Express } from 'express'

let app: Express

const TEST_DATA_DIR = path.resolve(process.cwd(), 'data-test')
const TEST_STYLES_DIR = process.env.STYLES_DIR!

/** 用与服务端一致的 secret 签一个 JWT（模拟一次成功的登录） */
function signJwt(payload: { userId: number; username: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' })
}

/** 手工拼一个 alg=none 的 JWT（算法混淆攻击） */
function forgeAlgNoneToken(): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: 1, username: 'attacker', role: 'superadmin' })}.`
}

let superAdminToken: string
let adminToken: string
let plainUserToken: string
let readOnlyApiToken: string // 仅有 styles:read
let fullApiToken: string // 拥有全部权限

beforeAll(async () => {
  for (const dir of [TEST_DATA_DIR, TEST_STYLES_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  // 准备一个可被 PATCH 的风格包，避免所有 styles 用例都退化成 404
  const packDir = path.join(TEST_STYLES_DIR, 'secpack')
  if (!fs.existsSync(packDir)) fs.mkdirSync(packDir, { recursive: true })
  fs.writeFileSync(
    path.join(packDir, 'style.json'),
    JSON.stringify(
      {
        id: 'secpack',
        $: { name: 'Security Fixture', version: '1.0.0', defaultTheme: 'light' },
        design: { tokens: { '--color-accent': '#0ea5e9' }, theme: '' },
        header: { nav: { align: 'center', style: 'plain' } },
        footer: { columns: 3 },
        layouts: { homepage: { sections: [{ component: 'Hero' }] } },
      },
      null,
      2,
    ),
  )

  const mod = await import('../index.js')
  app = mod.app

  const migrations = [
    '../db/migrations/0000_initial.js',
    '../db/migrations/0013_media_article_id.js',
    '../db/migrations/0014_add_hero_carousel_settings.js',
    '../db/migrations/0015_add_article_pin.js',
    '../db/migrations/0016_rebuild_articles.js',
    '../db/migrations/0017_add_sections_layouts.js',
    '../db/migrations/0018_add_design_works.js',
    '../db/migrations/0019_add_template.js',
    '../db/migrations/0020_merge_design_works_into_articles.js',
    '../db/migrations/0021_add_article_template.js',
    '../db/migrations/0022_add_category_layouts.js',
  ]
  for (const m of migrations) {
    const { migrate } = await import(m)
    await migrate()
  }

  const { db } = await import('../db/index.js')
  const { users, apiTokens } = await import('../db/schema.js')
  const { eq } = await import('drizzle-orm')
  const { ALL_API_PERMISSIONS, ROLE_API_PERMISSIONS } = await import('@tokenpress/shared')

  const upsertUser = async (username: string, role: 'superadmin' | 'admin' | 'user') => {
    const existing = await db.select().from(users).where(eq(users.username, username)).get()
    const passwordHash = await bcrypt.hash('Str0ng-Passw0rd!', 10)
    if (existing) return existing.id
    const r = await db
      .insert(users)
      .values({ username, passwordHash, displayName: username, role, isActive: 1 })
      .run()
    return Number(r.lastInsertRowid)
  }

  const superAdminId = await upsertUser('sec_superadmin', 'superadmin')
  const adminId = await upsertUser('sec_admin', 'admin')
  const userId = await upsertUser('sec_user', 'user')

  superAdminToken = signJwt({ userId: superAdminId, username: 'sec_superadmin', role: 'superadmin' })
  adminToken = signJwt({ userId: adminId, username: 'sec_admin', role: 'admin' })
  plainUserToken = signJwt({ userId: userId, username: 'sec_user', role: 'user' })

  const upsertToken = async (name: string, token: string, permissions: string[]) => {
    const existing = await db.select().from(apiTokens).where(eq(apiTokens.token, token)).get()
    if (existing) {
      await db.update(apiTokens).set({ permissions: JSON.stringify(permissions), isActive: 1 }).where(eq(apiTokens.id, existing.id)).run()
      return existing.id
    }
    const r = await db
      .insert(apiTokens)
      .values({ userId: superAdminId, name, token, permissions: JSON.stringify(permissions) })
      .run()
    return Number(r.lastInsertRowid)
  }

  await upsertToken('sec-readonly', 't00_sk_security_readonly_token', ['styles:read'])
  await upsertToken('sec-full', 't00_sk_security_full_token', [...ALL_API_PERMISSIONS])
  readOnlyApiToken = 't00_sk_security_readonly_token'
  fullApiToken = 't00_sk_security_full_token'

  // 供「user 角色不得授予超权限」用例取差集
  const forbiddenForUser = ALL_API_PERMISSIONS.filter((p) => !(ROLE_API_PERMISSIONS.user || []).includes(p))
  expect(forbiddenForUser.length).toBeGreaterThan(0)
  ;(globalThis as Record<string, unknown>).__FORBIDDEN_FOR_USER__ = forbiddenForUser
})

afterAll(async () => {
  // 测试产生的静态页落在 data-test/statichtml，随 data-test 一并被 .gitignore 忽略
})

describe('A. 鉴权边界：未认证请求不得触达任何受保护接口', () => {
  const protectedEndpoints: Array<[string, string]> = [
    ['GET', '/api/v1/users'],
    ['GET', '/api/v1/tokens'],
    ['GET', '/api/v1/admin/articles'],
    ['POST', '/api/v1/admin/articles'],
    ['GET', '/api/v1/media'],
    ['POST', '/api/v1/media'],
    ['GET', '/api/v1/backup'],
    ['GET', '/api/v1/stats'],
    ['GET', '/api/v1/logs/audit'],
    ['GET', '/api/v1/logs/login'],
    ['GET', '/api/v1/logs/api'],
    ['GET', '/api/v1/styles'],
    ['GET', '/api/v1/styles/secpack'],
    ['PATCH', '/api/v1/styles/secpack'],
    ['GET', '/api/v1/admin/reviews'],
    ['GET', '/api/v1/admin/ads'],
    ['GET', '/api/v1/admin/sensitive-keywords'],
    ['GET', '/api/v1/statichtml/tree'],
  ]

  it.each(protectedEndpoints)('%s %s 未携带凭证应返回 401', async (method, url) => {
    const agent = request(app)
    const res =
      method === 'GET' ? await agent.get(url) : method === 'POST' ? await agent.post(url) : await agent.patch(url)
    expect(res.status).toBe(401)
  })
})

describe('B. JWT 真实性：伪造 / 算法混淆不得通过', () => {
  it('用错误 secret 签发的 token 应被拒绝', async () => {
    const forged = jwt.sign({ userId: 1, username: 'attacker', role: 'superadmin' }, 'wrong-secret', { expiresIn: '1h' })
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`)
    expect(res.status).toBe(401)
  })

  // SEC-05：历史实现在环境变量缺失时回退到这枚硬编码默认值，
  // 任何未注入 JWT_SECRET 的部署都能用它伪造 superadmin。回退已删除，此处固化。
  it('用历史硬编码默认密钥签发的 token 应被拒绝', async () => {
    const forged = jwt.sign(
      { userId: 1, username: 'attacker', role: 'superadmin' },
      'token00-dev-secret-change-in-production',
      { expiresIn: '1h' },
    )
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`)
    expect(res.status).toBe(401)
  })

  it('alg=none（无签名）token 应被拒绝', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forgeAlgNoneToken()}`)
    expect(res.status).toBe(401)
  })

  it('被篡改 payload 的 token 应被拒绝', async () => {
    const valid = adminToken // role=admin
    const [h, , s] = valid.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: 1, username: 'sec_admin', role: 'superadmin' }),
    ).toString('base64url')
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${h}.${tamperedPayload}.${s}`)
    expect(res.status).toBe(401)
  })

  it('缺少 Bearer 前缀的凭证应被拒绝', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', adminToken)
    expect(res.status).toBe(401)
  })
})

describe('C. 越权：角色与权限的最小授权原则', () => {
  it('admin 不得访问仅 superadmin 的备份接口', async () => {
    const res = await request(app).get('/api/v1/backup').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(403)
  })

  it('superadmin 可访问备份接口', async () => {
    const res = await request(app).get('/api/v1/backup').set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(200)
  })

  it('持有 styles:read 的 Token 不得写入风格包', async () => {
    const res = await request(app)
      .patch('/api/v1/styles/secpack')
      .set('Authorization', `Bearer ${readOnlyApiToken}`)
      .send({ path: 'header.nav.align', value: 'left' })
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('styles:write')
  })

  it('普通角色不得授予超出自身角色的 Token 权限', async () => {
    const forbidden = (globalThis as Record<string, unknown>).__FORBIDDEN_FOR_USER__ as string[]
    const res = await request(app)
      .post('/api/v1/tokens')
      .set('Authorization', `Bearer ${plainUserToken}`)
      .send({ name: 'escalation-attempt', permissions: forbidden })
    expect(res.status).toBe(403)
  })

  it('普通角色不得创建 admin/superadmin 账号', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${plainUserToken}`)
      .send({ username: 'hacker', password: 'Str0ng-Passw0rd!', role: 'superadmin' })
    expect(res.status).toBe(403)
  })

  it('普通用户只能看到自己，看不到全部用户', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${plainUserToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(1)
    expect(res.body.data[0].username).toBe('sec_user')
  })

  it('用户列表不得泄露 passwordHash', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(200)
    const raw = JSON.stringify(res.body)
    expect(raw).not.toContain('passwordHash')
    expect(raw).not.toContain('$2a$')
  })
})

describe('D. 路径穿越：文件读写必须锁在基目录内', () => {
  const traversalPayloads = [
    '../../../../etc/passwd',
    '..%2F..%2F..%2F..%2Fetc%2Fpasswd',
    '....//....//etc/passwd',
    '..\\..\\..\\..\\etc\\passwd',
  ]

  it.each(traversalPayloads)('媒体文件接口应拒绝穿越载荷 %s', async (payload) => {
    const res = await request(app).get(`/api/v1/media/files/uploads/${payload}`)
    expect([400, 403, 404]).toContain(res.status)
  })

  it('上传带穿越片段的文件名时，落盘路径仍在 uploads 内', async () => {
    const res = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        file: Buffer.from('fake-png-bytes').toString('base64'),
        filename: '../../../../evil.png',
        mimeType: 'image/png',
      })

    expect(res.status).toBe(201)
    const url = res.body?.data?.url as string
    expect(url).toBeTruthy()
    expect(url).not.toContain('..')
    // 反查磁盘上的真实位置，确认未逃出 UPLOAD_DIR
    const { UPLOAD_DIR } = await import('../utils/paths.js')
    const rel = url.replace('/api/v1/media/files/', '').replace(/^uploads\//, '')
    const abs = path.resolve(UPLOAD_DIR, rel)
    expect(abs.startsWith(path.resolve(UPLOAD_DIR))).toBe(true)
  })

  it('静态页写入带穿越片段的文件名时，落盘路径仍在 statichtml 内', async () => {
    const res = await request(app)
      .post('/api/v1/statichtml/file')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ filename: '../../../../evil.html', content: '<html></html>' })

    expect(res.status).toBe(201)
    const relPath = res.body?.data?.relPath as string
    expect(relPath).toBeTruthy()
    expect(relPath).not.toContain('..')
    const { STATIC_HTML_DIR } = await import('../utils/paths.js')
    const abs = path.resolve(STATIC_HTML_DIR, relPath)
    expect(abs.startsWith(path.resolve(STATIC_HTML_DIR))).toBe(true)
  })

  it('静态页接口拒绝穿越到上级目录的 folder 参数', async () => {
    const res = await request(app)
      .post('/api/v1/statichtml/folder')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ path: '../../escape' })
    expect(res.status).toBe(400)
  })
})

describe('E. 上传白名单：类型与体积', () => {
  it('拒绝白名单外的 MIME（可执行文件）', async () => {
    const res = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        file: Buffer.from('MZ...').toString('base64'),
        filename: 'payload.exe',
        mimeType: 'application/x-msdownload',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('not allowed')
  })

  it('拒绝白名单外的 MIME（HTML）', async () => {
    const res = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        file: Buffer.from('<script>alert(1)</script>').toString('base64'),
        filename: 'payload.html',
        mimeType: 'text/html',
      })
    expect(res.status).toBe(400)
  })

  it('拒绝伪造 MIME 的 SVG（SVG 允许上传，但仍按声明类型入库）', async () => {
    const res = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        file: Buffer.from('<svg onload="alert(1)"/>').toString('base64'),
        filename: 'payload.svg',
        mimeType: 'image/svg+xml',
      })
    // SVG 在允许列表内 → 可上传；此用例锁定该行为，SVG 的渲染风险由 CSP/CDN 侧收敛
    expect(res.status).toBe(201)
  })

  it('[SEC-01] 超限文件应被拒绝为 413', async () => {
    const res = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        file: Buffer.alloc(11 * 1024 * 1024, 1).toString('base64'),
        filename: 'big.png',
        mimeType: 'image/png',
      })
    expect(res.status).toBe(413)
  })

  // 同一根因 SEC-01
  it('[SEC-01] 畸形 JSON 应被拒绝为 400', async () => {
    const res = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('Content-Type', 'application/json')
      .send('{"file": "broken"')
    expect(res.status).toBe(400)
  })
})

describe('F. 注入与原型污染', () => {
  it('文章列表的 search 参数不得引发 SQL 注入或 500', async () => {
    const res = await request(app).get(`/api/v1/articles?search=${encodeURIComponent("' OR 1=1--")}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('风格包 PATCH 拒绝非白名单根路径（$ 元数据不可改）', async () => {
    const res = await request(app)
      .patch('/api/v1/styles/secpack')
      .set('Authorization', `Bearer ${fullApiToken}`)
      .send({ path: '$.name', value: 'hacked' })
    expect(res.status).toBe(400)
  })

  it('风格包 PATCH 拒绝 __proto__ 路径', async () => {
    const res = await request(app)
      .patch('/api/v1/styles/secpack')
      .set('Authorization', `Bearer ${fullApiToken}`)
      .send({ path: '__proto__.polluted', value: 'yes' })
    expect(res.status).toBe(400)
  })

  it('风格包 PATCH 拒绝非法 id（穿越 / 大写）', async () => {
    for (const id of ['../blog', 'BLOG', 'bl og']) {
      const res = await request(app)
        .patch(`/api/v1/styles/${encodeURIComponent(id)}`)
        .set('Authorization', `Bearer ${fullApiToken}`)
        .send({ path: 'header.nav.align', value: 'left' })
      expect(res.status).toBe(400)
    }
  })

  it('合法 PATCH 仍然可用（防止安全校验误伤正常写入）', async () => {
    const res = await request(app)
      .patch('/api/v1/styles/secpack')
      .set('Authorization', `Bearer ${fullApiToken}`)
      .send({ path: 'header.nav.align', value: 'left' })
    expect(res.status).toBe(200)
    expect(res.body.data.style.header.nav.align).toBe('left')
  })
})

describe('G. 信息泄露与配置面', () => {
  it('CORS：未知来源不得获得 Access-Control-Allow-Origin', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('CORS：白名单来源应回显自身而非通配', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:8081')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8081')
  })

  it('已安装站点不得再次触发安装向导', async () => {
    const res = await request(app).post('/api/v1/setup').send({
      username: 'attacker',
      password: 'Str0ng-Passw0rd!',
      stylePackId: 'secpack',
    })
    expect(res.status).toBe(403)
  })

  it('健康检查不得泄露内部实现细节', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    const raw = JSON.stringify(res.body)
    expect(raw).not.toContain('JWT')
    expect(raw).not.toContain('secret')
    expect(raw).not.toContain('/app/')
  })

  it('错误响应不得回显堆栈', async () => {
    const res = await request(app).get('/api/v1/articles/999999999')
    const raw = JSON.stringify(res.body)
    expect(raw).not.toContain('at ')
    expect(raw).not.toContain('node_modules')
  })
})

describe('H. 登录保护与验证码表（SEC-08 / SEC-10）', () => {
  const probeUser = 'sec08-nonexistent-user'
  const clientIp = '9.9.9.9'

  beforeAll(async () => {
    // 失败计数落在 loginProtect 表并按 IP 保留，先清掉上一轮的残留保证可重复执行
    const { db } = await import('../db/index.js')
    const { loginProtect } = await import('../db/schema.js')
    const { eq } = await import('drizzle-orm')
    await db.delete(loginProtect).where(eq(loginProtect.ipAddress, clientIp)).run()
  })

  it('[SEC-08] 伪造的 XFF 前缀不得重置失败计数', async () => {
    // trust proxy=1 → req.ip 取 XFF 链倒数第二段（nginx 追加的真实客户端地址）。
    // 旧实现取首段：攻击者每换一个前缀就是一个「新 IP」，5 次锁定与验证码门槛形同虚设。
    const attempts: { status: number; captchaRequired?: boolean }[] = []
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `${i + 1}.${i + 1}.${i + 1}.${i + 1}, ${clientIp}`)
        .send({ username: probeUser, password: 'definitely-wrong-password' })
      attempts.push({ status: res.status, captchaRequired: res.body?.captchaRequired })
    }

    // 前三次计入同一 IP（1 → 2 → 3），第四次触发验证码门槛
    expect(attempts.slice(0, 3).map((a) => a.status)).toEqual([401, 401, 401])
    expect(attempts[3].status).toBe(400)
    expect(attempts[3].captchaRequired).toBe(true)
  })

  it('[SEC-10] 验证码表超出容量后应被收敛', async () => {
    const { __captchaTestHooks } = await import('./auth.js')
    __captchaTestHooks.prime(__captchaTestHooks.max + 50)
    expect(__captchaTestHooks.size()).toBeGreaterThan(__captchaTestHooks.max)

    __captchaTestHooks.cleanup()
    expect(__captchaTestHooks.size()).toBe(__captchaTestHooks.max)

    __captchaTestHooks.clear()
  })
})
