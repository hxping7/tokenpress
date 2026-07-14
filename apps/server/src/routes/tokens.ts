import { Router } from 'express'
import crypto from 'crypto'
import { db } from '../db/index.js'
import { apiTokens, users } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'

const router = Router()
router.use(authMiddleware)

// GET /api/v1/tokens — list current user's tokens
router.get('/', async (req: AuthRequest, res) => {
  try {
    const allTokens = await db.select({
      id: apiTokens.id,
      name: apiTokens.name,
      token: apiTokens.token,
      permissions: apiTokens.permissions,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      isActive: apiTokens.isActive,
      createdAt: apiTokens.createdAt,
    })
      .from(apiTokens)
      .where(eq(apiTokens.userId, req.user!.userId))
      .all()

    const result = allTokens.map(t => ({
      id: t.id,
      name: t.name,
      token: t.token, // Return full token for display (masked in frontend if needed)
      permissions: JSON.parse(t.permissions),
      last_used_at: t.lastUsedAt,
      expires_at: t.expiresAt,
      is_active: t.isActive === 1,
      created_at: t.createdAt,
    }))

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('List tokens error:', err)
    res.status(500).json({ success: false, error: 'Failed to list tokens' })
  }
})

// POST /api/v1/tokens — create new token (permissions limited by role)
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, permissions, expiresAt } = req.body

    if (!name || !permissions?.length) {
      return res.status(400).json({ success: false, error: 'Name and permissions are required' })
    }

    const validPermissions = [
      'article:write', 'media:upload', 'work:write', 'content:delete', 'settings:write',
      'friendlinks:write', 'sections:write', 'categories:write',
      'users:write', 'stats:read', 'logs:read', 'backup:write',
      'reviews:write', 'keywords:write', 'ads:write', 'ads:read', 'ads:delete',
      'statichtml:write', 'statichtml:read',
      'styles:write', 'styles:read', 'works:write',
    ]
    const invalidPerms = permissions.filter((p: string) => !validPermissions.includes(p))
    if (invalidPerms.length) {
      return res.status(400).json({ success: false, error: `Invalid permissions: ${invalidPerms.join(', ')}` })
    }

    // Enforce role-based permission limits
    const role = req.user!.role
    const allowedByRole: Record<string, string[]> = {
      superadmin: [
        'article:write', 'media:upload', 'work:write', 'content:delete', 'settings:write',
        'friendlinks:write', 'sections:write', 'categories:write',
        'users:write', 'stats:read', 'logs:read', 'backup:write',
        'reviews:write', 'keywords:write', 'ads:write', 'ads:read', 'ads:delete',
        'statichtml:write', 'statichtml:read',
        'styles:write', 'styles:read', 'works:write',
      ],
      admin: [
        'article:write', 'media:upload', 'work:write', 'content:delete', 'settings:write',
        'friendlinks:write', 'sections:write', 'categories:write',
        'stats:read', 'logs:read', 'backup:write',
        'reviews:write', 'keywords:write', 'ads:write', 'ads:read', 'ads:delete',
        'statichtml:write', 'statichtml:read',
        'styles:write', 'styles:read', 'works:write',
      ],
      user: ['article:write', 'media:upload'],
    }
    const allowed = allowedByRole[role] || allowedByRole.user
    const disallowed = permissions.filter((p: string) => !allowed.includes(p))
    if (disallowed.length) {
      return res.status(403).json({ success: false, error: `Your role cannot grant these permissions: ${disallowed.join(', ')}` })
    }

    // Generate token: t00_sk_<32 hex chars>
    const rawToken = `t00_sk_${crypto.randomBytes(24).toString('hex')}`

    const result = await db.insert(apiTokens).values({
      userId: req.user!.userId,
      token: rawToken,
      name,
      permissions: JSON.stringify(permissions),
      expiresAt: expiresAt || null,
    }).run()

    const id = Number(result.lastInsertRowid)

    await auditLog(req, 'create', 'api_token', id, `Created API token: ${name}`)
    res.status(201).json({
      success: true,
      data: {
        id,
        name,
        token: rawToken, // Only show full token on creation!
        permissions,
        expires_at: expiresAt || null,
        is_active: true,
      },
      message: 'Token created. Save it now — you won\'t see it again!',
    })
  } catch (err) {
    console.error('Create token error:', err)
    res.status(500).json({ success: false, error: 'Failed to create token' })
  }
})

// PATCH /api/v1/tokens/:id — toggle token active status
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const tokenId = getParamAsInt(req.params.id)
    if (!tokenId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const { is_active } = req.body

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'is_active must be a boolean' })
    }

    const existing = await db.select().from(apiTokens)
      .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, req.user!.userId)))
      .get()

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Token not found' })
    }

    await db.update(apiTokens)
      .set({ isActive: is_active ? 1 : 0 })
      .where(eq(apiTokens.id, tokenId))
      .run()

    await auditLog(req, 'update', 'api_token', tokenId, `Toggled API token: ${existing.name}`)
    const updated = await db.select().from(apiTokens).where(eq(apiTokens.id, tokenId)).get()

    res.json({
      success: true,
      data: {
        id: updated!.id,
        name: updated!.name,
        token: updated!.token,
        permissions: JSON.parse(updated!.permissions),
        last_used_at: updated!.lastUsedAt,
        expires_at: updated!.expiresAt,
        is_active: updated!.isActive === 1,
        created_at: updated!.createdAt,
      },
    })
  } catch (err) {
    console.error('Update token error:', err)
    res.status(500).json({ success: false, error: 'Failed to update token' })
  }
})

// PUT /api/v1/tokens/:id — update token
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const tokenId = getParamAsInt(req.params.id)
    if (!tokenId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const { name, permissions, isActive, expiresAt } = req.body

    const existing = await db.select().from(apiTokens)
      .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, req.user!.userId)))
      .get()

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Token not found' })
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (permissions !== undefined) updates.permissions = JSON.stringify(permissions)
    if (isActive !== undefined) updates.isActive = isActive ? 1 : 0
    if (expiresAt !== undefined) updates.expiresAt = expiresAt

    await db.update(apiTokens).set(updates).where(eq(apiTokens.id, tokenId)).run()

    await auditLog(req, 'update', 'api_token', tokenId, `Updated API token: ${existing.name}`)
    const updated = await db.select().from(apiTokens).where(eq(apiTokens.id, tokenId)).get()

    res.json({
      success: true,
      data: {
        id: updated!.id,
        name: updated!.name,
        token: updated!.token,
        permissions: JSON.parse(updated!.permissions),
        last_used_at: updated!.lastUsedAt,
        expires_at: updated!.expiresAt,
        is_active: updated!.isActive === 1,
        created_at: updated!.createdAt,
      },
    })
  } catch (err) {
    console.error('Update token error:', err)
    res.status(500).json({ success: false, error: 'Failed to update token' })
  }
})

// DELETE /api/v1/tokens/:id — revoke token
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const tokenId = getParamAsInt(req.params.id)
    if (!tokenId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const existing = await db.select().from(apiTokens)
      .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, req.user!.userId)))
      .get()

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Token not found' })
    }

    await db.delete(apiTokens).where(eq(apiTokens.id, tokenId)).run()

    await auditLog(req, 'delete', 'api_token', tokenId, `Revoked API token: ${existing.name}`)
    res.json({ success: true, message: 'Token revoked successfully' })
  } catch (err) {
    console.error('Delete token error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete token' })
  }
})

export default router
