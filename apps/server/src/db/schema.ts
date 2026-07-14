import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ===== Sections =====
export const sections = sqliteTable('sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  path: text('path').notNull().unique(), // URL path like /token-plan
  description: text('description'),
  externalUrl: text('external_url'), // 外部链接URL，设置后点击菜单直接跳转
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  layouts: text('layouts'), // JSON — per-section layout override (section/article/list), nullable
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Users =====
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  role: text('role', { enum: ['superadmin', 'admin', 'user'] }).notNull().default('user'),
  avatarUrl: text('avatar_url'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ===== API Tokens =====
export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  name: text('name').notNull(),
  permissions: text('permissions').notNull(), // JSON array string
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Categories =====
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sectionId: integer('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ===== Articles =====
export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  coverImage: text('cover_image'),
  sectionId: integer('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').references(() => categories.id),
  status: text('status', { enum: ['draft', 'published', 'archived', 'scheduled', 'pending_review'] }).notNull().default('draft'),
  viewCount: integer('view_count').notNull().default(0),
  // 置顶：pinnedAt 非空即已置顶（记录置顶时间，用于同组内排序）；pinnedScope 区分全局/板块
  pinnedAt: text('pinned_at'),
  pinnedScope: text('pinned_scope', { enum: ['global', 'section'] }),
  authorId: integer('author_id').notNull().references(() => users.id),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Tags =====
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Article-Tags junction =====
export const articleTags = sqliteTable('article_tags', {
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
})

// ===== Media =====
export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  width: integer('width'),
  height: integer('height'),
  duration: real('duration'),
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  articleId: integer('article_id').references(() => articles.id, { onDelete: 'set null' }),
  isReviewed: integer('is_reviewed').notNull().default(0),
  reviewNote: text('review_note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ===== API Usage Logs =====
export const apiLogs = sqliteTable('api_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenId: integer('token_id').notNull().references(() => apiTokens.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  statusCode: integer('status_code').notNull(),
  responseTime: integer('response_time'), // milliseconds
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  contentUrl: text('content_url'), // 发布内容的 URL
  error: text('error'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Friend Links =====
export const friendLinks = sqliteTable('friend_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  description: text('description'), // 友链描述
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Site Settings =====
export const siteSettings = sqliteTable('site_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Login Logs =====
export const loginLogs = sqliteTable('login_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ipAddress: text('ip_address').notNull(),
  username: text('username'),
  success: integer('success').notNull(), // 1=success, 0=failed
  reason: text('reason'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Login Protection =====
export const loginProtect = sqliteTable('login_protect', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ipAddress: text('ip_address').notNull().unique(),
  failCount: integer('fail_count').notNull().default(0),
  lockedUntil: text('locked_until'),
  captchaRequired: integer('captcha_required').notNull().default(0),
  lastFailAt: text('last_fail_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Backups =====
export const backups = sqliteTable('backups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  size: integer('size').notNull(),
  type: text('type', { enum: ['manual', 'auto'] }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  operatorId: integer('operator_id').notNull(),
  operatorName: text('operator_name').notNull(),
  operatorRole: text('operator_role').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id'),
  detail: text('detail'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const articleLikes = sqliteTable('article_likes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const articleViews = sqliteTable('article_views', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  referer: text('referer'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const systemEvents = sqliteTable('system_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(),
  level: text('level', { enum: ['info', 'warn', 'error'] }).notNull().default('info'),
  message: text('message').notNull(),
  detail: text('detail'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Content Reviews =====
export const contentReviews = sqliteTable('content_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id').notNull(),
  version: integer('version').notNull().default(1),
  contentSnapshot: text('content_snapshot'),
  imageUrlsJson: text('image_urls_json'),
  localScanStatus: text('local_scan_status').notNull().default('pending'),
  localMatchedWords: text('local_matched_words'),
  cloudProvider: text('cloud_provider'),
  cloudTextStatus: text('cloud_text_status').notNull().default('pending'),
  cloudImageStatus: text('cloud_image_status').notNull().default('pending'),
  cloudLabel: text('cloud_label'),
  cloudScore: real('cloud_score'),
  cloudDetailJson: text('cloud_detail_json'),
  manualStatus: text('manual_status').notNull().default('pending'),
  manualReviewer: integer('manual_reviewer').references(() => users.id),
  manualReviewedAt: text('manual_reviewed_at'),
  manualNote: text('manual_note'),
  finalVerdict: text('final_verdict').notNull().default('pending'),
  aiPatrolStatus: text('ai_patrol_status'),
  aiPatrolAt: text('ai_patrol_at'),
  aiPatrolDetailJson: text('ai_patrol_detail_json'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Sensitive Keywords =====
export const sensitiveKeywords = sqliteTable('sensitive_keywords', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  keyword: text('keyword').notNull().unique(),
  category: text('category').notNull().default('general'),
  severity: text('severity').notNull().default('medium'),
  action: text('action').notNull().default('review'),
  scope: text('scope').notNull().default('all'),
  enabled: integer('enabled').notNull().default(1),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Ads =====
export const ads = sqliteTable('ads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  position: text('position').notNull(),
  title: text('title').notNull(),
  code: text('code').notNull(),
  status: text('status', { enum: ['pending_review', 'draft', 'active', 'expired', 'inactive'] }).notNull().default('pending_review'),
  priority: integer('priority').notNull().default(0),
  startAt: text('start_at'),
  endAt: text('end_at'),
  targetSections: text('target_sections'),
  targetCategories: text('target_categories'),
  maxImpressions: integer('max_impressions'),
  maxClicks: integer('max_clicks'),
  impressions: integer('impressions').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Ad Logs =====
export const adLogs = sqliteTable('ad_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adId: integer('ad_id').references(() => ads.id, { onDelete: 'set null' }),
  articleId: integer('article_id').references(() => articles.id, { onDelete: 'set null' }),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  referer: text('referer'),
  type: text('type', { enum: ['impression', 'click'] }).notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ===== Cron Locks =====
export const cronLocks = sqliteTable('cron_locks', {
  name: text('name').primaryKey(),
  acquiredAt: text('acquired_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  holderId: text('holder_id').notNull(),
})
