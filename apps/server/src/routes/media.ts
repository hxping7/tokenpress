import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc, sql, count as sqlCount, like, or, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { media } from '../db/schema.js'
import { authMiddleware, adminOrAbove, type AuthRequest } from '../middleware/auth.js'
import { apiTokenAuth, requirePermission, type ApiAuthRequest } from '../middleware/apiToken.js'
import { sanitizeFilename, isAllowedMimeType, formatFileSize } from '@token00/shared'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'
import { scheduleReview } from '../lib/contentReview/index.js'

const router = Router()

// Upload directory
const UPLOAD_DIR = path.resolve(process.cwd(), 'data', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Allowed types from constants
const ALL_ALLOWED_TYPES = [
  ...(await import('@token00/shared')).UPLOAD_LIMITS.allowedImageTypes,
  ...(await import('@token00/shared')).UPLOAD_LIMITS.allowedVideoTypes,
  ...(await import('@token00/shared')).UPLOAD_LIMITS.allowedAudioTypes,
  ...(await import('@token00/shared')).UPLOAD_LIMITS.allowedDocumentTypes,
]

// ===== Static file serving =====
router.get('/files/uploads/*', (req, res) => {
  try {
    const match = req.url.match(/^\/files\/uploads\/(.+)$/)
    const filePath = match ? match[1] : null

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Invalid file path' })
    }

    const fullPath = path.join(UPLOAD_DIR, filePath)

    // Security: prevent directory traversal
    const resolvedPath = path.resolve(fullPath)
    if (!resolvedPath.startsWith(UPLOAD_DIR)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, error: 'File not found' })
    }

    res.sendFile(resolvedPath)
  } catch (err) {
    console.error('File serve error:', err)
    res.status(500).json({ success: false, error: 'Failed to serve file' })
  }
})

// ===== Upload handlers =====

async function handleUpload(req: any, res: any, userId: number) {
  const { file, filename, mimeType, url: fileUrl, section } = req.body

  if (fileUrl) {
    const result = await db.insert(media).values({
      filename: path.basename(fileUrl) || `external-${uuidv4()}`,
      originalName: filename || path.basename(fileUrl) || 'external-file',
      mimeType: mimeType || 'image/*',
      size: 0,
      url: fileUrl,
      thumbnailUrl: null,
      uploadedBy: userId,
    }).run()

    const id = Number(result.lastInsertRowid)
    const mediaRecord = await db.select().from(media).where(eq(media.id, id)).get()

    await auditLog(req, 'upload', 'media', id, `Uploaded media: ${path.basename(fileUrl) || 'external-file'}`)

    // Schedule content review for image uploads
    if ((mimeType || '').startsWith('image/')) {
      scheduleReview({
        targetType: 'media',
        targetId: id,
        imageUrls: [fileUrl],
      }).catch(err => console.error('Failed to schedule media review:', err))
    }

    return res.status(201).json({ success: true, data: mediaRecord })
  }

  if (file && filename && mimeType) {
    const allowedTypes = ALL_ALLOWED_TYPES
    if (!isAllowedMimeType(mimeType, allowedTypes)) {
      return res.status(400).json({ success: false, error: `File type ${mimeType} is not allowed` })
    }

    const { UPLOAD_LIMITS } = await import('@token00/shared')
    let maxSize = UPLOAD_LIMITS.documentSize
    if (UPLOAD_LIMITS.allowedImageTypes.includes(mimeType)) {
      maxSize = UPLOAD_LIMITS.imageSize
    } else if (UPLOAD_LIMITS.allowedVideoTypes.includes(mimeType)) {
      maxSize = UPLOAD_LIMITS.videoSize
    } else if (UPLOAD_LIMITS.allowedAudioTypes.includes(mimeType)) {
      maxSize = UPLOAD_LIMITS.audioSize
    }

    const buffer = Buffer.from(file, 'base64')
    if (buffer.length > maxSize) {
      return res.status(400).json({ success: false, error: `File too large. Max ${maxSize / 1024 / 1024}MB` })
    }

    const subdir = section ? path.join(UPLOAD_DIR, section) : UPLOAD_DIR
    if (!fs.existsSync(subdir)) {
      fs.mkdirSync(subdir, { recursive: true })
    }

    const safeName = sanitizeFilename(filename)
    const filePath = path.join(subdir, safeName)
    fs.writeFileSync(filePath, buffer)

    const relativePath = section ? `uploads/${section}/${safeName}` : `uploads/${safeName}`
    const publicUrl = `/api/v1/media/files/${relativePath}`

    const result = await db.insert(media).values({
      filename: safeName,
      originalName: filename,
      mimeType,
      size: buffer.length,
      url: publicUrl,
      thumbnailUrl: null,
      uploadedBy: userId,
    }).run()

    const id = Number(result.lastInsertRowid)
    const mediaRecord = await db.select().from(media).where(eq(media.id, id)).get()

    await auditLog(req, 'upload', 'media', id, `Uploaded media: ${safeName}`)

    // Schedule content review for image uploads
    if (mimeType.startsWith('image/')) {
      scheduleReview({
        targetType: 'media',
        targetId: id,
        imageUrls: [publicUrl],
      }).catch(err => console.error('Failed to schedule media review:', err))
    }

    return res.status(201).json({ success: true, data: mediaRecord })
  }

  return res.status(400).json({
    success: false,
    error: 'No file provided. Send either { file (base64), filename, mimeType } or { url }',
  })
}

// ===== JWT auth upload =====
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await handleUpload(req, res, req.user!.userId)
  } catch (err) {
    console.error('Upload error:', err)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Upload failed' })
    }
  }
})

// ===== API Token upload =====
router.post('/ai', apiTokenAuth, requirePermission('media:upload'), async (req: ApiAuthRequest, res) => {
  try {
    await handleUpload(req, res, req.apiToken!.userId)
  } catch (err) {
    console.error('AI upload error:', err)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Upload failed' })
    }
  }
})

// ===== List media with pagination and search =====
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const search = (req.query.search as string || '').trim()
    const type = (req.query.type as string || '').trim() // 'image', 'video', 'document'
    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = []

    // user role: only see own uploads
    if (req.user!.role === 'user') {
      conditions.push(eq(media.uploadedBy, req.user!.userId))
    }

    if (search) {
      conditions.push(
        or(
          like(media.originalName, `%${search}%`),
          like(media.filename, `%${search}%`)
        )
      )
    }

    if (type === 'image') {
      conditions.push(sql`${media.mimeType} LIKE 'image/%'`)
    } else if (type === 'video') {
      conditions.push(sql`${media.mimeType} LIKE 'video/%'`)
    } else if (type === 'document') {
      conditions.push(sql`${media.mimeType} NOT LIKE 'image/%' AND ${media.mimeType} NOT LIKE 'video/%'`)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Get total count
    const countResult = await db.select({ total: sqlCount() })
      .from(media)
      .where(whereClause as any)
      .get()

    // Get paginated items
    const items = await db.select()
      .from(media)
      .where(whereClause as any)
      .orderBy(desc(media.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const total = countResult?.total || 0
    const totalPages = Math.ceil(total / limit)

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages },
    })
  } catch (err) {
    console.error('List media error:', err)
    res.status(500).json({ success: false, error: 'Failed to list media' })
  }
})

// ===== Get single media item =====
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const mediaId = getParamAsInt(req.params.id)
    if (!mediaId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }

    const item = await db.select().from(media).where(eq(media.id, mediaId)).get()

    if (!item) {
      return res.status(404).json({ success: false, error: 'Media not found' })
    }

    res.json({ success: true, data: item })
  } catch (err) {
    console.error('Get media error:', err)
    res.status(500).json({ success: false, error: 'Failed to get media' })
  }
})

// ===== Delete media =====
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const mediaId = getParamAsInt(req.params.id)
    if (!mediaId) {
      return res.status(400).json({ success: false, error: 'Invalid ID' })
    }
    const item = await db.select().from(media).where(eq(media.id, mediaId)).get()

    if (!item) {
      return res.status(404).json({ success: false, error: 'Media not found' })
    }

    if (req.user!.role === 'user' && item.uploadedBy !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Cannot delete other users media' })
    }

    // Delete physical file if it's local
    if (item.url && !item.url.startsWith('http')) {
      const filePath = path.join(process.cwd(), 'data', item.url)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await db.delete(media).where(eq(media.id, mediaId)).run()

    await auditLog(req, 'delete', 'media', mediaId, `Deleted media: ${item.filename}`)
    res.json({ success: true, message: 'Media deleted' })
  } catch (err) {
    console.error('Delete media error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete media' })
  }
})

// ===== Batch delete media =====
router.post('/batch-delete', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body as { ids: number[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid IDs array' })
    }

    // Get all items to delete
    const items = await db.select().from(media).where(sql`${media.id} IN (${ids.join(',')})`).all()

    // Permission check: user can only delete own uploads
    if (req.user!.role === 'user') {
      const notOwn = items.find(item => item.uploadedBy !== req.user!.userId)
      if (notOwn) {
        return res.status(403).json({ success: false, error: 'Cannot delete other users media' })
      }
    }

    // Delete physical files
    for (const item of items) {
      if (item.url && !item.url.startsWith('http')) {
        const filePath = path.join(process.cwd(), 'data', item.url)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    }

    // Delete database records
    await db.delete(media).where(sql`${media.id} IN (${ids.join(',')})`).run()

    await auditLog(req, 'batch_delete', 'media', undefined, `Batch deleted ${items.length} media items`)
    res.json({ success: true, message: `${items.length} items deleted` })
  } catch (err) {
    console.error('Batch delete media error:', err)
    res.status(500).json({ success: false, error: 'Failed to batch delete media' })
  }
})

export default router