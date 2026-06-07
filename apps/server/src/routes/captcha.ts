import { Router } from 'express'
import svgCaptcha from 'svg-captcha'

const router = Router()

// 内存存储验证码（生产环境建议用Redis）
const captchaStore = new Map<string, { code: string; expiresAt: number }>()

// 验证码配置
const CAPTCHA_EXPIRE = 5 * 60 * 1000 // 5分钟

// 清理过期验证码
function cleanExpiredCaptcha() {
  const now = Date.now()
  for (const [key, value] of captchaStore.entries()) {
    if (value.expiresAt < now) {
      captchaStore.delete(key)
    }
  }
}

// 定期清理（每分钟）
setInterval(cleanExpiredCaptcha, 60 * 1000)

// 生成随机字符串
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// GET /api/v1/auth/captcha - 获取验证码
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

  const captchaId = generateId()
  const expiresAt = Date.now() + CAPTCHA_EXPIRE

  captchaStore.set(captchaId, {
    code: captcha.text.toLowerCase(),
    expiresAt,
  })

  res.json({
    success: true,
    data: {
      captchaId,
      image: captcha.data, // SVG图片
    },
  })
})

// 验证验证码
export function verifyCaptcha(captchaId: string, userInput: string): boolean {
  const captcha = captchaStore.get(captchaId)
  if (!captcha) {
    return false
  }

  if (captcha.expiresAt < Date.now()) {
    captchaStore.delete(captchaId)
    return false
  }

  const isValid = captcha.code === userInput.toLowerCase()
  // 验证成功后删除（一次性）
  if (isValid) {
    captchaStore.delete(captchaId)
  }

  return isValid
}

// 清除验证码
export function clearCaptcha(captchaId: string) {
  captchaStore.delete(captchaId)
}

export default router