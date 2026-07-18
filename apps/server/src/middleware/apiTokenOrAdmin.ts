import type { Request, Response, NextFunction } from 'express'
import { db } from '../db/index.js'
import { apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, adminOnly, superAdminOnly, type AuthRequest } from './auth.js'
import { logApiUsage } from './apiToken.js'
import { satisfiesPermission } from '@tokenpress/shared'

/**
 * JWT 回退守卫工厂：
 * - `adminGuard`  → authMiddleware + adminOnly（admin 或 superadmin）
 * - `superAdminGuard` → authMiddleware + superAdminOnly（仅 superadmin）
 * 用于 token 未命中时回退到普通管理员会话鉴权。
 */
function adminGuard(req: Request, res: Response, next: NextFunction) {
  authMiddleware(req as AuthRequest, res, (err) => {
    if (err) return next(err)
    adminOnly(req as AuthRequest, res, next)
  })
}

function superAdminGuard(req: Request, res: Response, next: NextFunction) {
  authMiddleware(req as AuthRequest, res, (err) => {
    if (err) return next(err)
    superAdminOnly(req as AuthRequest, res, next)
  })
}

/**
 * 中间件工厂：API Token（指定权限） 或 JWT 管理员 二选一鉴权。
 *
 * - 若请求携带 `Authorization: Bearer t00_sk_xxx` 且 Token 有效并拥有指定权限，
 *   注入合成 admin 身份（`req.user`）后放行，并记录 API 用量日志（供下游 auditLog 等使用）。
 * - 否则回退到 `jwtFallback`（默认管理员会话，高危接口可传 superAdminGuard）。
 *
 * 用于让后台"设置/管理"类写接口既能被管理员在后台操作，也能被持有对应权限
 * API Token 的 AI 智能体远程控制，从而实现按 Token 权限隔离。
 *
 * @param permission  要求的权限字符串，如 'site:write'
 * @param jwtFallback token 未命中时使用的 JWT 守卫，默认 adminGuard
 */
export function apiTokenOrAdmin(
  permission: string,
  jwtFallback: (req: Request, res: Response, next: NextFunction) => void = adminGuard,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization

    if (authHeader?.startsWith('Bearer t00_sk_')) {
      const rawToken = authHeader.slice(7)
      const startTime = Date.now()
      try {
        const tokenRecord = await db.select().from(apiTokens).where(eq(apiTokens.token, rawToken)).get()

        if (!tokenRecord) {
          return res.status(401).json({ success: false, error: 'API token not found' })
        }
        if (!tokenRecord.isActive) {
          return res.status(401).json({ success: false, error: 'API token has been revoked' })
        }
        if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
          return res.status(401).json({ success: false, error: 'API token has expired' })
        }

        const permissions: string[] = JSON.parse(tokenRecord.permissions)
        if (!satisfiesPermission(permissions, permission)) {
          return res.status(403).json({
            success: false,
            error: `Missing required permission: ${permission}`,
          })
        }

        // 注入合成 admin 身份，使下游 auditLog / AuthRequest 逻辑正常工作
        const authReq = req as AuthRequest
        authReq.user = {
          userId: tokenRecord.userId,
          username: 'api-token',
          role: 'admin',
        }
        ;(authReq as unknown as { apiToken?: unknown }).apiToken = {
          id: tokenRecord.id,
          userId: tokenRecord.userId,
          permissions,
        }

        // 更新最后使用时间（失败不影响主流程）
        await db.update(apiTokens)
          .set({ lastUsedAt: new Date().toISOString() })
          .where(eq(apiTokens.id, tokenRecord.id))
          .run()

        // 记录 API 用量日志（与 apiTokenAuth 一致）
        const originalJson = res.json.bind(res)
        res.json = (body: any) => {
          const forwardedFor = req.headers['x-forwarded-for']
          const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]
          const clientIp = forwardedIp?.trim() || req.ip
          logApiUsage({
            tokenId: tokenRecord.id,
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime: Date.now() - startTime,
            ipAddress: clientIp || req.socket?.remoteAddress,
            userAgent: req.headers['user-agent'],
            contentUrl: undefined,
          }).catch(() => {})
          return originalJson(body)
        }

        return next()
      } catch {
        return res.status(401).json({ success: false, error: 'Invalid API token' })
      }
    }

    // 回退到 JWT 管理员会话鉴权
    jwtFallback(req, res, next)
  }
}

/**
 * 便捷封装：token 指定权限 或 JWT superadmin 二选一。
 * 用于备份/还原等仅 superadmin 可操作的高危接口。
 */
export function apiTokenOrSuperAdmin(permission: string) {
  return apiTokenOrAdmin(permission, superAdminGuard)
}
