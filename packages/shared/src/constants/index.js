// API_BASE_URL should be set at runtime by the consuming app
// Default for development
export const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';
export const CONTENT_SECTIONS = [
    { value: 'token_plan', label: 'Token 计划' },
    { value: 'ai_coding', label: 'AI 编程' },
    { value: 'ai_works', label: 'AI 作品' },
    { value: 'blog', label: '博客' },
];
export const USER_ROLES = [
    { value: 'admin', label: '管理员' },
    { value: 'editor', label: '编辑' },
    { value: 'user', label: '用户' },
];
export const CONTENT_STATUS = [
    { value: 'draft', label: '草稿' },
    { value: 'published', label: '已发布' },
    { value: 'archived', label: '已归档' },
];
export const API_PERMISSIONS = [
    { value: 'article:write', label: '发布/编辑文章' },
    { value: 'media:upload', label: '上传媒体文件' },
    { value: 'work:write', label: '发布 AI 作品' },
    { value: 'content:delete', label: '删除内容' },
];
// Upload limits
export const UPLOAD_LIMITS = {
    imageSize: 10 * 1024 * 1024, // 10MB
    videoSize: 200 * 1024 * 1024, // 200MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedVideoTypes: ['video/mp4', 'video/webm'],
};
// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
// Auth
export const JWT_EXPIRES_IN = '7d';
export const REFRESH_TOKEN_EXPIRES_IN = '30d';
export const API_TOKEN_PREFIX = 't00_sk_';
export const RATE_LIMIT_WINDOW = 60; // seconds
export const RATE_LIMIT_MAX = 100; // requests per window
