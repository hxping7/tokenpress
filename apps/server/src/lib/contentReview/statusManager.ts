import { db } from '../../db/index.js'
import { articles, media, friendLinks, ads } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import logger from '../../utils/logger.js'
import type { Verdict, TargetType } from './types.js'

export async function applyReviewResult(targetType: TargetType, targetId: number, verdict: Verdict): Promise<void> {
  switch (targetType) {
    case 'article':
      await applyArticleReview(targetId, verdict)
      break
    case 'media':
      await applyMediaReview(targetId, verdict)
      break
    case 'friend_link':
      await applyFriendLinkReview(targetId, verdict)
      break
    case 'ad':
      await applyAdReview(targetId, verdict)
      break
    default:
      logger.info({ targetType, targetId, verdict }, 'Review result applied (no status update needed)')
  }
}

async function applyArticleReview(articleId: number, verdict: Verdict): Promise<void> {
  let newStatus: string
  switch (verdict) {
    case 'pass':
      newStatus = 'published'
      break
    case 'reject':
      newStatus = 'draft'
      break
    default:
      newStatus = 'pending_review'
  }

  await db.update(articles)
    .set({
      status: newStatus as any,
      publishedAt: verdict === 'pass' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(articles.id, articleId))

  logger.info({ articleId, verdict, newStatus }, 'Article review result applied')
}

async function applyMediaReview(mediaId: number, verdict: Verdict): Promise<void> {
  const isReviewed = verdict === 'pass' ? 1 : 0
  const reviewNote = verdict === 'reject' ? 'Content review rejected' : (verdict === 'pass' ? 'Approved' : 'Pending review')

  await db.update(media)
    .set({
      isReviewed,
      reviewNote,
    })
    .where(eq(media.id, mediaId))

  logger.info({ mediaId, verdict, isReviewed }, 'Media review result applied')
}

async function applyFriendLinkReview(linkId: number, verdict: Verdict): Promise<void> {
  const isActive = verdict === 'pass' ? 1 : 0

  await db.update(friendLinks)
    .set({
      isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(friendLinks.id, linkId))

  logger.info({ linkId, verdict, isActive }, 'Friend link review result applied')
}

export async function applyAdReview(adId: number, verdict: Verdict): Promise<void> {
  const now = new Date().toISOString()
  let newStatus: string
  let isActive: number | undefined

  switch (verdict) {
    case 'pass': {
      // Check if startAt is in the future
      const ad = await db.select().from(ads).where(eq(ads.id, adId)).get()
      newStatus = (ad?.startAt && ad.startAt > now) ? 'draft' : 'active'
      break
    }
    case 'reject':
      newStatus = 'inactive'
      isActive = 0
      break
    default:
      newStatus = 'pending_review'
  }

  const updates: Record<string, unknown> = { status: newStatus, updatedAt: now }
  if (isActive !== undefined) updates.isActive = isActive

  await db.update(ads)
    .set(updates)
    .where(eq(ads.id, adId))

  logger.info({ adId, verdict, newStatus }, 'Ad review result applied')
}
