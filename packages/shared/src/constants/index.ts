// API_BASE_URL should be set at runtime by the consuming app
// Default for development
export const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1'

// Default sections for fallback/initial load (will be replaced by API)
export const DEFAULT_SECTIONS = [
  { id: 1, name: 'Claw', slug: 'claw', path: '/claw', description: 'Claw 内容', sortOrder: 0, isActive: true },
  { id: 2, name: 'Token 计划', slug: 'token_plan', path: '/token-plan', description: 'Token 计划相关内容', sortOrder: 1, isActive: true },
  { id: 3, name: 'AI 编程', slug: 'ai_coding', path: '/ai-coding', description: 'AI 编程教程与项目', sortOrder: 2, isActive: true },
  { id: 4, name: 'AI 作品', slug: 'ai_works', path: '/ai-works', description: 'AI 生成作品展示', sortOrder: 3, isActive: true },
  { id: 5, name: '博客', slug: 'blog', path: '/blog', description: '博客文章', sortOrder: 4, isActive: true },
] as const

export const USER_ROLES = [
  { value: 'superadmin', label: '超级管理员' },
  { value: 'admin', label: '管理员' },
  { value: 'user', label: '普通用户' },
] as const

export const CONTENT_STATUS = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
] as const

export const API_PERMISSIONS = [
  { value: 'article:write', label: '发布/编辑文章' },
  { value: 'media:upload', label: '上传媒体文件' },
  { value: 'work:write', label: '发布 AI 作品' },
  { value: 'content:delete', label: '删除内容' },
  { value: 'settings:write', label: '修改系统设置' },
  { value: 'ads:read', label: '查看广告' },
  { value: 'ads:write', label: '创建/编辑广告' },
  { value: 'ads:delete', label: '删除广告' },
] as const

// Per-role allowed API Token permissions
export const ROLE_API_PERMISSIONS: Record<string, string[]> = {
  superadmin: ['article:write', 'media:upload', 'work:write', 'content:delete', 'settings:write', 'ads:read', 'ads:write', 'ads:delete'],
  admin: ['article:write', 'media:upload', 'work:write', 'content:delete', 'ads:read', 'ads:write', 'ads:delete'],
  user: ['article:write', 'media:upload'],
}

// Upload limits
export const UPLOAD_LIMITS = {
  imageSize: 10 * 1024 * 1024, // 10MB
  videoSize: 200 * 1024 * 1024, // 200MB
  audioSize: 50 * 1024 * 1024, // 50MB for audio
  documentSize: 50 * 1024 * 1024, // 50MB for documents
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  allowedVideoTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  allowedAudioTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/x-m4a'],
  allowedDocumentTypes: [
    'text/markdown',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/msword', // doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.ms-powerpoint', // ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  ],
  // Icon mapping for document types (use lucide icon names)
  documentIcons: {
    'text/markdown': 'FileText',
    'application/pdf': 'FileText',
    'text/plain': 'FileText',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'FileSpreadsheet',
    'application/msword': 'FileText',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'FileText',
    'application/vnd.ms-powerpoint': 'Presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentation',
  } as Record<string, string>,
} as const

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// Auth
export const JWT_EXPIRES_IN = '7d'
export const REFRESH_TOKEN_EXPIRES_IN = '30d'
export const API_TOKEN_PREFIX = 't00_sk_'
export const RATE_LIMIT_WINDOW = 60 // seconds
export const RATE_LIMIT_MAX = 100 // requests per window
