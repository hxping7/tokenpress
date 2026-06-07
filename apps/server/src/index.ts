import 'dotenv/config'

import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import logger from './utils/logger.js'
import { migrate } from './db/migrations/0001_initial.js'
import { migrate as migrateSections } from './db/migrations/0002_sections.js'
import { migrate as migrateExternalUrl } from './db/migrations/0003_external_url.js'
import { migrate as migrateFriendLinks } from './db/migrations/0004_friend_links.js'
import { migrate as migrateSiteSettings } from './db/migrations/0005_site_settings.js'
import { migrate as migrateSeparateLocales } from './db/migrations/0006_separate_locales.js'
import { migrate as migrateLoginProtect } from './db/migrations/0007_login_protect.js'
import { migrate as migrateBackups } from './db/migrations/0008_backups.js'
import { migrate as migrateFts5 } from './db/migrations/0009_fts5.js'
import { migrate as migrateApiLogsContentUrl } from './db/migrations/0010_api_logs_content_url.js'
import { migrate as migrateThreeLevelRoles } from './db/migrations/0011_three_level_roles.js'
import { migrate as migrateAuditLogs } from './db/migrations/0012_audit_logs.js'
import { migrate as migrateArticleLikesViews } from './db/migrations/0013_article_likes_views.js'
import { migrate as migrateScheduledArticles } from './db/migrations/0014_scheduled_articles.js'
import { migrate as migrateContentReviews } from './db/migrations/0015_content_reviews.js'
import { migrate as migrateSensitiveKeywords } from './db/migrations/0016_sensitive_keywords.js'
import { migrate as migrateMediaReviewFields } from './db/migrations/0017_media_review_fields.js'
import { migrate as migrateAds } from './db/migrations/0018_ads.js'
import { migrate as migrateArticleStatus } from './db/migrations/0019_article_status_scheduled.js'
import { migrate as migratePendingReview } from './db/migrations/0020_article_status_pending_review.js'
import { migrate as migrateContentReviewSetting } from './db/migrations/0021_content_review_setting.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { systemEvent } from './utils/auditLogger.js'
import { corsMiddleware } from './middleware/cors.js'
import { antiScrapingMiddleware, imageHotlinkProtection } from './middleware/antiScraping.js'
import { db } from './db/index.js'
import { articles } from './db/schema.js'
import { eq, and, lte, sql } from 'drizzle-orm'
import { revalidateTag } from './utils/revalidate.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import articleRoutes from './routes/articles.js'
import adminArticleRoutes from './routes/admin-articles.js'
import aiPublishRoutes from './routes/ai-publish.js'
import categoryRoutes from './routes/categories.js'
import sectionRoutes from './routes/sections.js'
import friendLinkRoutes from './routes/friend-links.js'
import siteSettingsRoutes from './routes/site-settings.js'
import tokenRoutes from './routes/tokens.js'
import mediaRoutes from './routes/media.js'
import statsRoutes from './routes/stats.js'
import logsRoutes from './routes/logs.js'
import backupRoutes from './routes/backup.js'
import searchRoutes from './routes/search.js'
import tagsRoutes from './routes/tags.js'
import articleInteractionRoutes from './routes/article-interactions.js'
import adminReviewRoutes from './routes/admin-reviews.js'
import adminSensitiveKeywordsRoutes from './routes/admin-sensitive-keywords.js'
import aiAdsRoutes from './routes/ai-ads.js'
import adsPublicRoutes from './routes/ads-public.js'
import adminAdsRoutes from './routes/admin-ads.js'
import { initProviders, loadProviderConfigFromEnv } from './lib/contentReview/providers/index.js'
import { startReviewWorker, stopReviewWorker } from './workers/reviewScheduler.js'
import { adScheduler } from './workers/adScheduler.js'
import { cleanupExpiredLocks } from './lib/cronLock.js'
import cron from 'node-cron'

const app = express()
const PORT = process.env.PORT || 4001
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4000'

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1)

// ===== Middleware =====

// Security headers (CSP in report-only mode)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      reportUri: '/api/v1/csp-report',
    },
    reportOnly: true, // 先以 report-only 模式运行，确认无误后改为 false
  },
}))

// CORS 收紧：仅允许配置的域名
app.use(corsMiddleware)

// 反爬虫：UA 黑名单过滤
app.use(antiScrapingMiddleware)

// 图片防盗链
app.use(imageHotlinkProtection)

app.use(express.json({ limit: '10mb' }))

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }, 'request completed')
  })
  next()
})

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Auth rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many login attempts' },
})
app.use('/api/v1/auth/login', authLimiter)

// Articles API rate limit (防爬虫)
const articlesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many requests' },
})
app.use('/api/v1/articles', articlesLimiter)

// AI publish rate limit
const aiPublishLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many publish requests' },
})

// ===== Routes =====

// Public routes
app.use('/api/v1/auth', authRoutes)

app.use('/api/v1/articles', articleRoutes)
app.use('/api/v1/categories', categoryRoutes)
app.use('/api/v1/sections', sectionRoutes)
app.use('/api/v1/friend-links', friendLinkRoutes)
app.use('/api/v1/site-settings', siteSettingsRoutes)
app.use('/api/v1/search', searchRoutes)
app.use('/api/v1/tags', tagsRoutes)

const interactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many requests' },
})
app.use('/api/v1/interactions', interactionLimiter, articleInteractionRoutes)

// Admin/JWT-protected routes
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/admin/articles', adminArticleRoutes)
app.use('/api/v1/tokens', tokenRoutes)
app.use('/api/v1/media', mediaRoutes)
app.use('/api/v1/stats', statsRoutes)
app.use('/api/v1/logs', logsRoutes)
app.use('/api/v1/backup', backupRoutes)
app.use('/api/v1/admin/reviews', adminReviewRoutes)
app.use('/api/v1/admin/sensitive-keywords', adminSensitiveKeywordsRoutes)
app.use('/api/v1/admin/ads', adminAdsRoutes)

// AI API Token-protected routes
app.use('/api/v1/ai', aiPublishLimiter, aiPublishRoutes)

// Public ad serving
app.use('/api/v1/ads', adsPublicRoutes)

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      workers: {
        adScheduler: adScheduler.getStatus(),
      },
    },
  })
})

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// ===== Start =====
async function start() {
  logger.info('🔄 Running database migration...')
  await migrate()
  await migrateSections()
  await migrateExternalUrl()
  await migrateFriendLinks()
  await migrateSiteSettings()
  await migrateLoginProtect()
  await migrateBackups()
  await migrateFts5()
  await migrateApiLogsContentUrl()
  await migrateThreeLevelRoles()
  await migrateAuditLogs()
  await migrateArticleLikesViews()
  await migrateScheduledArticles()
  await migrateContentReviews()
  await migrateSensitiveKeywords()
  await migrateMediaReviewFields()
  await migrateAds()
  await migrateArticleStatus()
  await migratePendingReview()
  await migrateContentReviewSetting()
  logger.info('✅ Database ready')

  // Initialize content review provider
  const providerConfig = loadProviderConfigFromEnv()
  initProviders(providerConfig)

  // Start review worker
  startReviewWorker()

  // Start ad scheduler (every minute)
  cron.schedule('* * * * *', async () => {
    try {
      await adScheduler.tick()
    } catch (err) {
      logger.error({ err }, 'Ad scheduler failed')
    }
  })

  // Clean up expired locks every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await cleanupExpiredLocks()
    } catch (err) {
      logger.error({ err }, 'Lock cleanup failed')
    }
  })

  logger.info('Workers started (review + ad scheduler)')

  return new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      systemEvent('server_start', `Server started on port ${PORT}`)

      setInterval(async () => {
        try {
          const scheduled = await db.select({ id: articles.id, title: articles.title })
            .from(articles)
            .where(and(
              eq(articles.status, 'scheduled'),
              lte(articles.publishedAt, new Date().toISOString())
            ))
            .all()

          for (const article of scheduled) {
            await db.update(articles)
              .set({ status: 'published', updatedAt: new Date().toISOString() })
              .where(eq(articles.id, article.id))
              .run()
            logger.info({ articleId: article.id, title: article.title }, 'Scheduled article published')
          }

          if (scheduled.length > 0) {
            revalidateTag('articles')
          }
        } catch (err) {
          logger.error({ err }, 'Scheduled publish check failed')
        }
      }, 60_000)

      logger.info(`
  ╔══════════════════════════════════════════╗
  ║  🚀 Token00 API Server                  ║
  ║  📍 http://localhost:${PORT}                 ║
  ║  🔗 API: http://localhost:${PORT}/api/v1    ║
  ╚══════════════════════════════════════════╝
    `)
      resolve()
    })
  })
}

// Export app for testing
export { app }
export { start }

// Only auto-start if this is the main module
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  start().catch((err) => {
    logger.error({ err }, '❌ Failed to start server')
    process.exit(1)
  })
}
