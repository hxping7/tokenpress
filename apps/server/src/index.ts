import 'dotenv/config'

import express from 'express'
import path from 'node:path'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import logger from './utils/logger.js'
import { migrate } from './db/migrations/0000_initial.js'
import { migrate as migrateMediaArticleId } from './db/migrations/0013_media_article_id.js'
import { migrate as migrateHeroCarouselSettings } from './db/migrations/0014_add_hero_carousel_settings.js'
import { migrate as migrateArticlePin } from './db/migrations/0015_add_article_pin.js'
import { migrate as migrateArticleRebuild } from './db/migrations/0016_rebuild_articles.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { systemEvent } from './utils/auditLogger.js'
import { corsMiddleware } from './middleware/cors.js'
import { antiScrapingMiddleware, imageHotlinkProtection } from './middleware/antiScraping.js'
import { db } from './db/index.js'
import { articles } from './db/schema.js'
import { eq, and, lte, sql } from 'drizzle-orm'
import { revalidateTag } from './utils/revalidate.js'
import authRoutes, { initLoginCleanup } from './routes/auth.js'
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
import backupRoutes, { initBackupTasks } from './routes/backup.js'
import searchRoutes from './routes/search.js'
import tagsRoutes from './routes/tags.js'
import articleInteractionRoutes from './routes/article-interactions.js'
import adminReviewRoutes from './routes/admin-reviews.js'
import adminSensitiveKeywordsRoutes from './routes/admin-sensitive-keywords.js'
import aiAdsRoutes from './routes/ai-ads.js'
import adsPublicRoutes from './routes/ads-public.js'
import carouselArticlesRoutes from './routes/carousel-articles.js'
import adminAdsRoutes from './routes/admin-ads.js'
import staticHtmlRoutes from './routes/statichtml.js'
import { initProviders, loadProviderConfigFromEnv, reloadProviderFromDB } from './lib/contentReview/providers/index.js'
import { startReviewWorker, stopReviewWorker, retryFailedReviews } from './workers/reviewScheduler.js'
import { aiPatrolTick } from './workers/aiPatrol.js'
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

// 静态文件：uploads 目录
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads')
app.use('/uploads', express.static(UPLOADS_DIR))

// 静态文件：statichtml 目录（用户托管的静态页面，如活动页/教程）
const STATIC_HTML_DIR = path.resolve(process.cwd(), 'data', 'statichtml')
app.use('/statichtml', express.static(STATIC_HTML_DIR, {
  extensions: false,
  fallthrough: true,
  setHeaders: (res, filePath) => {
    // 防止被当作可嵌入框架内容（可选）；保留正常 Content-Type
    res.setHeader('X-Content-Type-Options', 'nosniff')
  },
}))

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

// Static HTML pages (API Token statichtml:* 或 JWT 管理员)
app.use('/api/v1/statichtml', staticHtmlRoutes)

// Public ad serving
app.use('/api/v1/ads', adsPublicRoutes)

// Carousel articles (public)
app.use('/api/v1/carousel-articles', carouselArticlesRoutes)

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
  await migrateMediaArticleId()
  await migrateHeroCarouselSettings()
  await migrateArticlePin()
  await migrateArticleRebuild()
  logger.info('✅ Database ready')

  // Initialize login cleanup task
  initLoginCleanup()

  // Initialize backup tasks
  initBackupTasks()

  // Initialize content review provider (DB setting overrides env)
  const providerConfig = loadProviderConfigFromEnv()
  initProviders(providerConfig)
  await reloadProviderFromDB()

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

  // Retry failed cloud reviews every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await retryFailedReviews()
    } catch (err) {
      logger.error({ err }, 'Retry failed reviews failed')
    }
  })

  // AI patrol: scan published content every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const result = await aiPatrolTick()
      logger.info(result, 'AI patrol completed')
    } catch (err) {
      logger.error({ err }, 'AI patrol failed')
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
const mainModulePath = process.argv[1]?.replace(/\\/g, '/')
if (import.meta.url === `file://${mainModulePath}` || import.meta.url === `file:///${mainModulePath}`) {
  start().catch((err) => {
    logger.error({ err }, '❌ Failed to start server')
    process.exit(1)
  })
}
