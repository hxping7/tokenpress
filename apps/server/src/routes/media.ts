import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc, sql, count as sqlCount, like, or, and, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { media } from '../db/schema.js'
import { authMiddleware, adminOrAbove, type AuthRequest } from '../middleware/auth.js'
import { apiTokenAuth, requirePermission, type ApiAuthRequest } from '../middleware/apiToken.js'
import { sanitizeFilename, isAllowedMimeType, formatFileSize } from '@tokenpress/shared'
import { getParamAsInt } from '../utils/params.js'
import { auditLog } from '../utils/auditLogger.js'
import { UPLOAD_DIR, MEDIA_URL_PREFIX } from '../utils/paths.js'
import { scheduleReview } from '../lib/contentReview/index.js'

const router = Router()

// Upload directory
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Allowed types from constants
const ALL_ALLOWED_TYPES = [
  ...(await import('@tokenpress/shared')).UPLOAD_LIMITS.allowedImageTypes,
  ...(await import('@tokenpress/shared')).UPLOAD_LIMITS.allowedVideoTypes,
  ...(await import('@tokenpress/shared')).UPLOAD_LIMITS.allowedAudioTypes,
  ...(await import('@tokenpress/shared')).UPLOAD_LIMITS.allowedDocumentTypes,
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
//
async function handleUpload(req: any, res: any, userId: number) {
  const { file, filename, mimeType, url: fileUrl, section, articleId } = req.body

  // 验证 articleId（可选）
  let validArticleId: number | null = null
  if (articleId) {
    const parsed = Number(articleId)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid articleId: must be a positive integer' })
    }
    validArticleId = parsed
  }

  // --- URL reference upload ---
  if (fileUrl) {
    try {
      var result = await db.insert(media).values({
        filename: path.basename(fileUrl) || `external-${uuidv4()}`,
        originalName: filename || path.basename(fileUrl) || 'external-file',
        mimeType: mimeType || 'image/*',
        size: 0,
        url: fileUrl,
        thumbnailUrl: null,
        uploadedBy: userId,
        articleId: validArticleId || null,
      }).run()
    } catch (dbErr: any) {
      console.error('Media insert error (URL mode):', dbErr)
      return res.status(500).json({ success: false, error: 'Database write failed', detail: dbErr.message })
    }

    const id = Number(result.lastInsertRowid)

    try {
      var mediaRecord = await db.select().from(media).where(eq(media.id, id)).get()
    } catch (dbErr: any) {
      console.error('Media select error after insert:', dbErr)
      return res.status(500).json({ success: false, error: 'Failed to read back media record', detail: dbErr.message })
    }

    // Audit log (non-blocking)
    auditLog(req, 'upload', 'media', id, `Uploaded media: ${path.basename(fileUrl) || 'external-file'}`).catch(err =>
      console.error('Audit log failed (non-fatal):', err)
    )

    // Content review (non-blocking, isolated)
    if ((mimeType || '').startsWith('image/')) {
      scheduleReview({
        targetType: 'media',
        targetId: id,
        imageUrls: [fileUrl],
      }).catch(err => console.error('Failed to schedule media review:', err))
    }

    return res.status(201).json({
      success: true,
      data: {
        ...mediaRecord,
        fullUrl: fileUrl,   // URL引用上传，fileUrl本身已是完整URL
      },
    })
  }

  // --- Base64 file upload ---
  if (file && filename && mimeType) {
    // Validate MIME type
    const allowedTypes = ALL_ALLOWED_TYPES
    if (!isAllowedMimeType(mimeType, allowedTypes)) {
      return res.status(400).json({ success: false, error: `File type ${mimeType} is not allowed` })
    }

    // Determine max size by category
    const { UPLOAD_LIMITS } = await import('@tokenpress/shared')
    let maxSize = UPLOAD_LIMITS.documentSize
    if (UPLOAD_LIMITS.allowedImageTypes.includes(mimeType)) {
      maxSize = UPLOAD_LIMITS.imageSize
    } else if (UPLOAD_LIMITS.allowedVideoTypes.includes(mimeType)) {
      maxSize = UPLOAD_LIMITS.videoSize
    } else if (UPLOAD_LIMITS.allowedAudioTypes.includes(mimeType)) {
      maxSize = UPLOAD_LIMITS.audioSize
    }

    // Decode base64
    let buffer: Buffer
    try {
      buffer = Buffer.from(file, 'base64')
    } catch (decodeErr: any) {
      return res.status(400).json({ success: false, error: 'Invalid base64 data', detail: decodeErr.message })
    }

    if (buffer.length > maxSize) {
      return res.status(400).json({ success: false, error: `File too large. Max ${maxSize / 1024 / 1024}MB` })
    }

    // Ensure upload subdirectory exists (按月维度: uploads/YYYY/MM/section/)
    const now = new Date()
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const subdir = section
      ? path.join(UPLOAD_DIR, yearMonth, section)
      : path.join(UPLOAD_DIR, yearMonth)
    try {
      if (!fs.existsSync(subdir)) {
        fs.mkdirSync(subdir, { recursive: true })
      }
    } catch (fsErr: any) {
      console.error('Failed to create upload directory:', fsErr)
      return res.status(500).json({ success: false, error: 'Failed to create upload directory', detail: fsErr.message })
    }

    // Sanitize filename & write file
    const safeName = sanitizeFilename(filename)
    const filePath = path.join(subdir, safeName)
    try {
      fs.writeFileSync(filePath, buffer)
    } catch (writeErr: any) {
      console.error('File write error:', writeErr)
      return res.status(500).json({ success: false, error: 'Failed to write file to disk', detail: writeErr.message })
    }

    const relativePath = section
      ? `uploads/${yearMonth}/${section}/${safeName}`
      : `uploads/${yearMonth}/${safeName}`
    const publicUrl = `${MEDIA_URL_PREFIX}${relativePath}`

    // Insert into database
    try {
      var result = await db.insert(media).values({
        filename: safeName,
        originalName: filename,
        mimeType,
        size: buffer.length,
        url: publicUrl,
        thumbnailUrl: null,
        uploadedBy: userId,
        articleId: validArticleId || null,
      }).run()
    } catch (dbErr: any) {
      // Rollback: delete the written file since DB insert failed
      try { fs.unlinkSync(filePath) } catch (_) { /* ignore cleanup failure */ }
      console.error('Media DB insert error:', dbErr)
      return res.status(500).json({ success: false, error: 'Database write failed', detail: dbErr.message })
    }

    const id = Number(result.lastInsertRowid)

    try {
      var mediaRecord = await db.select().from(media).where(eq(media.id, id)).get()
    } catch (dbErr: any) {
      console.error('Media select error after insert:', dbErr)
      return res.status(500).json({ success: false, error: 'Failed to read back media record', detail: dbErr.message })
    }

    // Audit log (non-blocking — must not block upload response)
    auditLog(req, 'upload', 'media', id, `Uploaded media: ${safeName}`).catch(err =>
      console.error('Audit log failed (non-fatal):', err)
    )

    // Content review (non-blocking, fully isolated)
    if (mimeType.startsWith('image/')) {
      scheduleReview({
        targetType: 'media',
        targetId: id,
        imageUrls: [publicUrl],
      }).catch(err => console.error('Failed to schedule media review:', err))
    }

    // Build full URL for agent verification
    const siteUrl = process.env.SITE_URL || ''
    const fullUrl = siteUrl ? `${siteUrl}${publicUrl}` : publicUrl

    return res.status(201).json({
      success: true,
      data: {
        ...mediaRecord,
        fullUrl,   // 完整URL，方便Agent直接验证可访问性
      },
    })
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
  } catch (err: any) {
    console.error('Upload error:', err)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Upload failed',
        detail: process.env.NODE_ENV === 'development' ? err?.message : undefined,
      })
    }
  }
})

// ===== API Token upload =====
router.post('/ai', apiTokenAuth, requirePermission('media:upload'), async (req: ApiAuthRequest, res) => {
  try {
    await handleUpload(req, res, req.apiToken!.userId)
  } catch (err: any) {
    console.error('AI upload error:', err)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Upload failed',
        detail: process.env.NODE_ENV === 'development' ? err?.message : undefined,
      })
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

    // Delete physical file if it's local（含路径遍历防护）
    if (item.url && !item.url.startsWith('http')) {
      const relativePath = item.url.replace(MEDIA_URL_PREFIX, '').replace(/^uploads\//, '')
      const filePath = path.resolve(UPLOAD_DIR, relativePath)
      if (filePath.startsWith(UPLOAD_DIR) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    if (item.thumbnailUrl && !item.thumbnailUrl.startsWith('http')) {
      const relativePath = item.thumbnailUrl.replace(MEDIA_URL_PREFIX, '').replace(/^uploads\//, '')
      const filePath = path.resolve(UPLOAD_DIR, relativePath)
      if (filePath.startsWith(UPLOAD_DIR) && fs.existsSync(filePath)) {
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

    // Validate all IDs are positive integers
    const validIds = ids.filter(id => Number.isInteger(id) && id > 0)
    if (validIds.length !== ids.length) {
      return res.status(400).json({ success: false, error: 'Invalid ID values' })
    }

    // Get all items to delete
    const items = await db.select().from(media).where(inArray(media.id, validIds)).all()

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
        const relativePath = item.url.replace(MEDIA_URL_PREFIX, '').replace(/^uploads\//, '')
        const filePath = path.join(UPLOAD_DIR, relativePath)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
      if (item.thumbnailUrl && !item.thumbnailUrl.startsWith('http')) {
        const relativePath = item.thumbnailUrl.replace(MEDIA_URL_PREFIX, '').replace(/^uploads\//, '')
        const filePath = path.join(UPLOAD_DIR, relativePath)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    }

    // Delete database records
    await db.delete(media).where(inArray(media.id, validIds)).run()

    await auditLog(req, 'batch_delete', 'media', undefined, `Batch deleted ${items.length} media items`)
    res.json({ success: true, message: `${items.length} items deleted` })
  } catch (err) {
    console.error('Batch delete media error:', err)
    res.status(500).json({ success: false, error: 'Failed to batch delete media' })
  }
})

export default router