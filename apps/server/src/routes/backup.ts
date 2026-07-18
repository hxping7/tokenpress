import { Router, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import archiver from 'archiver'
import unzipper from 'unzipper'
import { db } from '../db/index.js'
import { backups, siteSettings } from '../db/schema.js'
import { type AuthRequest } from '../middleware/auth.js'
import { apiTokenOrSuperAdmin } from '../middleware/apiTokenOrAdmin.js'
import { eq, desc } from 'drizzle-orm'

const router = Router()
router.use(apiTokenOrSuperAdmin('site:write'))

const DATA_DIR = path.resolve(process.cwd(), 'data')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const DB_FILE = path.join(DATA_DIR, 'token00.db')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

// 安全限制
const MAX_RESTORE_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_ZIP_ENTRIES = 10000 // 最大文件数
const MAX_ZIP_RATIO = 100 // 压缩比上限（防止压缩炸弹）

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

// 安全验证文件名（防止路径遍历）
function sanitizeFilename(filename: string): string | null {
  // 移除非允许的字符，但允许括号和空格（用户可能重命名下载的文件）
  const cleaned = filename.replace(/[^\w\-.\s()]/g, '')
  // 不允许以点开头
  if (cleaned.startsWith('.')) {
    return null
  }
  return cleaned.trim()
}

// 验证路径是否在指定目录内（防止路径遍历）
function isPathSafe(targetPath: string, baseDir: string): boolean {
  const resolved = path.resolve(targetPath)
  const normalized = path.normalize(resolved)
  return normalized.startsWith(baseDir)
}

// 验证备份文件名格式
function isValidBackupFilename(filename: string): boolean {
  // 格式: backup-YYYY-MM-DDTHH-MM-SS-{manual|auto}-{8位随机字符}.zip
  return /^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(manual|auto)-[a-z0-9]{8}\.zip$/.test(filename)
}

// 配置默认值
const DEFAULT_SETTINGS = {
  autoBackup: false,
  intervalHours: 24,
  retentionDays: 30,
  includeUploads: true,
}

// 获取备份配置
async function getBackupSettings() {
  const keys = ['backup_auto_enabled', 'backup_interval_hours', 'backup_retention_days', 'backup_include_uploads']
  const settings = await db.select().from(siteSettings).where(eq(siteSettings.key, keys[0] || ''))

  const result = { ...DEFAULT_SETTINGS }
  const allSettings = await db.select().from(siteSettings)

  for (const setting of allSettings) {
    if (setting.key === 'backup_auto_enabled') {
      result.autoBackup = setting.value === 'true'
    } else if (setting.key === 'backup_interval_hours') {
      result.intervalHours = parseInt(setting.value || '24', 10)
    } else if (setting.key === 'backup_retention_days') {
      result.retentionDays = parseInt(setting.value || '30', 10)
    } else if (setting.key === 'backup_include_uploads') {
      result.includeUploads = setting.value === 'true'
    }
  }

  return result
}

// 保存备份配置
async function saveBackupSettings(settings: Partial<typeof DEFAULT_SETTINGS>) {
  const updates: Array<{ key: string; value: string }> = []

  if (settings.autoBackup !== undefined) {
    updates.push({ key: 'backup_auto_enabled', value: String(settings.autoBackup) })
  }
  if (settings.intervalHours !== undefined) {
    updates.push({ key: 'backup_interval_hours', value: String(settings.intervalHours) })
  }
  if (settings.retentionDays !== undefined) {
    updates.push({ key: 'backup_retention_days', value: String(settings.retentionDays) })
  }
  if (settings.includeUploads !== undefined) {
    updates.push({ key: 'backup_include_uploads', value: String(settings.includeUploads) })
  }

  for (const update of updates) {
    const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, update.key))
    if (existing.length > 0) {
      await db.update(siteSettings).set({ value: update.value }).where(eq(siteSettings.key, update.key))
    } else {
      await db.insert(siteSettings).values({ key: update.key, value: update.value })
    }
  }
}

// 创建备份文件
async function createBackupFile(type: 'manual' | 'auto', includeUploads: boolean): Promise<{ filename: string; size: number }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const randomId = Math.random().toString(36).slice(2, 10)
  const filename = `backup-${timestamp}-${type}-${randomId}.zip`
  const filepath = path.join(BACKUP_DIR, filename)

  console.log(`Starting backup: ${filename}`)
  console.log(`DB_FILE exists: ${fs.existsSync(DB_FILE)}, size: ${fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0}`)
  console.log(`UPLOADS_DIR exists: ${fs.existsSync(UPLOADS_DIR)}, includeUploads: ${includeUploads}`)

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(filepath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    let totalSize = 0

    output.on('close', () => {
      totalSize = archive.pointer()
      console.log(`Backup completed: ${filename}, size: ${totalSize}`)
      resolve({ filename, size: totalSize })
    })

    archive.on('error', (err) => {
      console.error(`Backup archive error: ${err.message}`)
      reject(err)
    })

    archive.on('warning', (err) => {
      console.warn(`Backup archive warning: ${err.message}`)
    })

    archive.pipe(output)

    // 添加数据库文件
    if (fs.existsSync(DB_FILE)) {
      archive.file(DB_FILE, { name: 'database/token00.db' })
    }

    // 添加上传文件
    if (includeUploads && fs.existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, 'uploads')
    }

    // 添加清单文件
    const manifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      type,
      includeUploads,
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

    // 使用 finalize 返回的 promise
    archive.finalize().then(() => {
      console.log(`Archive finalize done: ${filename}`)
    }).catch((err) => {
      console.error(`Archive finalize error: ${err.message}`)
      reject(err)
    })
  })
}

// 清理过期备份
async function cleanupOldBackups(retentionDays: number) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const oldBackups = await db.select().from(backups).where(eq(backups.status, 'completed'))

  for (const backup of oldBackups) {
    const backupDate = new Date(backup.createdAt)
    if (backupDate < cutoffDate) {
      // 删除文件
      const filepath = path.join(BACKUP_DIR, backup.filename)
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
      }
      // 删除记录
      await db.delete(backups).where(eq(backups.id, backup.id))
    }
  }
}

// 安全解压备份文件（防止 Zip Slip）
async function safeExtractZip(zipPath: string, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const extractedFiles: string[] = []
    let totalCompressedSize = 0
    let totalUncompressedSize = 0

    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on('entry', (entry: any) => {
        const entryPath = entry.path
        const entryType = entry.type

        // 安全检查：路径遍历
        const fullPath = path.join(targetDir, entryPath)
        if (!isPathSafe(fullPath, targetDir)) {
          entry.autodrain()
          reject(new Error(`Unsafe path detected: ${entryPath}`))
          return
        }

        // 检查文件数量
        if (extractedFiles.length >= MAX_ZIP_ENTRIES) {
          entry.autodrain()
          reject(new Error('Too many files in archive'))
          return
        }

        // 记录压缩比
        totalCompressedSize += entry.vars.compressedSize || 0
        totalUncompressedSize += entry.vars.uncompressedSize || 0

        // 检查压缩比（防止压缩炸弹）
        if (totalCompressedSize > 0 && totalUncompressedSize / totalCompressedSize > MAX_ZIP_RATIO) {
          entry.autodrain()
          reject(new Error('Compression ratio too high (possible zip bomb)'))
          return
        }

        // 只允许特定目录结构
        const allowedPrefixes = ['database/', 'uploads/', 'manifest.json']
        const isAllowed = allowedPrefixes.some(p => entryPath === p || entryPath.startsWith(p))
        if (!isAllowed) {
          entry.autodrain()
          return // 跳过不允许的文件
        }

        extractedFiles.push(entryPath)

        // 创建目录结构
        const dir = path.dirname(fullPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        // 写入文件
        if (entryType === 'File') {
          entry.pipe(fs.createWriteStream(fullPath))
        } else {
          entry.autodrain()
        }
      })
      .on('close', () => {
        resolve()
      })
      .on('error', reject)
  })
}

// 还原备份
async function restoreBackup(filepath: string): Promise<void> {
  const restoreDir = path.join(DATA_DIR, 'restore_temp_' + crypto.randomUUID())

  try {
    // 安全解压
    await safeExtractZip(filepath, restoreDir)

    // 还原数据库
    const restoredDb = path.join(restoreDir, 'database', 'token00.db')
    if (fs.existsSync(restoredDb)) {
      // 验证数据库文件大小（至少1KB）
      const dbStat = fs.statSync(restoredDb)
      if (dbStat.size < 1024) {
        throw new Error('Invalid database file: too small')
      }

      // 备份当前数据库
      if (fs.existsSync(DB_FILE)) {
        const preRestoreBackup = DB_FILE + '.pre-restore-' + Date.now()
        fs.copyFileSync(DB_FILE, preRestoreBackup)
        // 保留最近3个预还原备份
        const backups = fs.readdirSync(path.dirname(DB_FILE))
          .filter(f => f.startsWith('token00.db.pre-restore-'))
          .sort()
          .slice(0, -3)
        backups.forEach(f => {
          try { fs.unlinkSync(path.join(path.dirname(DB_FILE), f)) } catch {}
        })
      }
      fs.copyFileSync(restoredDb, DB_FILE)
    }

    // 还原上传文件
    const restoredUploads = path.join(restoreDir, 'uploads')
    if (fs.existsSync(restoredUploads)) {
      if (fs.existsSync(UPLOADS_DIR)) {
        fs.rmSync(UPLOADS_DIR, { recursive: true })
      }
      fs.cpSync(restoredUploads, UPLOADS_DIR, { recursive: true })
    }
  } finally {
    // 清理临时目录
    if (fs.existsSync(restoreDir)) {
      fs.rmSync(restoreDir, { recursive: true })
    }
  }
}

// 定时任务管理
let backupIntervalId: NodeJS.Timeout | null = null

async function startAutoBackup() {
  const settings = await getBackupSettings()

  // 停止已有任务
  if (backupIntervalId) {
    clearInterval(backupIntervalId)
    backupIntervalId = null
  }

  if (!settings.autoBackup) return

  // 启动新任务
  const intervalMs = settings.intervalHours * 60 * 60 * 1000
  backupIntervalId = setInterval(async () => {
    try {
      console.log('🔄 Starting auto backup...')
      const { filename, size } = await createBackupFile('auto', settings.includeUploads)

      await db.insert(backups).values({
        filename,
        size,
        type: 'auto',
        status: 'completed',
      })

      await cleanupOldBackups(settings.retentionDays)
      console.log(`✅ Auto backup completed: ${filename}`)
    } catch (err) {
      console.error('❌ Auto backup failed:', err)
    }
  }, intervalMs)

  console.log(`✅ Auto backup scheduled every ${settings.intervalHours} hours`)
}

// ===== API Routes =====

// GET /api/v1/backup/settings - 获取备份配置
router.get('/settings', async (req: AuthRequest, res) => {
  try {
    const settings = await getBackupSettings()
    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('Get backup settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get backup settings' })
  }
})

// PUT /api/v1/backup/settings - 更新备份配置
router.put('/settings', async (req: AuthRequest, res) => {
  try {
    const { autoBackup, intervalHours, retentionDays, includeUploads } = req.body

    // 参数验证
    if (intervalHours !== undefined && (intervalHours < 1 || intervalHours > 720)) {
      return res.status(400).json({ success: false, error: 'Interval must be between 1 and 720 hours' })
    }
    if (retentionDays !== undefined && (retentionDays < 1 || retentionDays > 365)) {
      return res.status(400).json({ success: false, error: 'Retention days must be between 1 and 365' })
    }

    await saveBackupSettings({ autoBackup, intervalHours, retentionDays, includeUploads })

    // 重启定时任务
    await startAutoBackup()

    res.json({ success: true, data: await getBackupSettings() })
  } catch (error) {
    console.error('Update backup settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to update backup settings' })
  }
})

// POST /api/v1/backup - 手动创建备份
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { includeUploads = true } = req.body
    console.log('Creating manual backup, includeUploads:', includeUploads)

    // 创建备份记录
    const [backup] = await db.insert(backups).values({
      filename: 'pending',
      size: 0,
      type: 'manual',
      status: 'pending',
      createdBy: req.user!.userId,
    }).returning()

    console.log('Backup record created with id:', backup.id)

    // 执行备份
    const { filename, size } = await createBackupFile('manual', includeUploads)

    console.log('Backup file created:', filename, 'size:', size)

    // 更新记录
    await db.update(backups)
      .set({ filename, size, status: 'completed' })
      .where(eq(backups.id, backup.id))

    console.log('Backup record updated to completed')

    res.json({ success: true, data: { id: backup.id, filename, size } })
  } catch (error: any) {
    console.error('Create backup error:', error)
    // 更新状态为失败
    try {
      const all = await db.select().from(backups).where(eq(backups.status, 'pending'))
      for (const b of all) {
        await db.update(backups).set({ status: 'failed' }).where(eq(backups.id, b.id))
      }
    } catch {}
    res.status(500).json({ success: false, error: 'Failed to create backup: ' + (error?.message || 'Unknown error') })
  }
})

// GET /api/v1/backup - 获取备份列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const list = await db.select()
      .from(backups)
      .orderBy(desc(backups.createdAt))
      .limit(50)

    res.json({ success: true, data: list })
  } catch (error) {
    console.error('Get backup list error:', error)
    res.status(500).json({ success: false, error: 'Failed to get backup list' })
  }
})

// GET /api/v1/backup/:id/download - 下载备份文件
router.get('/:id/download', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10)
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid backup ID' })
    }

    const [backup] = await db.select().from(backups).where(eq(backups.id, id))

    if (!backup) {
      return res.status(404).json({ success: false, error: 'Backup not found' })
    }

    // 安全验证文件名
    if (!isValidBackupFilename(backup.filename)) {
      console.error(`Invalid backup filename in database: ${backup.filename}`)
      return res.status(500).json({ success: false, error: 'Invalid backup filename' })
    }

    const filepath = path.join(BACKUP_DIR, backup.filename)

    // 再次验证路径安全
    if (!isPathSafe(filepath, BACKUP_DIR)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found' })
    }

    res.download(filepath, backup.filename)
  } catch (error) {
    console.error('Download backup error:', error)
    res.status(500).json({ success: false, error: 'Failed to download backup' })
  }
})

// DELETE /api/v1/backup/:id - 删除备份
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10)
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid backup ID' })
    }

    const [backup] = await db.select().from(backups).where(eq(backups.id, id))

    if (!backup) {
      return res.status(404).json({ success: false, error: 'Backup not found' })
    }

    // 安全验证文件名
    if (!isValidBackupFilename(backup.filename)) {
      console.error(`Invalid backup filename in database: ${backup.filename}`)
      return res.status(500).json({ success: false, error: 'Invalid backup filename' })
    }

    // 删除文件
    const filepath = path.join(BACKUP_DIR, backup.filename)

    // 再次验证路径安全
    if (isPathSafe(filepath, BACKUP_DIR) && fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
    }

    // 删除记录
    await db.delete(backups).where(eq(backups.id, id))

    res.json({ success: true })
  } catch (error) {
    console.error('Delete backup error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete backup' })
  }
})

// POST /api/v1/backup/restore - 上传还原
router.post('/restore', async (req: AuthRequest, res) => {
  try {
    const { fileData, filename } = req.body

    console.log('Restore request:', { filename: filename?.substring(0, 50), fileDataLength: fileData?.length })

    if (!fileData || !filename) {
      return res.status(400).json({ success: false, error: 'No backup file provided' })
    }

    // 验证文件名格式
    const safeName = sanitizeFilename(filename)
    console.log('Sanitized filename:', safeName)
    if (!safeName || !safeName.endsWith('.zip')) {
      return res.status(400).json({ success: false, error: 'Invalid filename: ' + filename.substring(0, 30) })
    }

    // 解码 base64 文件
    let buffer: Buffer
    try {
      buffer = Buffer.from(fileData, 'base64')
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid file data' })
    }

    // 检查文件大小
    if (buffer.length > MAX_RESTORE_FILE_SIZE) {
      return res.status(400).json({ success: false, error: 'File too large (max 100MB)' })
    }

    if (buffer.length < 100) {
      return res.status(400).json({ success: false, error: 'File too small' })
    }

    // 验证 ZIP 文件魔数
    const zipMagic = buffer.slice(0, 4)
    if (zipMagic[0] !== 0x50 || zipMagic[1] !== 0x4B) {
      return res.status(400).json({ success: false, error: 'Invalid ZIP file' })
    }

    const tempPath = path.join(BACKUP_DIR, `restore-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.zip`)

    try {
      fs.writeFileSync(tempPath, buffer)

      // 先备份当前数据
      const { filename: backupFilename } = await createBackupFile('manual', true)
      await db.insert(backups).values({
        filename: backupFilename,
        size: fs.statSync(path.join(BACKUP_DIR, backupFilename)).size,
        type: 'manual',
        status: 'completed',
        createdBy: req.user!.userId,
      })

      // 执行还原
      await restoreBackup(tempPath)

      res.json({ success: true, message: 'Restore completed successfully' })
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
    }
  } catch (error) {
    console.error('Restore backup error:', error)
    res.status(500).json({ success: false, error: 'Failed to restore backup' })
  }
})

// POST /api/v1/backup/:id/restore - 从服务器已有备份还原
router.post('/:id/restore', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10)
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid backup ID' })
    }

    const [backup] = await db.select().from(backups).where(eq(backups.id, id))

    if (!backup) {
      return res.status(404).json({ success: false, error: 'Backup not found' })
    }

    if (backup.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Backup not completed' })
    }

    // 验证文件名
    if (!isValidBackupFilename(backup.filename)) {
      return res.status(400).json({ success: false, error: 'Invalid backup filename' })
    }

    const filepath = path.join(BACKUP_DIR, backup.filename)

    if (!isPathSafe(filepath, BACKUP_DIR) || !fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found' })
    }

    // 先备份当前数据
    const { filename: backupFilename } = await createBackupFile('manual', true)
    await db.insert(backups).values({
      filename: backupFilename,
      size: fs.statSync(path.join(BACKUP_DIR, backupFilename)).size,
      type: 'manual',
      status: 'completed',
      createdBy: req.user!.userId,
    })

    // 执行还原
    await restoreBackup(filepath)

    res.json({ success: true, message: 'Restore completed successfully' })
  } catch (error) {
    console.error('Restore from backup error:', error)
    res.status(500).json({ success: false, error: 'Failed to restore backup' })
  }
})

// 启动时清理未完成的备份
async function cleanupPendingBackups() {
  try {
    const pending = await db.select().from(backups).where(eq(backups.status, 'pending'))
    for (const b of pending) {
      await db.delete(backups).where(eq(backups.id, b.id))
      console.log(`Cleaned up pending backup: ${b.id}`)
    }
  } catch (err) {
    console.error('Failed to cleanup pending backups:', err)
  }
}

// 初始化备份任务
export function initBackupTasks() {
  startAutoBackup().catch(console.error)
  cleanupPendingBackups().catch(console.error)
}

export default router
