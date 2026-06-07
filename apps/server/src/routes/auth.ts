import { Router, type Request } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import svgCaptcha from 'svg-captcha'
import { db } from '../db/index.js'
import { users, loginLogs, loginProtect } from '../db/schema.js'
import { eq, and, lt, isNotNull } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'token00-dev-secret-change-in-production'

// 配置
const MAX_FAIL_COUNT = 5 // 5次失败后锁定
const LOCK_DURATION = 15 * 60 * 1000 // 15分钟
const CAPTCHA_THRESHOLD = 3 // 3次失败后需要验证码
const LOG_RETENTION_DAYS = 90 // 日志保留90天

// 验证码存储
interface CaptchaStore {
  code: string
  expiresAt: number
}
const captchaStore = new Map<string, CaptchaStore>()

// 获取客户端IP
function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.headers['x-real-ip'] as string
    || req.socket.remoteAddress
    || 'unknown'
}

// 清理过期数据（登录失败记录和日志）
async function cleanupExpiredData() {
  try {
    // 删除90天前的登录日志
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS)
    await db.delete(loginLogs).where(lt(loginLogs.createdAt, cutoffDate.toISOString())).run()

    // 清除已过期的锁定记录
    const now = new Date().toISOString()
    await db.update(loginProtect)
      .set({ lockedUntil: null, failCount: 0, captchaRequired: 0, lastFailAt: null })
      .where(and(
        isNotNull(loginProtect.lockedUntil),
        lt(loginProtect.lockedUntil, now)
      ))
      .run()

    console.log('✅ Login protection cleanup completed')
  } catch (err) {
    console.error('❌ Login protection cleanup error:', err)
  }
}

// 启动时清理一次，然后每小时清理一次
cleanupExpiredData()
setInterval(cleanupExpiredData, 60 * 60 * 1000)

// GET /api/v1/auth/captcha - 获取验证码（独立端点）
router.get('/captcha', (_req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: '0o1il',
    noise: 3,
    color: true,
    background: '#f5f5f5',
    width: 150,
    height: 50,
    fontSize: 40,
  })

  const captchaId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5分钟

  // 存储验证码
  captchaStore.set(captchaId, {
    code: captcha.text.toLowerCase(),
    expiresAt,
  })

  res.json({
    success: true,
    data: {
      captchaId,
      image: captcha.data,
    },
  })
})

// 验证码验证函数
function verifyCaptchaCode(captchaId: string, userInput: string): boolean {
  const captcha = captchaStore.get(captchaId)
  if (!captcha) return false

  if (captcha.expiresAt < Date.now()) {
    captchaStore.delete(captchaId)
    return false
  }

  const isValid = captcha.code === userInput.toLowerCase()
  if (isValid) {
    captchaStore.delete(captchaId)
  }
  return isValid
}

// 检查IP状态
async function checkIpStatus(ip: string) {
  const protect = await db.select().from(loginProtect).where(eq(loginProtect.ipAddress, ip)).get()

  if (!protect) {
    return { locked: false, captchaRequired: false, failCount: 0 }
  }

  const now = new Date().toISOString()
  const isLocked = protect.lockedUntil && protect.lockedUntil > now
  const isCaptchaRequired = protect.captchaRequired === 1

  return {
    locked: isLocked,
    lockedUntil: protect.lockedUntil,
    captchaRequired: isCaptchaRequired,
    failCount: protect.failCount,
  }
}

// 记录登录日志
async function logLogin(ip: string, username: string | null, success: boolean, reason: string, userAgent: string) {
  await db.insert(loginLogs).values({
    ipAddress: ip,
    username,
    success: success ? 1 : 0,
    reason,
    userAgent,
  }).run()
}

// 更新IP保护状态
async function updateIpStatus(ip: string, failCount: number, requireCaptcha: boolean) {
  const now = new Date()
  const lockedUntil = failCount >= MAX_FAIL_COUNT
    ? new Date(now.getTime() + LOCK_DURATION).toISOString()
    : null

  const existing = await db.select().from(loginProtect).where(eq(loginProtect.ipAddress, ip)).get()

  if (existing) {
    await db.update(loginProtect)
      .set({
        failCount,
        lockedUntil,
        captchaRequired: requireCaptcha ? 1 : 0,
        lastFailAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(loginProtect.ipAddress, ip))
      .run()
  } else {
    await db.insert(loginProtect).values({
      ipAddress: ip,
      failCount,
      lockedUntil,
      captchaRequired: requireCaptcha ? 1 : 0,
      lastFailAt: new Date().toISOString(),
    }).run()
  }
}

// 清除失败计数（登录成功时）
async function clearIpFailCount(ip: string) {
  const existing = await db.select().from(loginProtect).where(eq(loginProtect.ipAddress, ip)).get()

  if (existing) {
    await db.update(loginProtect)
      .set({
        failCount: 0,
        lockedUntil: null,
        captchaRequired: 0,
        lastFailAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(loginProtect.ipAddress, ip))
      .run()
  }
}

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, captchaId, captchaCode } = req.body
    const ip = getClientIp(req)
    const userAgent = req.headers['user-agent'] || ''

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' })
    }

    // 检查IP锁定状态
    const ipStatus = await checkIpStatus(ip)

    if (ipStatus.locked) {
      const lockedUntil = new Date(ipStatus.lockedUntil!)
      const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
      await logLogin(ip, username, false, 'locked', userAgent)
      return res.status(429).json({
        success: false,
        error: `IP已锁定，请${remainingMinutes}分钟后再试`,
        lockedUntil: ipStatus.lockedUntil,
      })
    }

    // 检查是否需要验证码
    if (ipStatus.captchaRequired || ipStatus.failCount >= CAPTCHA_THRESHOLD) {
      if (!captchaId || !captchaCode) {
        return res.status(400).json({
          success: false,
          error: '请输入验证码',
          captchaRequired: true,
        })
      }

      if (!verifyCaptchaCode(captchaId, captchaCode)) {
        await logLogin(ip, username, false, 'invalid_captcha', userAgent)
        return res.status(400).json({
          success: false,
          error: '验证码错误',
          captchaRequired: true,
        })
      }
    }

    // 验证用户名密码
    const user = await db.select().from(users).where(eq(users.username, username)).get()

    if (!user || !user.isActive) {
      await logLogin(ip, username, false, 'invalid_credentials', userAgent)
      await updateIpStatus(ip, ipStatus.failCount + 1, ipStatus.failCount + 1 >= CAPTCHA_THRESHOLD)
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      await logLogin(ip, username, false, 'invalid_password', userAgent)
      const newFailCount = ipStatus.failCount + 1
      const needCaptcha = newFailCount >= CAPTCHA_THRESHOLD
      await updateIpStatus(ip, newFailCount, needCaptcha)

      // 检查是否需要验证码
      const captchaRequired = newFailCount >= CAPTCHA_THRESHOLD
      if (captchaRequired) {
        return res.status(401).json({
          success: false,
          error: '密码错误，请输入验证码',
          captchaRequired: true,
        })
      }

      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    // 登录成功
    await logLogin(ip, username, true, 'success', userAgent)
    await clearIpFailCount(ip)

    const payload = { userId: user.id, username: user.username, role: user.role }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })

    await db.update(users)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .run()

    const { passwordHash: _, ...safeUser } = user

    res.json({ success: true, data: { token, refreshToken, user: safeUser } })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// POST /api/v1/auth/refresh
router.post('/refresh', authMiddleware, (req: AuthRequest, res) => {
  const payload = { userId: req.user!.userId, username: req.user!.username, role: req.user!.role }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
  res.json({ success: true, data: { token } })
})

// GET /api/v1/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await db.select().from(users).where(eq(users.id, req.user!.userId)).get()
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }
  const { passwordHash: _, ...safeUser } = user
  res.json({ success: true, data: safeUser })
})

export default router