import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { apiTokenOrAdmin } from '../middleware/apiTokenOrAdmin.js'
import { auditLog } from '../utils/auditLogger.js'
import { STATIC_HTML_DIR } from '../utils/paths.js'
import { type AuthRequest } from '../middleware/auth.js'

const router = Router()

// Ensure root directory exists
if (!fs.existsSync(STATIC_HTML_DIR)) {
  fs.mkdirSync(STATIC_HTML_DIR, { recursive: true })
}

// Allowed file extensions for static pages (web assets)
const ALLOWED_EXT = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'json', 'svg', 'png', 'jpg',
  'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp', 'txt', 'md', 'markdown',
  'map', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'pdf', 'xml', 'webmanifest',
])

// Resolve a relative path inside STATIC_HTML_DIR, guarding against traversal.
// Returns absolute path, or null if it escapes the root.
function safeResolve(relPath: string): string | null {
  const resolved = path.resolve(STATIC_HTML_DIR, relPath)
  if (resolved === STATIC_HTML_DIR || resolved.startsWith(STATIC_HTML_DIR + path.sep)) {
    return resolved
  }
  return null
}

function publicUrl(relPath: string): string {
  return `/statichtml/${relPath.split(path.sep).join('/')}`
}

// Sanitize a user-provided filename while PRESERVING the exact name (no random
// suffix) so that static URLs stay predictable (e.g. test.html -> /statichtml/test.html).
// Strips directory components and unsafe characters; keeps the extension lowercased.
function sanitizeName(filename: string): string {
  const base = path.basename(filename)
  const ext = path.extname(base)
  const name = base.slice(0, base.length - ext.length)
  const safeName = name.replace(/[^a-zA-Z0-9_.\u4e00-\u9fff-]/g, '_').replace(/^\.+/, '')
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const out = safeExt ? `${safeName}.${safeExt}` : safeName
  return out.length > 0 ? out : 'file'
}

interface FileNode {
  type: 'file'
  name: string
  relPath: string
  url: string
  size: number
  ext: string
  mtime: string
}
interface DirNode {
  type: 'folder'
  name: string
  relPath: string
  children: TreeNode[]
}
type TreeNode = FileNode | DirNode

function buildTree(dir: string, relBase: string): TreeNode[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const nodes: TreeNode[] = []
  for (const entry of entries) {
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      nodes.push({
        type: 'folder',
        name: entry.name,
        relPath,
        children: buildTree(path.join(dir, entry.name), relPath),
      })
    } else {
      const ext = path.extname(entry.name).replace('.', '').toLowerCase()
      let stat: fs.Stats
      try {
        stat = fs.statSync(path.join(dir, entry.name))
      } catch {
        continue
      }
      nodes.push({
        type: 'file',
        name: entry.name,
        relPath,
        url: publicUrl(relPath),
        size: stat.size,
        ext,
        mtime: stat.mtime.toISOString(),
      })
    }
  }
  // folders first, then files; alphabetical within each group
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

function listFiles(dir: string, relBase: string): FileNode[] {
  const out: FileNode[] = []
  for (const node of buildTree(dir, relBase)) {
    if (node.type === 'folder') {
      out.push(...listFiles(path.join(dir, node.name), node.relPath))
    } else {
      out.push(node)
    }
  }
  return out
}

// ===== Read: tree (folders + files) =====
router.get('/tree', apiTokenOrAdmin('site:write'), (_req, res) => {
  try {
    const tree = buildTree(STATIC_HTML_DIR, '')
    res.json({ success: true, data: { tree } })
  } catch (err: any) {
    console.error('Static tree error:', err)
    res.status(500).json({ success: false, error: 'Failed to list static pages' })
  }
})

// ===== Read: flat list (files only, for pickers) =====
router.get('/list', apiTokenOrAdmin('site:write'), (_req, res) => {
  try {
    const files = listFiles(STATIC_HTML_DIR, '')
    res.json({ success: true, data: files })
  } catch (err: any) {
    console.error('Static list error:', err)
    res.status(500).json({ success: false, error: 'Failed to list static pages' })
  }
})

// ===== Write: create folder =====
router.post('/folder', apiTokenOrAdmin('site:write'), (req: AuthRequest, res) => {
  try {
    const { path: folderPath } = req.body as { path?: string }
    if (!folderPath || typeof folderPath !== 'string' || !folderPath.trim()) {
      return res.status(400).json({ success: false, error: 'path is required' })
    }
    const clean = folderPath.replace(/^\/+/, '').replace(/\/+$/, '')
    if (clean.includes('..') || clean.split('/').some(s => s === '..')) {
      return res.status(400).json({ success: false, error: 'Invalid folder path' })
    }
    const abs = safeResolve(clean)
    if (!abs) {
      return res.status(400).json({ success: false, error: 'Invalid folder path' })
    }
    if (fs.existsSync(abs)) {
      return res.status(409).json({ success: false, error: 'Folder already exists' })
    }
    fs.mkdirSync(abs, { recursive: true })
    auditLog(req, 'create', 'statichtml_folder', undefined, `Created folder: ${clean}`).catch(() => {})
    res.status(201).json({ success: true, data: { relPath: clean } })
  } catch (err: any) {
    console.error('Create folder error:', err)
    res.status(500).json({ success: false, error: 'Failed to create folder' })
  }
})

// ===== Write: delete folder (recursive) =====
router.delete('/folder', apiTokenOrAdmin('site:write'), (req: AuthRequest, res) => {
  try {
    const { path: folderPath } = req.body as { path?: string }
    if (!folderPath || typeof folderPath !== 'string' || !folderPath.trim()) {
      return res.status(400).json({ success: false, error: 'path is required' })
    }
    const clean = folderPath.replace(/^\/+/, '').replace(/\/+$/, '')
    const abs = safeResolve(clean)
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      return res.status(404).json({ success: false, error: 'Folder not found' })
    }
    fs.rmSync(abs, { recursive: true, force: true })
    auditLog(req, 'delete', 'statichtml_folder', undefined, `Deleted folder: ${clean}`).catch(() => {})
    res.json({ success: true, message: 'Folder deleted' })
  } catch (err: any) {
    console.error('Delete folder error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete folder' })
  }
})

// ===== Write: rename folder =====
router.patch('/folder', apiTokenOrAdmin('site:write'), (req: AuthRequest, res) => {
  try {
    const { path: folderPath, newName } = req.body as { path?: string; newName?: string }
    if (!folderPath || typeof folderPath !== 'string' || !folderPath.trim()) {
      return res.status(400).json({ success: false, error: 'path is required' })
    }
    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      return res.status(400).json({ success: false, error: 'newName is required' })
    }
    const clean = folderPath.replace(/^\/+/, '').replace(/\/+$/, '')
    const abs = safeResolve(clean)
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      return res.status(404).json({ success: false, error: 'Folder not found' })
    }
    const parent = path.dirname(abs)
    const safeNew = sanitizeName(newName.trim())
    const newAbs = path.join(parent, safeNew)
    if (!safeResolve(path.relative(STATIC_HTML_DIR, newAbs))) {
      return res.status(400).json({ success: false, error: 'Invalid new name' })
    }
    if (fs.existsSync(newAbs)) {
      return res.status(409).json({ success: false, error: 'Target already exists' })
    }
    fs.renameSync(abs, newAbs)
    const newRel = path.relative(STATIC_HTML_DIR, newAbs).split(path.sep).join('/')
    auditLog(req, 'update', 'statichtml_folder', undefined, `Renamed folder: ${clean} -> ${newRel}`).catch(() => {})
    res.json({ success: true, data: { relPath: newRel } })
  } catch (err: any) {
    console.error('Rename folder error:', err)
    res.status(500).json({ success: false, error: 'Failed to rename folder' })
  }
})

// ===== Write: upload / create file =====
router.post('/file', apiTokenOrAdmin('site:write'), (req: AuthRequest, res) => {
  try {
    const { folder, filename, content, file, mimeType } = req.body as {
      folder?: string
      filename?: string
      content?: string
      file?: string
      mimeType?: string
    }

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, error: 'filename is required' })
    }

    // Determine target directory
    let dirAbs = STATIC_HTML_DIR
    if (folder && typeof folder === 'string' && folder.trim()) {
      const cleanFolder = folder.replace(/^\/+/, '').replace(/\/+$/, '')
      if (cleanFolder.includes('..')) {
        return res.status(400).json({ success: false, error: 'Invalid folder path' })
      }
      const fAbs = safeResolve(cleanFolder)
      if (!fAbs) return res.status(400).json({ success: false, error: 'Invalid folder path' })
      dirAbs = fAbs
      if (!fs.existsSync(dirAbs)) fs.mkdirSync(dirAbs, { recursive: true })
    }

    const safeName = sanitizeName(filename)
    const ext = path.extname(safeName).replace('.', '').toLowerCase()
    if (!ext || !ALLOWED_EXT.has(ext)) {
      return res.status(400).json({ success: false, error: `File type .${ext || '?'} is not allowed` })
    }
    const abs = path.join(dirAbs, safeName)
    if (!safeResolve(path.relative(STATIC_HTML_DIR, abs))) {
      return res.status(400).json({ success: false, error: 'Invalid file path' })
    }

    let buffer: Buffer
    let size: number
    if (typeof content === 'string') {
      buffer = Buffer.from(content, 'utf-8')
      size = buffer.length
    } else if (typeof file === 'string') {
      try {
        buffer = Buffer.from(file, 'base64')
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid base64 file' })
      }
      size = buffer.length
    } else {
      return res.status(400).json({ success: false, error: 'Provide content (text) or file (base64)' })
    }

    // 10MB hard cap
    if (size > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File too large. Max 10MB' })
    }

    fs.writeFileSync(abs, buffer)

    const relPath = path.relative(STATIC_HTML_DIR, abs).split(path.sep).join('/')
    auditLog(req, 'upload', 'statichtml_file', undefined, `Uploaded static file: ${relPath}`).catch(() => {})
    res.status(201).json({ success: true, data: { relPath, url: publicUrl(relPath), size, mimeType: mimeType || 'application/octet-stream' } })
  } catch (err: any) {
    console.error('Upload static file error:', err)
    res.status(500).json({ success: false, error: 'Failed to upload file' })
  }
})

// ===== Write: replace file content =====
router.put('/file', apiTokenOrAdmin('site:write'), (req: AuthRequest, res) => {
  try {
    const { relPath, content, file, mimeType } = req.body as {
      relPath?: string
      content?: string
      file?: string
      mimeType?: string
    }
    if (!relPath || typeof relPath !== 'string') {
      return res.status(400).json({ success: false, error: 'relPath is required' })
    }
    const abs = safeResolve(relPath)
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      return res.status(404).json({ success: false, error: 'File not found' })
    }

    let buffer: Buffer
    if (typeof content === 'string') {
      buffer = Buffer.from(content, 'utf-8')
    } else if (typeof file === 'string') {
      try {
        buffer = Buffer.from(file, 'base64')
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid base64 file' })
      }
    } else {
      return res.status(400).json({ success: false, error: 'Provide content (text) or file (base64)' })
    }
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File too large. Max 10MB' })
    }
    fs.writeFileSync(abs, buffer)
    auditLog(req, 'update', 'statichtml_file', undefined, `Updated static file: ${relPath}`).catch(() => {})
    res.json({ success: true, data: { relPath, url: publicUrl(relPath), size: buffer.length, mimeType: mimeType || 'application/octet-stream' } })
  } catch (err: any) {
    console.error('Update static file error:', err)
    res.status(500).json({ success: false, error: 'Failed to update file' })
  }
})

// ===== Write: rename file =====
router.patch('/file', apiTokenOrAdmin('site:write'), (req: AuthRequest, res) => {
  try {
    const { relPath, newName } = req.body as { relPath?: string; newName?: string }
    if (!relPath || typeof relPath !== 'string' || !relPath.trim()) {
      return res.status(400).json({ success: false, error: 'relPath is required' })
    }
    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      return res.status(400).json({ success: false, error: 'newName is required' })
    }
    const abs = safeResolve(relPath)
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      return res.status(404).json({ success: false, error: 'File not found' })
    }
    const parent = path.dirname(abs)
    const safeNew = sanitizeName(newName.trim())
    const ext = path.extname(safeNew).replace('.', '').toLowerCase()
    if (!ext || !ALLOWED_EXT.has(ext)) {
      return res.status(400).json({ success: false, error: `File type .${ext || '?'} is not allowed` })
    }
    const newAbs = path.join(parent, safeNew)
    if (!safeResolve(path.relative(STATIC_HTML_DIR, newAbs))) {
      return res.status(400).json({ success: false, error: 'Invalid new name' })
    }
    if (fs.existsSync(newAbs)) {
      return res.status(409).json({ success: false, error: 'Target already exists' })
    }
    fs.renameSync(abs, newAbs)
    const newRel = path.relative(STATIC_HTML_DIR, newAbs).split(path.sep).join('/')
    auditLog(req, 'update', 'statichtml_file', undefined, `Renamed static file: ${relPath} -> ${newRel}`).catch(() => {})
    res.json({ success: true, data: { relPath: newRel, url: publicUrl(newRel) } })
  } catch (err: any) {
    console.error('Rename file error:', err)
    res.status(500).json({ success: false, error: 'Failed to rename file' })
  }
})

// ===== Write: delete file =====
router.delete('/file', apiTokenOrAdmin('site:write'), (req: AuthRequest, res) => {
  try {
    const { relPath } = req.body as { relPath?: string }
    if (!relPath || typeof relPath !== 'string') {
      return res.status(400).json({ success: false, error: 'relPath is required' })
    }
    const abs = safeResolve(relPath)
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      return res.status(404).json({ success: false, error: 'File not found' })
    }
    fs.unlinkSync(abs)
    auditLog(req, 'delete', 'statichtml_file', undefined, `Deleted static file: ${relPath}`).catch(() => {})
    res.json({ success: true, message: 'File deleted' })
  } catch (err: any) {
    console.error('Delete static file error:', err)
    res.status(500).json({ success: false, error: 'Failed to delete file' })
  }
})

export default router
