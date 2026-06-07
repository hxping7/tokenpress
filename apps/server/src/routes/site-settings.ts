import { Router } from 'express'
import { db } from '../db/index.js'
import { siteSettings, apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'

const router = Router()

// GET /api/v1/site-settings — public, get all settings as key-value object
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
    const { settings } = req.body as { settings: Record<string, string> }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' })
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

    for (const [key, value] of Object.entries(settings)) {
      const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).get()

      if (existing) {
        await db.update(siteSettings)
          .set({ value, updatedAt: new Date().toISOString() })
          .where(eq(siteSettings.key, key))
          .run()
      } else {
        await db.insert(siteSettings).values({ key, value }).run()
      }
    }

    // Return updated settings
    const allSettings = await db.select().from(siteSettings).all()
    const settingsObj: Record<string, string> = {}
    allSettings.forEach(s => {
      settingsObj[s.key] = s.value || ''
    })

    const authReq = req as AuthRequest
    if (authReq.user) {
      await auditLog(authReq, 'update', 'site_settings', undefined, `Updated settings: ${Object.keys(settings).join(', ')}`)
    }

    res.json({ success: true, data: settingsObj })
  } catch (err) {
    console.error('Update site settings error:', err)
    res.status(500).json({ success: false, error: 'Failed to update site settings' })
  }
})

// GET /api/v1/site-settings/keys/:keys — public, get specific settings by keys (comma-separated)
router.get('/keys/:keys', async (req, res) => {
  try {
    const keys = req.params.keys.split(',').map(k => k.trim())
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