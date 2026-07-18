import type { Request, Response, NextFunction } from 'express'
import { db } from '../db/index.js'
import { apiTokens, apiLogs } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { satisfiesPermission } from '@tokenpress/shared'

export interface ApiAuthRequest extends Request {
  apiToken?: {
    id: number
    userId: number
    permissions: string[]
  }
}

/**
 * Middleware to authenticate requests using API Token
 */
export async function apiTokenAuth(req: ApiAuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const startTime = Date.now()

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing API token' })
  }

  const rawToken = authHeader.slice(7)

  if (!rawToken.startsWith('t00_sk_')) {
    return res.status(401).json({ success: false, error: 'Invalid API token format' })
  }

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

    // Update last used time
    await db.update(apiTokens)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiTokens.id, tokenRecord.id))
      .run()

    const permissions: string[] = JSON.parse(tokenRecord.permissions)

    req.apiToken = {
      id: tokenRecord.id,
      userId: tokenRecord.userId,
      permissions,
    }

    // Log API usage after response
    const originalJson = res.json.bind(res)
    res.json = (body: any) => {
      // Get real IP from X-Forwarded-For header (set by nginx)
      const forwardedFor = req.headers['x-forwarded-for']
      const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]
      const clientIp = forwardedIp?.trim() || req.ip

      // Extract contentUrl - check request body and response
      const requestUrl = req.body?.url || req.body?.linkUrl
      const responseSlug = body?.data?.slug
      const contentUrl = requestUrl || (responseSlug ? `/ai-works/${responseSlug}` : null)

      logApiUsage({
        tokenId: tokenRecord.id,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime: Date.now() - startTime,
        ipAddress: clientIp || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        contentUrl: contentUrl,
      })
      return originalJson(body)
    }

    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid API token' })
  }
}

export function requirePermission(permission: string) {
  return (req: ApiAuthRequest, res: Response, next: NextFunction) => {
    if (!satisfiesPermission(req.apiToken?.permissions ?? [], permission)) {
      return res.status(403).json({
        success: false,
        error: `Missing required permission: ${permission}`,
      })
    }
    next()
  }
}

// Helper to log API usage
export async function logApiUsage(data: {
  tokenId: number
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  ipAddress?: string
  userAgent?: string
  contentUrl?: string
  error?: string
}) {
  try {
    await db.insert(apiLogs).values({
      tokenId: data.tokenId,
      endpoint: data.endpoint,
      method: data.method,
      statusCode: data.statusCode,
      responseTime: data.responseTime,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      contentUrl: data.contentUrl || null,
      error: data.error || null,
    }).run()
  } catch (err) {
    console.error('Failed to log API usage:', err)
  }
}
