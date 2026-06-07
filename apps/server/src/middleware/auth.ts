import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'token00-dev-secret-change-in-production'

export interface AuthRequest extends Request {
  user?: {
    userId: number
    username: string
    role: 'superadmin' | 'admin' | 'user'
  }
}

function normalizeRole(role: string): 'superadmin' | 'admin' | 'user' {
  if (role === 'superadmin') return 'superadmin'
  if (role === 'admin' || role === 'editor') return 'admin'
  return 'user'
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: number
      username: string
      role: string
    }
    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: normalizeRole(payload.role),
    }
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export function superAdminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Super admin access required' })
  }
  next()
}

export function adminOrAbove(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin' && req.user!.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Admin access required' })
  }
  next()
}

// @deprecated Use adminOrAbove instead
export const adminOnly = adminOrAbove
