import {Router} from 'express'
import { db } from '../db/index.js'
import { auditLogs, loginLogs, apiLogs, systemEvents, users, apiTokens } from '../db/schema.js'
import { eq, and, desc, sql, like, gte, lte } from 'drizzle-orm'
import { authMiddleware, adminOrAbove, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// ===== Audit Logs =====
router.get('/audit', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const { action, targetType, operatorId, search, startDate, endDate } = req.query

    const conditions: any[] = []

    // Permission: user sees own, admin sees own+user, superadmin sees all
    const role = req.user!.role
    if (role === 'user') {
      conditions.push(eq(auditLogs.operatorId, req.user!.userId))
    } else if (role === 'admin') {
      const userRows = await db.select({ id: users.id }).from(users)
        .where(sql`${users.role} IN ('admin', 'user')`)
        .all()
      const allowedIds = userRows.map(u => u.id)
      conditions.push(sql`${auditLogs.operatorId} IN (${allowedIds.join(',') || '0'})`)
    }

    if (action) conditions.push(eq(auditLogs.action, action as string))
    if (targetType) conditions.push(eq(auditLogs.targetType, targetType as string))
    if (operatorId) conditions.push(eq(auditLogs.operatorId, parseInt(operatorId as string)))
    if (search) conditions.push(like(auditLogs.detail, `%${search}%`))
    if (startDate) conditions.push(gte(auditLogs.createdAt, startDate as string))
    if (endDate) conditions.push(lte(auditLogs.createdAt, endDate as string))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(auditLogs).where(whereClause as any).get()

    const items = await db.select().from(auditLogs)
      .where(whereClause as any)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit).offset(offset).all()

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total: countResult?.count || 0, totalPages: Math.ceil((countResult?.count || 0) / limit) },
    })
  } catch (err) {
    console.error('Get audit logs error:', err)
    res.status(500).json({ success: false, error: 'Failed to get audit logs' })
  }
})

// ===== Login Logs =====
router.get('/login', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const { username, success, startDate, endDate } = req.query

    const conditions: any[] = []

    const role = req.user!.role
    if (role === 'user') {
      conditions.push(eq(loginLogs.username, req.user!.username))
    }

    if (username) conditions.push(like(loginLogs.username, `%${username}%`))
    if (success !== undefined) conditions.push(eq(loginLogs.success, success === 'true' ? 1 : 0))
    if (startDate) conditions.push(gte(loginLogs.createdAt, startDate as string))
    if (endDate) conditions.push(lte(loginLogs.createdAt, endDate as string))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(loginLogs).where(whereClause as any).get()

    const items = await db.select().from(loginLogs)
      .where(whereClause as any)
      .orderBy(desc(loginLogs.createdAt))
      .limit(limit).offset(offset).all()

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total: countResult?.count || 0, totalPages: Math.ceil((countResult?.count || 0) / limit) },
    })
  } catch (err) {
    console.error('Get login logs error:', err)
    res.status(500).json({ success: false, error: 'Failed to get login logs' })
  }
})

// ===== API Logs =====
router.get('/api', authMiddleware, adminOrAbove, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const { endpoint, method, statusCode, startDate, endDate } = req.query

    const conditions: any[] = []
    if (endpoint) conditions.push(like(apiLogs.endpoint, `%${endpoint}%`))
    if (method) conditions.push(eq(apiLogs.method, method as string))
    if (statusCode) conditions.push(eq(apiLogs.statusCode, parseInt(statusCode as string)))
    if (startDate) conditions.push(gte(apiLogs.createdAt, startDate as string))
    if (endDate) conditions.push(lte(apiLogs.createdAt, endDate as string))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(apiLogs).where(whereClause as any).get()

    const items = await db.select({
      id: apiLogs.id,
      tokenId: apiLogs.tokenId,
      endpoint: apiLogs.endpoint,
      method: apiLogs.method,
      statusCode: apiLogs.statusCode,
      responseTime: apiLogs.responseTime,
      ipAddress: apiLogs.ipAddress,
      userAgent: apiLogs.userAgent,
      contentUrl: apiLogs.contentUrl,
      error: apiLogs.error,
      createdAt: apiLogs.createdAt,
      tokenName: apiTokens.name,
      tokenOwner: users.username,
      token: apiTokens.token,
    })
      .from(apiLogs)
      .leftJoin(apiTokens, eq(apiLogs.tokenId, apiTokens.id))
      .leftJoin(users, eq(apiTokens.userId, users.id))
      .where(whereClause as any)
      .orderBy(desc(apiLogs.createdAt))
      .limit(limit).offset(offset).all()

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total: countResult?.count || 0, totalPages: Math.ceil((countResult?.count || 0) / limit) },
    })
  } catch (err) {
    console.error('Get API logs error:', err)
    res.status(500).json({ success: false, error: 'Failed to get API logs' })
  }
})

// ===== System Events =====
router.get('/system', authMiddleware, adminOrAbove, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const { eventType, level, startDate, endDate } = req.query

    const conditions: any[] = []
    if (eventType) conditions.push(eq(systemEvents.eventType, eventType as string))
    if (level) conditions.push(eq(systemEvents.level, level as 'info' | 'warn' | 'error'))
    if (startDate) conditions.push(gte(systemEvents.createdAt, startDate as string))
    if (endDate) conditions.push(lte(systemEvents.createdAt, endDate as string))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(systemEvents).where(whereClause as any).get()

    const items = await db.select().from(systemEvents)
      .where(whereClause as any)
      .orderBy(desc(systemEvents.createdAt))
      .limit(limit).offset(offset).all()

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total: countResult?.count || 0, totalPages: Math.ceil((countResult?.count || 0) / limit) },
    })
  } catch (err) {
    console.error('Get system events error:', err)
    res.status(500).json({ success: false, error: 'Failed to get system events' })
  }
})

export default router
