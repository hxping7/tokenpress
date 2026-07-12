import { Router } from 'express'
import { db } from '../db/index.js'
import { siteSettings, apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'
import { reloadProviderFromDB } from '../lib/contentReview/providers/index.js'
import { revalidatePath } from '../utils/revalidate.js'

const router = Router()

// GET /api/v1/site-settings — public
router.get('/', async (_req, res) => {
  try {
    const settings = await db.select().from(siteSettings).all()
    const settingsObj: Record<string, string> = {}
    settings.forEach(s => {
      settingsObj[s.key] = s.value || ''
    })
    res.json({ success: true, data: settingsObj })
  } catch (err) {
    console.error('Get site settings error:', err)
    res.status(500).json({ success: false, error: 'Failed to get site settings' })
  }
})

// PUT /api/v1/site-settings — update multiple settings (admin session or API token)
router.put('/', async (req, res) => {
  try {
    const raw = (req.body as { settings?: unknown }).settings
    if (!raw || typeof raw !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' })
    }
    // 兼容两种入参：对象 {key: value} 或数组 [{key, value}]
    const settingsObj: Record<string, unknown> = {}
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && typeof item === 'object' && 'key' in item) {
          settingsObj[(item as Record<string, unknown>).key as string] = (item as Record<string, unknown>).value
        }
      }
    } else {
      Object.assign(settingsObj, raw)
    }

    // Check auth: either API token with settings:write, or admin session
    const authHeader = req.headers.authorization

    if (authHeader?.startsWith('Bearer t00_sk_')) {
      // API Token authentication
      const rawToken = authHeader.slice(7)
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
      if (!permissions.includes('settings:write')) {
        return res.status(403).json({ success: false, error: 'Missing required permission: settings:write' })
      }

      // Update last used time
      await db.update(apiTokens)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(apiTokens.id, tokenRecord.id))
        .run()
    } else {
      // JWT Session authentication
      const authReq = req as AuthRequest
      if (!authReq.user) {
        // Try to authenticate via JWT middleware
        await new Promise<void>((resolve, reject) => {
          authMiddleware(req, res, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      }

      const authReqAfter = req as AuthRequest
      if (!authReqAfter.user || (authReqAfter.user.role !== 'superadmin' && authReqAfter.user.role !== 'admin')) {
        return res.status(403).json({ success: false, error: 'Admin access required' })
      }
    }

    for (const [key, value] of Object.entries(settingsObj)) {
      // 非字符串值（对象/数组）自动 JSON 序列化后存储
      const strValue = typeof value === 'string' ? value : JSON.stringify(value)
      const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).get()

      if (existing) {
        await db.update(siteSettings)
          .set({ value: strValue, updatedAt: new Date().toISOString() })
          .where(eq(siteSettings.key, key))
          .run()
      } else {
        await db.insert(siteSettings).values({ key, value: strValue }).run()
      }
    }

    // Reload content review provider if review-related settings changed
    const reviewKeys = Object.keys(settingsObj).filter(k => k.startsWith('review_'))
    if (reviewKeys.length > 0) {
      await reloadProviderFromDB()
    }

    // Revalidate homepage ISR cache so hero_size etc. take effect immediately
    revalidatePath('/')

    // Return updated settings
    const allSettings = await db.select().from(siteSettings).all()
    const resultObj: Record<string, string> = {}
    allSettings.forEach(s => {
      resultObj[s.key] = s.value || ''
    })

    const authReq = req as AuthRequest
    if (authReq.user) {
      await auditLog(authReq, 'update', 'site_settings', undefined, `Updated settings: ${Object.keys(settingsObj).join(', ')}`)
    }

    res.json({ success: true, data: resultObj })
  } catch (err) {
    console.error('Update site settings error:', err)
    res.status(500).json({ success: false, error: 'Failed to update site settings' })
  }
})

// GET /api/v1/site-settings/keys/:keys — public
router.get('/keys/:keys', async (req, res) => {
  try {
    const keys = (req.params.keys as string).split(',').map(k => k.trim())
    const settings = await db.select().from(siteSettings).all()

    const result: Record<string, string> = {}
    settings.forEach(s => {
      if (keys.includes(s.key)) {
        result[s.key] = s.value || ''
      }
    })

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('Get site settings by keys error:', err)
    res.status(500).json({ success: false, error: 'Failed to get site settings' })
  }
})

export default router