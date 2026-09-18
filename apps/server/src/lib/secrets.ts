import { randomBytes } from 'node:crypto'

/**
 * 密钥解析与启动期强度校验（SEC-05）。
 *
 * 旧实现在 `JWT_SECRET` / `REVALIDATE_SECRET` 缺失时静默回退到硬编码字符串，
 * 任何未显式注入环境变量的部署（含误配的生产容器）都能用公开值伪造 superadmin JWT。
 * 这里改为：生产环境缺失或强度不足 → 直接抛错终止启动；非生产环境 → 生成一次性
 * 随机密钥并告警（重启即失效，仅用于本地开发）。
 */
const MIN_SECRET_LENGTH = 32

const cache = new Map<string, string>()

function resolveSecret(name: string): string {
  const cached = cache.get(name)
  if (cached) return cached

  const isProduction = process.env.NODE_ENV === 'production'
  const raw = process.env[name]?.trim()

  if (!raw) {
    if (isProduction) {
      throw new Error(
        `[SEC-05] ${name} 未配置。生产环境必须显式注入长度不小于 ${MIN_SECRET_LENGTH} 位的随机密钥，启动已终止。`,
      )
    }
    const ephemeral = randomBytes(32).toString('hex')
    console.warn(
      `[SEC-05] ${name} 未配置，已生成一次性随机开发密钥（进程重启后登录态失效）。生产部署前必须显式注入。`,
    )
    cache.set(name, ephemeral)
    return ephemeral
  }

  if (raw.length < MIN_SECRET_LENGTH) {
    const msg = `[SEC-05] ${name} 长度为 ${raw.length}，低于建议的 ${MIN_SECRET_LENGTH} 位。`
    if (isProduction) {
      throw new Error(`${msg} 生产环境已拒绝启动，请使用 crypto.randomBytes(32).toString('hex') 生成。`)
    }
    console.warn(`${msg} 建议更换为强随机值。`)
  }

  cache.set(name, raw)
  return raw
}

/** 登录 JWT 的签发/验签密钥 */
export function getJwtSecret(): string {
  return resolveSecret('JWT_SECRET')
}

/** 后端通知前端刷新缓存的共享口令 */
export function getRevalidateSecret(): string {
  return resolveSecret('REVALIDATE_SECRET')
}

/** 供测试在修改 process.env 后强制重新解析 */
export function resetSecretCache(): void {
  cache.clear()
}
