import { db } from '../db/index.js'
import { contentReviews } from '../db/schema.js'
import { eq, and, lt, or } from 'drizzle-orm'
import { reviewContent } from '../lib/contentReview/index.js'
import logger from '../utils/logger.js'

const POLL_INTERVAL = 5_000
const STALE_THRESHOLD_MS = 5 * 60 * 1000
const MAX_RETRY_COUNT = 3

let timer: ReturnType<typeof setInterval> | null = null

export function startReviewWorker(): void {
  if (timer) return

  logger.info('Starting review scheduler worker...')

  recoverStaleReviews().catch(err => {
    logger.error({ err }, 'Failed to recover stale reviews on startup')
  })

  timer = setInterval(async () => {
    try {
      await processPendingReviews()
    } catch (err) {
      logger.error({ err }, 'Review scheduler tick error')
    }
  }, POLL_INTERVAL)

  logger.info(`Review scheduler worker started (interval: ${POLL_INTERVAL}ms)`)
}

export function stopReviewWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
    logger.info('Review scheduler worker stopped')
  }
}

async function processPendingReviews(): Promise<void> {
  const pending = await db.select()
    .from(contentReviews)
    .where(eq(contentReviews.finalVerdict, 'pending'))
    .limit(10)

  for (const review of pending) {
    try {
      await reviewContent(review.id)
    } catch (err) {
      logger.error({ err, reviewId: review.id }, 'Failed to process review')
    }
  }
}

export async function recoverStaleReviews(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()

  const stale = await db.select()
    .from(contentReviews)
    .where(and(
      eq(contentReviews.finalVerdict, 'pending'),
      lt(contentReviews.createdAt, fiveMinutesAgo),
    ))

  if (stale.length === 0) return

  logger.info({ count: stale.length }, 'Recovering stale reviews')

  for (const review of stale) {
    try {
      await reviewContent(review.id)
    } catch (err) {
      logger.error({ err, reviewId: review.id }, 'Failed to recover stale review')
    }
  }
}

export async function retryFailedReviews(): Promise<void> {
  const failed = await db.select()
    .from(contentReviews)
    .where(or(
      eq(contentReviews.cloudTextStatus, 'error'),
      eq(contentReviews.cloudImageStatus, 'error'),
    ))
    .limit(20)

  if (failed.length === 0) return

  logger.info({ count: failed.length }, 'Retrying failed cloud reviews')

  for (const review of failed) {
    try {
      const detail = review.cloudDetailJson ? JSON.parse(review.cloudDetailJson) : {}
      const retryCount = (detail.retryCount || 0) + 1

      if (retryCount > MAX_RETRY_COUNT) {
        logger.info({ reviewId: review.id, retryCount }, 'Max retry count reached, skipping')
        continue
      }

      await db.update(contentReviews)
        .set({
          cloudTextStatus: 'pending',
          cloudImageStatus: 'pending',
          cloudDetailJson: JSON.stringify({ ...detail, retryCount, lastRetryAt: new Date().toISOString() }),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(contentReviews.id, review.id))

      await reviewContent(review.id)
    } catch (err) {
      logger.error({ err, reviewId: review.id }, 'Failed to retry review')
    }
  }
}
