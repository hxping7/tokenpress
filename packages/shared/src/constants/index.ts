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

export interface ApiPermissionDef {
  value: ApiPermission
  labelKey: string
  roles: string[]
}

// 全部后台能力合并为单一权限桶 `site:write`：
// 内容发布 / 媒体上传 / 站点配置（设置·板块·分类·友链·风格包·广告·静态页·审核·敏感词）/ 管理运维（用户·备份·统计·日志）均含于此。
// 旧token仍可用：见下方 LEGACY_PERMISSION_ALIASES。
export const API_PERMISSION_CATALOG: ApiPermissionDef[] = [
  { value: 'site:write', labelKey: 'tokens.permSiteWrite', roles: ['superadmin', 'admin'] },
]

// 旧权限别名兼容：合并为单一 site:write 后，已签发的旧 token（permissions 含下列任一旧权限）
// 仍视为拥有 site:write，避免旧 token 立即失效。新 token 直接存 'site:write'。
export const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  'site:write': [
    'article:write',
    'media:upload',
    'content:delete',
    'settings:write',
    'friendlinks:write',
    'sections:write',
    'categories:write',
    'users:write',
    'stats:read',
    'logs:read',
    'backup:write',
    'reviews:write',
    'keywords:write',
    'ads:read',
    'ads:write',
    'ads:delete',
    'statichtml:write',
    'statichtml:read',
    'styles:write',
    'styles:read',
    'works:write',
  ],
}

// 判断 token 权限数组是否满足某要求权限（含旧权限别名兼容）
export function satisfiesPermission(permissions: string[], required: string): boolean {
  if (permissions.includes(required)) return true
  const aliases = LEGACY_PERMISSION_ALIASES[required]
  return aliases ? aliases.some((p) => permissions.includes(p)) : false
}

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
