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

// 单一事实来源：API Token 权限目录。
// 后台创建 Token 的 UI（前端）与 Token 创建接口（后端）均由此派生，
// 保证「可勾选权限」与「后端接受权限」永远一致。
// labelKey 对应 locales 中 tokens.* 的 i18n key；roles 为该权限可被授予的角色。
import type { ApiPermission } from '../types/index.js'

export type ApiPermissionCategory = 'content' | 'site' | 'moderation' | 'admin'

export interface ApiPermissionDef {
  value: ApiPermission
  labelKey: string
  roles: string[]
  category: ApiPermissionCategory
}

// 前端 UI 按 category 分组展示（后端仍按细粒度 value 鉴权）。
// 顺序即 UI 分组顺序。
export const API_PERMISSION_CATALOG: ApiPermissionDef[] = [
  // 内容发布
  { value: 'article:write', labelKey: 'tokens.permArticleWrite', roles: ['superadmin', 'admin', 'user'], category: 'content' },
  { value: 'media:upload', labelKey: 'tokens.permMediaUpload', roles: ['superadmin', 'admin', 'user'], category: 'content' },
  { value: 'content:delete', labelKey: 'tokens.permContentDelete', roles: ['superadmin', 'admin'], category: 'content' },
  // 站点与外观
  { value: 'settings:write', labelKey: 'tokens.permSettingsWrite', roles: ['superadmin', 'admin'], category: 'site' },
  { value: 'sections:write', labelKey: 'tokens.permSectionsWrite', roles: ['superadmin', 'admin'], category: 'site' },
  { value: 'categories:write', labelKey: 'tokens.permCategoriesWrite', roles: ['superadmin', 'admin'], category: 'site' },
  { value: 'friendlinks:write', labelKey: 'tokens.permFriendlinksWrite', roles: ['superadmin', 'admin'], category: 'site' },
  { value: 'styles:write', labelKey: 'tokens.permStylesWrite', roles: ['superadmin', 'admin'], category: 'site' },
  { value: 'styles:read', labelKey: 'tokens.permStylesRead', roles: ['superadmin', 'admin'], category: 'site' },
  // 运营与审核
  { value: 'reviews:write', labelKey: 'tokens.permReviewsWrite', roles: ['superadmin', 'admin'], category: 'moderation' },
  { value: 'keywords:write', labelKey: 'tokens.permKeywordsWrite', roles: ['superadmin', 'admin'], category: 'moderation' },
  { value: 'ads:write', labelKey: 'tokens.permAdsWrite', roles: ['superadmin', 'admin'], category: 'moderation' },
  { value: 'ads:read', labelKey: 'tokens.permAdsRead', roles: ['superadmin', 'admin'], category: 'moderation' },
  { value: 'ads:delete', labelKey: 'tokens.permAdsDelete', roles: ['superadmin', 'admin'], category: 'moderation' },
  { value: 'statichtml:write', labelKey: 'tokens.permStatichtmlWrite', roles: ['superadmin', 'admin'], category: 'moderation' },
  { value: 'statichtml:read', labelKey: 'tokens.permStatichtmlRead', roles: ['superadmin', 'admin'], category: 'moderation' },
  // 管理与运维
  { value: 'users:write', labelKey: 'tokens.permUsersWrite', roles: ['superadmin'], category: 'admin' },
  { value: 'backup:write', labelKey: 'tokens.permBackupWrite', roles: ['superadmin', 'admin'], category: 'admin' },
  { value: 'stats:read', labelKey: 'tokens.permStatsRead', roles: ['superadmin', 'admin'], category: 'admin' },
  { value: 'logs:read', labelKey: 'tokens.permLogsRead', roles: ['superadmin', 'admin'], category: 'admin' },
]

// Token 创建接口的合法权限白名单（由目录派生）
export const ALL_API_PERMISSIONS: string[] = API_PERMISSION_CATALOG.map((p) => p.value)

// 各角色可授予的权限集合（由目录派生，避免前后端/角色口径漂移）
export const ROLE_API_PERMISSIONS: Record<string, string[]> = API_PERMISSION_CATALOG.reduce(
  (acc, p) => {
    for (const role of p.roles) {
      ;(acc[role] ||= []).push(p.value)
    }
    return acc
  },
  {} as Record<string, string[]>,
)

// 前端 UI 分组展示用的分类元数据（顺序即分组顺序；labelKey 对应 locales tokens.*）
export const API_PERMISSION_CATEGORY_ORDER: ApiPermissionCategory[] = ['content', 'site', 'moderation', 'admin']
export const API_PERMISSION_CATEGORY_LABELS: Record<ApiPermissionCategory, string> = {
  content: 'tokens.catContent',
  site: 'tokens.catSite',
  moderation: 'tokens.catModeration',
  admin: 'tokens.catAdmin',
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

// ===== Article pin scopes =====
// 置顶作用域：none=取消置顶, global=全站置顶, section=仅所属板块置顶
export const PIN_SCOPES = ['none', 'global', 'section'] as const
export type PinScope = (typeof PIN_SCOPES)[number]

export function isValidPinScope(value: unknown): value is PinScope {
  return typeof value === 'string' && (PIN_SCOPES as readonly string[]).includes(value)
}
