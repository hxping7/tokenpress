import { db } from '../../db/index.js'
import { contentReviews } from '../../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { scanSensitiveWords } from './sensitiveScanner.js'
import { extractText } from './extractText.js'
import { extractImages } from './extractImages.js'
import { downloadImageForReview } from './imageDownloader.js'
import { getProvider, getConfig } from './providers/index.js'
import { applyReviewResult } from './statusManager.js'
import logger from '../../utils/logger.js'
import type { ReviewInput, ScanResult, ProviderResult, Verdict, TargetType } from './types.js'

export async function scheduleReview(input: ReviewInput): Promise<number> {
  const text = input.text || ''
  const imageUrls = input.imageUrls || []

  const existing = await db.select()
    .from(contentReviews)
    .where(and(
      eq(contentReviews.targetType, input.targetType),
      eq(contentReviews.targetId, input.targetId),
    ))
    .orderBy(desc(contentReviews.version))
    .limit(1)

  const version = existing.length > 0 ? (existing[0].version + 1) : 1

  const result = await db.insert(contentReviews).values({
    targetType: input.targetType,
    targetId: input.targetId,
    version,
    contentSnapshot: text || null,
    imageUrlsJson: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
    localScanStatus: 'pending',
    cloudTextStatus: 'pending',
    cloudImageStatus: 'pending',
    manualStatus: 'pending',
    finalVerdict: 'pending',
  }).returning()

  logger.info({ targetType: input.targetType, targetId: input.targetId, reviewId: result[0].id, version }, 'Review scheduled')
  return result[0].id
}

export async function reviewContent(reviewId: number): Promise<void> {
  const review = await db.select()
    .from(contentReviews)
    .where(eq(contentReviews.id, reviewId))
    .limit(1)

  if (review.length === 0) {
    logger.warn({ reviewId }, 'Review not found')
    return
  }

  const r = review[0]
  if (r.finalVerdict !== 'pending') {
    logger.info({ reviewId, verdict: r.finalVerdict }, 'Review already resolved')
    return
  }

  // Step 1: Local sensitive word scan
  if (r.localScanStatus === 'pending') {
    await runLocalScan(r)
  }

  // Re-read after local scan
  const updated = await db.select()
    .from(contentReviews)
    .where(eq(contentReviews.id, reviewId))
    .limit(1)

  if (updated[0].finalVerdict === 'reject') {
    logger.info({ reviewId }, 'Rejected by local scan')
    await applyReviewResult(updated[0].targetType as TargetType, updated[0].targetId, 'reject')
    return
  }

  // Step 2: Cloud provider review
  const provider = getProvider()
  const config = getConfig()
  if (provider && config) {
    await runCloudReview(updated[0], provider, config)
  } else {
    // No cloud provider, skip cloud step
    await db.update(contentReviews)
      .set({
        cloudTextStatus: 'pass',
        cloudImageStatus: 'pass',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(contentReviews.id, reviewId))
  }

  // Re-read after cloud review
  const final = await db.select()
    .from(contentReviews)
    .where(eq(contentReviews.id, reviewId))
    .limit(1)

  // Determine final verdict
  await determineFinalVerdict(final[0])
}

async function runLocalScan(r: any): Promise<void> {
  const text = r.contentSnapshot || ''
  const scanResult: ScanResult = await scanSensitiveWords(text, r.targetType as TargetType)

  const updateData: Record<string, any> = {
    localScanStatus: scanResult.matched ? 'fail' : 'pass',
    localMatchedWords: scanResult.keywords.length > 0 ? JSON.stringify(scanResult.keywords) : null,
    updatedAt: new Date().toISOString(),
  }

  if (scanResult.action === 'block') {
    updateData.finalVerdict = 'reject'
  } else if (scanResult.action === 'review') {
    updateData.finalVerdict = 'pending'
  }

  await db.update(contentReviews)
    .set(updateData)
    .where(eq(contentReviews.id, r.id))
}

async function runCloudReview(r: any, provider: any, config: any): Promise<void> {
  // Text review
  if (r.cloudTextStatus === 'pending' && r.contentSnapshot) {
    try {
      const textResult: ProviderResult = await provider.reviewText(r.contentSnapshot)
      await db.update(contentReviews)
        .set({
          cloudProvider: provider.name,
          cloudTextStatus: textResult.verdict === 'error' ? 'error' : (textResult.verdict === 'reject' ? 'fail' : 'pass'),
          cloudLabel: textResult.label,
          cloudScore: textResult.score,
          cloudDetailJson: textResult.detail ? JSON.stringify(textResult.detail) : null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(contentReviews.id, r.id))
    } catch (err: any) {
      logger.error({ err, reviewId: r.id }, 'Cloud text review failed')
      await db.update(contentReviews)
        .set({ cloudTextStatus: 'error', updatedAt: new Date().toISOString() })
        .where(eq(contentReviews.id, r.id))
    }
  }

  // Image review
  if (r.cloudImageStatus === 'pending' && r.imageUrlsJson) {
    const urls: string[] = JSON.parse(r.imageUrlsJson)
    for (const url of urls) {
      try {
        const imgResult: ProviderResult = await provider.reviewImage(url)
        if (imgResult.verdict === 'reject') {
          await db.update(contentReviews)
            .set({
              cloudImageStatus: 'fail',
              cloudLabel: imgResult.label,
              cloudScore: imgResult.score,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(contentReviews.id, r.id))
          break
        }
      } catch (err: any) {
        logger.error({ err, reviewId: r.id, url }, 'Cloud image review failed')
      }
    }

    // If no image was rejected, mark as pass
    const current = await db.select().from(contentReviews).where(eq(contentReviews.id, r.id)).limit(1)
    if (current[0].cloudImageStatus === 'pending') {
      await db.update(contentReviews)
        .set({ cloudImageStatus: 'pass', updatedAt: new Date().toISOString() })
        .where(eq(contentReviews.id, r.id))
    }
  }
}

async function determineFinalVerdict(r: any): Promise<void> {
  let verdict: Verdict = 'pending'

  // Local scan block → reject
  if (r.localScanStatus === 'fail' && r.finalVerdict === 'reject') {
    verdict = 'reject'
  }
  // Cloud reject
  else if (r.cloudTextStatus === 'fail' || r.cloudImageStatus === 'fail') {
    verdict = 'reject'
  }
  // Both pass
  else if (
    (r.localScanStatus === 'pass' || r.localScanStatus === 'fail') &&
    r.cloudTextStatus === 'pass' &&
    r.cloudImageStatus === 'pass'
  ) {
    // Local scan found review-level words → still pending
    if (r.localScanStatus === 'fail' && r.finalVerdict !== 'reject') {
      verdict = 'pending'
    } else {
      verdict = 'pass'
    }
  }
  // Cloud error → degrade to pending (manual review)
  else if (r.cloudTextStatus === 'error' || r.cloudImageStatus === 'error') {
    verdict = 'pending'
  }

  await db.update(contentReviews)
    .set({ finalVerdict: verdict, updatedAt: new Date().toISOString() })
    .where(eq(contentReviews.id, r.id))

  if (verdict === 'pass' || verdict === 'reject') {
    await applyReviewResult(r.targetType as TargetType, r.targetId, verdict)
  }

  logger.info({ reviewId: r.id, verdict }, 'Final verdict determined')
}

export async function getReviewStatus(targetType: TargetType, targetId: number) {
  const result = await db.select()
    .from(contentReviews)
    .where(and(
      eq(contentReviews.targetType, targetType),
      eq(contentReviews.targetId, targetId),
    ))
    .orderBy(desc(contentReviews.version))
    .limit(1)

  return result.length > 0 ? result[0] : null
}
