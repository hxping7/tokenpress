import { Request, Response, NextFunction } from 'express'

/**
 * CORS 收紧中间件
 * 仅允许配置的域名访问 API
 * 注意：AI 智能体通过 API Token 调用不受 CORS 限制（服务端到服务端请求）
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const origin = req.headers.origin || ''
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.SITE_URL,
    'https://token00.com',
    'https://www.token00.com',
  ].filter(Boolean)

  // 允许无 origin 的请求（服务端调用、移动端、curl 等）
  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }
    return next()
  }

  // 检查 origin 是否在白名单中
  if (allowedOrigins.some((allowed) => origin === allowed)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  next()
}
