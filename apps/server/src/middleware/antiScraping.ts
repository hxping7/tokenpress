import { Request, Response, NextFunction } from 'express'
import { db } from '../db/index.js'
import { siteSettings } from '../db/schema.js'
import { eq } from 'drizzle-orm'

// 需要拦截的爬虫 UA 模式
const BLOCKED_UAS = [
  /curl\//i,
  /python-requests\//i,
  /scrapy\//i,
  /go-http-client\//i,
  /java\//i,
  /httpclient\//i,
  /wget\//i,
  /php\//i,
  /ruby\//i,
]

// 允许的善意爬虫（搜索引擎）
const ALLOWED_UAS = [
  /googlebot\//i,
  /bingbot\//i,
  /baiduspider\//i,
  /yandexbot\//i,
  /duckduckbot\//i,
  /slurp\//i,
  /facebookexternalhit\//i,
  /twitterbot\//i,
  /linkedinbot\//i,
]

// 反爬虫开关缓存
let antiScrapingEnabled: boolean | null = null
let cacheTime = 0
const CACHE_TTL = 60000 // 1分钟缓存

/**
 * 获取反爬虫开关设置
 */
async function getAntiScrapingEnabled(): Promise<boolean> {
  const now = Date.now()
  if (antiScrapingEnabled !== null && now - cacheTime < CACHE_TTL) {
    return antiScrapingEnabled
  }

  try {
    const setting = await db.select().from(siteSettings).where(eq(siteSettings.key, 'anti_scraping_enabled')).get()
    antiScrapingEnabled = setting?.value === 'true'
    cacheTime = now
  } catch {
    antiScrapingEnabled = true // 默认开启
  }

  return antiScrapingEnabled
}

/**
 * User-Agent 黑名单过滤中间件
 * 拦截常见爬虫工具的请求，允许搜索引擎爬虫
 */
export async function antiScrapingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 检查开关是否启用
  const enabled = await getAntiScrapingEnabled()
  if (!enabled) {
    return next()
  }

  // 跳过公开 API 路由
  const publicPaths = ['/api/v1/tags', '/api/v1/sections', '/api/v1/search', '/api/v1/stats', '/api/v1/site-settings']
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next()
  }

  const ua = req.headers['user-agent'] || ''

  // 允许善意爬虫
  if (ALLOWED_UAS.some((pattern) => pattern.test(ua))) {
    return next()
  }

  // 拦截黑名单 UA
  if (BLOCKED_UAS.some((pattern) => pattern.test(ua))) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  next()
}

/**
 * 图片防盗链中间件
 * 检查 Referer 头，拒绝非本站域名的图片请求
 */
export function imageHotlinkProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 只对 /uploads 路径生效
  if (!req.path.startsWith('/uploads')) {
    return next()
  }

  const referer = req.headers.referer
  const allowedDomains: string[] = [
    process.env.SITE_URL,
    process.env.FRONTEND_URL,
    'token00.com',
    'www.token00.com',
  ].filter((d): d is string => Boolean(d))

  // 允许空 referer（直接访问、API 调用）
  if (!referer) return next()

  try {
    const refererHost = new URL(referer).hostname
    if (refererHost && allowedDomains.some((domain) => refererHost.includes(domain))) {
      return next()
    }
  } catch {
    // URL 解析失败，放行
    return next()
  }

  res.status(403).json({ success: false, error: 'Hotlink protection' })
}
