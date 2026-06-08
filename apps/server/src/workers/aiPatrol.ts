import { db } from '../db/index.js'
import { articles, ads, media, contentReviews } from '../db/schema.js'
import { eq, and, desc, isNotNull, sql } from 'drizzle-orm'
import { reviewContent } from '../lib/contentReview/index.js'
import { scanSensitiveWords } from '../lib/contentReview/sensitiveScanner.js'
import { getProvider, getConfig } from '../lib/contentReview/providers/index.js'
import { withLock } from '../lib/cronLock.js'
import logger from '../utils/logger.js'
import type { TargetType } from '../lib/contentReview/types.js'

const PATROL_BATCH_SIZE = 20

interface PatrolTarget {
  targetType: TargetType
  targetId: number
  text: string
  imageUrls: string[]
}

export async function aiPatrolTick(): Promise<{ scanned: number; flagged: number }> {
  const result = await withLock('ai_patrol', async () => {
    const targets = await collectPatrolTargets()

    if (targets.length === 0) {
      logger.info('AI patrol: no targets to scan')
      return { scanned: 0, flagged: 0 }
    }

    logger.info({ count: targets.length }, 'AI patrol: scanning published content')

    let flagged = 0

    for (const target of targets) {
      try {
        const isFlagged = await patrolTarget(target)
        if (isFlagged) flagged++
      } catch (err) {
        logger.error({ err, target }, 'AI patrol: failed to scan target')
      }
    }

    return { scanned: targets.length, flagged }
  })

  return result || { scanned: 0, flagged: 0 }
}

async function collectPatrolTargets(): Promise<PatrolTarget[]> {
  const targets: PatrolTarget[] = []

  // Published articles (limit to recent batch)
  const publishedArticles = await db.select({
    id: articles.id,
    title: articles.title,
    content: articles.content,
    coverImage: articles.coverImage,
  })
    .from(articles)
    .where(eq(articles.status, 'published'))
    .orderBy(desc(articles.updatedAt))
    .limit(PATROL_BATCH_SIZE)

  for (const a of publishedArticles) {
    const text = `${a.title} ${a.content}`
    const imageUrls: string[] = []
    if (a.coverImage) imageUrls.push(a.coverImage)
    const imgMatches = a.content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)
    for (const m of imgMatches) imageUrls.push(m[1])

    targets.push({ targetType: 'article', targetId: a.id, text, imageUrls })
  }

  // Active ads
  const activeAds = await db.select({
    id: ads.id,
    title: ads.title,
    code: ads.code,
  })
    .from(ads)
    .where(eq(ads.status, 'active'))
    .orderBy(desc(ads.updatedAt))
    .limit(PATROL_BATCH_SIZE)

  for (const a of activeAds) {
    const text = `${a.title} ${a.code.replace(/<[^>]+>/g, '')}`
    const imageUrls: string[] = []
    const imgMatches = a.code.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)
    for (const m of imgMatches) imageUrls.push(m[1])

    targets.push({ targetType: 'ad', targetId: a.id, text, imageUrls })
  }

  // Reviewed media images
  const reviewedMedia = await db.select({
    id: media.id,
    url: media.url,
    thumbnailUrl: media.thumbnailUrl,
  })
    .from(media)
    .where(eq(media.isReviewed, 1))
    .orderBy(desc(media.createdAt))
    .limit(PATROL_BATCH_SIZE)

  for (const m of reviewedMedia) {
    const imageUrls: string[] = []
    if (m.url) imageUrls.push(m.url)
    if (m.thumbnailUrl) imageUrls.push(m.thumbnailUrl)

    targets.push({ targetType: 'media', targetId: m.id, text: '', imageUrls })
  }

  return targets
}

async function patrolTarget(target: PatrolTarget): Promise<boolean> {
  const { targetType, targetId, text, imageUrls } = target

  // Step 1: Local sensitive word scan
  const scanResult = await scanSensitiveWords(text, targetType)
  if (scanResult.action === 'block') {
    await recordPatrolResult(targetType, targetId, 'violation', {
      reason: 'local_scan_block',
      keywords: scanResult.keywords,
    })
    await downgradeContent(targetType, targetId)
    return true
  }

  // Step 2: Cloud provider scan
  const provider = getProvider()
  const config = getConfig()
  if (provider && config) {
    // Text review
    if (text) {
      try {
        const textResult = await provider.reviewText(text)
        if (textResult.verdict === 'reject') {
          await recordPatrolResult(targetType, targetId, 'violation', {
            reason: 'cloud_text_reject',
            label: textResult.label,
            score: textResult.score,
          })
          await downgradeContent(targetType, targetId)
          return true
        }
        if (textResult.verdict === 'pending') {
          await recordPatrolResult(targetType, targetId, 'suspicious', {
            reason: 'cloud_text_pending',
            label: textResult.label,
            score: textResult.score,
          })
          return true
        }
      } catch (err) {
        logger.error({ err, targetType, targetId }, 'AI patrol: cloud text review failed')
      }
    }

    // Image review
    for (const url of imageUrls) {
      try {
        const imgResult = await provider.reviewImage(url)
        if (imgResult.verdict === 'reject') {
          await recordPatrolResult(targetType, targetId, 'violation', {
            reason: 'cloud_image_reject',
            label: imgResult.label,
            score: imgResult.score,
            imageUrl: url,
          })
          await downgradeContent(targetType, targetId)
          return true
        }
        if (imgResult.verdict === 'pending') {
          await recordPatrolResult(targetType, targetId, 'suspicious', {
            reason: 'cloud_image_pending',
            label: imgResult.label,
            score: imgResult.score,
            imageUrl: url,
          })
          return true
        }
      } catch (err) {
        logger.error({ err, targetType, targetId, url }, 'AI patrol: cloud image review failed')
      }
    }
  }

  // All clear
  await recordPatrolResult(targetType, targetId, 'pass', null)
  return false
}

async function recordPatrolResult(
  targetType: TargetType,
  targetId: number,
  status: 'pass' | 'suspicious' | 'violation',
  detail: Record<string, any> | null
): Promise<void> {
  // Find latest review record for this target
  const existing = await db.select()
    .from(contentReviews)
    .where(and(
      eq(contentReviews.targetType, targetType),
      eq(contentReviews.targetId, targetId),
    ))
    .orderBy(desc(contentReviews.version))
    .limit(1)

  const now = new Date().toISOString()

  if (existing.length > 0) {
    await db.update(contentReviews)
      .set({
        aiPatrolStatus: status,
        aiPatrolAt: now,
        aiPatrolDetailJson: detail ? JSON.stringify(detail) : null,
        updatedAt: now,
      })
      .where(eq(contentReviews.id, existing[0].id))
  } else {
    // No existing review record, create one for patrol
    await db.insert(contentReviews).values({
      targetType,
      targetId,
      version: 1,
      localScanStatus: 'pass',
      cloudTextStatus: 'pass',
      cloudImageStatus: 'pass',
      manualStatus: 'approved',
      finalVerdict: 'pass',
      aiPatrolStatus: status,
      aiPatrolAt: now,
      aiPatrolDetailJson: detail ? JSON.stringify(detail) : null,
    })
  }
}

async function downgradeContent(targetType: TargetType, targetId: number): Promise<void> {
  const now = new Date().toISOString()

  switch (targetType) {
    case 'article':
      await db.update(articles)
        .set({ status: 'draft', updatedAt: now })
        .where(eq(articles.id, targetId))
      logger.info({ articleId: targetId }, 'AI patrol: article downgraded to draft')
      break
    case 'ad':
      await db.update(ads)
        .set({ status: 'inactive', isActive: 0, updatedAt: now })
        .where(eq(ads.id, targetId))
      logger.info({ adId: targetId }, 'AI patrol: ad deactivated')
      break
    case 'media':
      await db.update(media)
        .set({ isReviewed: 2, reviewNote: 'AI patrol: content flagged' })
        .where(eq(media.id, targetId))
      logger.info({ mediaId: targetId }, 'AI patrol: media flagged')
      break
  }
}
