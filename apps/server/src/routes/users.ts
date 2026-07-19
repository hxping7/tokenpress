import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'

const router = Router()

function formatUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.displayName,
    role: u.role,
    is_active: u.isActive === 1,
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  }
}

// GET /api/v1/users — superadmin看全部, admin看全部, user只看自己
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const role = req.user!.role
    if (role === 'superadmin' || role === 'admin') {
      const allUsers = await db.select().from(users).all()
      return res.json({ success: true, data: allUsers.map(formatUser) })
    }
    const user = await db.select().from(users).where(eq(users.id, req.user!.userId)).get()
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    return res.json({ success: true, data: [formatUser(user)] })
  } catch (err) {
    console.error('Get users error:', err)
    res.status(500).json({ success: false, error: 'Failed to get users' })
  }
})

// POST /api/v1/users — admin+ 可创建用户
router.post('/', apiTokenOrAdmin('users:write'), async (req: AuthRequest, res) => {
  try {
    const { username, password, displayName, role = 'user' } = req.body
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' })
    }

    // admin 只能创建 user 角色; superadmin 可创建 admin + user
    if (req.user!.role === 'admin' && role !== 'user') {
      return res.status(403).json({ success: false, error: 'Admin can only create user role' })
    }
    if (!['superadmin', 'admin', 'user'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' })
    }

    const existing = await db.select().from(users).where(eq(users.username, username)).get()
    if (existing) {
      return res.status(409).json({ success: false, error: 'Username already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await db.insert(users).values({ username, passwordHash, displayName: displayName || null, role }).run()
    const user = await db.select().from(users).where(eq(users.id, Number(result.lastInsertRowid))).get()
    await auditLog(req, 'create', 'user', Number(result.lastInsertRowid), `Created user ${username} with role ${role}`)
    res.status(201).json({ success: true, data: formatUser(user!) })
  } catch (err) {
    console.error('Create user error:', err)
    res.status(500).json({ success: false, error: 'Failed to create user' })
  }
})

// PUT /api/v1/users/:id — admin+ 可编辑用户
router.put('/:id', apiTokenOrAdmin('users:write'), async (req: AuthRequest, res) => {
  try {
    const userId = getParamAsInt(req.params.id)
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const existing = await db.select().from(users).where(eq(users.id, userId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // superadmin 不可被 admin 编辑
    if (existing.role === 'superadmin' && req.user!.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Cannot edit super admin' })
    }

    // admin 只能编辑 user 角色
    if (req.user!.role === 'admin' && existing.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Admin can only edit user role' })
    }

    const { displayName, role, isActive } = req.body

    // admin 不能设置非 user 角色
    if (role !== undefined && req.user!.role === 'admin' && role !== 'user') {
      return res.status(403).json({ success: false, error: 'Admin can only set user role' })
    }

    // superadmin 不能降级自己
    if (userId === req.user!.userId && role && role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Cannot downgrade yourself' })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (displayName !== undefined) updates.displayName = displayName
    if (role !== undefined) updates.role = role
    if (isActive !== undefined) updates.isActive = isActive ? 1 : 0

    await db.update(users).set(updates).where(eq(users.id, userId)).run()
    const user = await db.select().from(users).where(eq(users.id, userId)).get()
    await auditLog(req, 'update', 'user', userId, `Updated user ${existing.username}`)
    res.json({ success: true, data: formatUser(user!) })
  } catch (err) {
    console.error('Update user error:', err)
    res.status(500).json({ success: false, error: 'Failed to update user' })
  }
})

// PATCH /api/v1/users/:id/reset-password — admin+ 重置他人密码
router.patch('/:id/reset-password', apiTokenOrAdmin('users:write'), async (req: AuthRequest, res) => {
  try {
    const userId = getParamAsInt(req.params.id)
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const existing = await db.select().from(users).where(eq(users.id, userId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // admin 不能重置 superadmin 密码
    if (existing.role === 'superadmin' && req.user!.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Cannot reset super admin password' })
    }
    // admin 只能重置 user 密码
    if (req.user!.role === 'admin' && existing.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Admin can only reset user passwords' })
    }

    const newPassword = crypto.randomBytes(6).toString('hex')
    const passwordHash = await bcrypt.hash(newPassword, 10)

    await db.update(users)
      .set({ passwordHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .run()

    res.json({ success: true, data: { password: newPassword } })
    await auditLog(req, 'reset_password', 'user', userId, `Reset password for ${existing.username}`)
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(500).json({ success: false, error: 'Failed to reset password' })
  }
})

// POST /api/v1/users/me/change-password — 任意登录用户修改自己密码
router.post('/me/change-password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' })
    }

    const user = await db.select().from(users).where(eq(users.id, req.user!.userId)).get()
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' })
    }

    const newHash = await bcrypt.hash(newPassword, 10)
    await db.update(users)
      .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .run()

    res.json({ success: true, message: 'Password changed successfully' })
    await auditLog(req, 'change_password', 'user', req.user!.userId, 'Changed own password')
  } catch (err) {
    console.error('Change password error:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// DELETE /api/v1/users/:id — admin+ 可删除用户
router.delete('/:id', apiTokenOrAdmin('users:write'), async (req: AuthRequest, res) => {
  try {
    const userId = getParamAsInt(req.params.id)
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }
    if (userId === req.user!.userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete yourself' })
    }

    const existing = await db.select().from(users).where(eq(users.id, userId)).get()
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // superadmin 不可被删除
    if (existing.role === 'superadmin') {
      return res.status(403).json({ success: false, error: 'Cannot delete super admin' })
    }
    // admin 只能删除 user 角色
    if (req.user!.role === 'admin' && existing.role !== 'user') {
      return res.status(403).json({ success: false, error: 'Admin can only delete user role' })
    }

    await db.delete(users).where(eq(users.id, userId)).run()
    await auditLog(req, 'delete', 'user', userId, `Deleted user ${existing.username}`)
    res.json({ success: true, message: 'User deleted' })
  } catch (err) {
    console.error('Delete user error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete user' })
  }
})

export default router
