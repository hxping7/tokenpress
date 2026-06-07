import { db } from '../db/index.js'
import { auditLogs, systemEvents } from '../db/schema.js'
import type { AuthRequest } from '../middleware/auth.js'

export async function auditLog(
  req: AuthRequest,
  action: string,
  targetType: string,
  targetId?: number,
  detail?: string,
) {
  try {
    await db.insert(auditLogs).values({
      operatorId: req.user!.userId,
      operatorName: req.user!.username,
      operatorRole: req.user!.role,
      action,
      targetType,
      targetId: targetId || null,
      detail: detail || null,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.headers['x-real-ip'] as string
        || req.ip
        || null,
      userAgent: req.headers['user-agent'] || null,
    }).run()
  } catch (err) {
    console.error('Audit log error:', err)
  }
}

export async function systemEvent(
  eventType: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info',
  detail?: string,
) {
  try {
    await db.insert(systemEvents).values({
      eventType,
      level,
      message,
      detail: detail || null,
    }).run()
  } catch (err) {
    console.error('System event error:', err)
  }
}
