import { db } from '../db/index.js'
import { siteSettings } from '../db/schema.js'
import { inArray } from 'drizzle-orm'

/**
 * 限流阈值集中管理：所有值均可在 Web 后台「系统设置 → 安全 → 限流保护」中配置，
 * 保存后经 site-settings 路由写入 site_settings 表，并由 refreshRateLimits() 立即刷新缓存，
 * 无需重启服务即可生效。未在后台配置时回落到以下默认值。
 */
export const RATE_LIMIT_DEFAULTS = {
  // 全局兜底：所有 /api/ 请求，窗口 60s
  rate_limit_global: 1000,
  // 登录尝试：/api/v1/auth/login，窗口 15min
  rate_limit_auth: 30,
  // 文章接口：/api/v1/articles，窗口 60s
  rate_limit_articles: 150,
  // 互动接口：/api/v1/interactions，窗口 60s
  rate_limit_interactions: 150,
  // AI 发布：/api/v1/ai，窗口 60s
  rate_limit_ai_publish: 30,
  // 广告接口：/api/v1/ads，窗口 60s
  rate_limit_ads: 120,
} as const

export type RateLimitKey = keyof typeof RATE_LIMIT_DEFAULTS

// 内存缓存：避免每个请求都查库。TTL 到期后在请求中后台刷新。
let cache: Record<RateLimitKey, number> = { ...RATE_LIMIT_DEFAULTS }
let lastFetched = 0
let refreshing = false
const TTL_MS = 30_000

async function refreshFromDb(): Promise<void> {
  try {
    const keys = Object.keys(RATE_LIMIT_DEFAULTS) as RateLimitKey[]
    const rows = await db
      .select()
      .from(siteSettings)
      .where(inArray(siteSettings.key, keys))
      .all()
    const next: Record<RateLimitKey, number> = { ...RATE_LIMIT_DEFAULTS }
    for (const row of rows as { key: string; value: string | null }[]) {
      if (row.key in RATE_LIMIT_DEFAULTS) {
        const n = parseInt(row.value || '', 10)
        // 仅接受正整数；0 或非数字回落默认，避免误配把接口彻底封死
        if (Number.isFinite(n) && n > 0) {
          next[row.key as RateLimitKey] = n
        }
      }
    }
    cache = next
    lastFetched = Date.now()
  } catch (err) {
    // 保留上次缓存；DB 未就绪也不阻塞请求
    console.error('[rateLimit] refresh failed:', err)
  }
}

function maybeRefresh(): void {
  if (refreshing) return
  if (Date.now() - lastFetched <= TTL_MS) return
  refreshing = true
  void refreshFromDb().finally(() => {
    refreshing = false
  })
}

/**
 * 供 express-rate-limit 的 max 选项使用（同步返回，后台懒刷新）。
 * max 变化后下一次请求即生效（存量 bucket 沿用其创建时的阈值，新请求用新阈值）。
 */
export function getRateLimitMax(key: RateLimitKey): number {
  maybeRefresh()
  return cache[key]
}

/** 主动刷新缓存（启动初始化 / 后台保存设置后调用），确保立即生效。 */
export async function refreshRateLimits(): Promise<void> {
  await refreshFromDb()
}
