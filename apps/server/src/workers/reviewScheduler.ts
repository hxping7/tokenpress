import { db } from '../db/index.js'
import { contentReviews } from '../db/schema.js'
import { eq, and, lt } from 'drizzle-orm'
import { reviewContent } from '../lib/contentReview/index.js'
import logger from '../utils/logger.js'

const POLL_INTERVAL = 5_000
const STALE_THRESHOLD_MS = 5 * 60 * 1000

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
