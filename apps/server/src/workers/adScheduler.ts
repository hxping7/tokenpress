import { db } from '../db/index.js'
import { ads, systemEvents } from '../db/schema.js'
import { and, eq, lte, or, isNull, sql } from 'drizzle-orm'
import { withLock } from '../lib/cronLock.js'
import logger from '../utils/logger.js'

let lastTickAt: string | null = null
let lastTickSuccess = false

export const adScheduler = {
  async tick() {
    await withLock('ad_scheduler', async () => {
      const activated = await this.activateScheduledAds()
      const expired = await this.expireFinishedAds()
      const capped = await this.capReachedAds()

      logger.info({ activated, expired, capped }, 'ad scheduler tick')

      await db.insert(systemEvents).values({
        eventType: 'ad_scheduler_tick',
        level: 'info',
        message: `Activated: ${activated}, Expired: ${expired}, Capped: ${capped}`,
        detail: JSON.stringify({ tickAt: new Date().toISOString(), activated, expired, capped }),
      })

      lastTickAt = new Date().toISOString()
      lastTickSuccess = true
    })
  },

  // draft → active
  async activateScheduledAds(): Promise<number> {
    const now = new Date().toISOString()
    const result = await db.update(ads)
      .set({ status: 'active', updatedAt: now })
      .where(and(
        eq(ads.status, 'draft'),
        or(isNull(ads.startAt), lte(ads.startAt, now)),
        eq(ads.isActive, 1)
      ))
      .returning()
    return result.length
  },

  // active → expired
  async expireFinishedAds(): Promise<number> {
    const now = new Date().toISOString()
    const result = await db.update(ads)
      .set({ status: 'expired', updatedAt: now })
      .where(and(
        eq(ads.status, 'active'),
        lte(ads.endAt, now)
      ))
      .returning()
    return result.length
  },

  // active → inactive (impression/click cap reached)
  async capReachedAds(): Promise<number> {
    const now = new Date().toISOString()

    const impResult = await db.update(ads)
      .set({ status: 'inactive', isActive: 0, updatedAt: now })
      .where(and(
        eq(ads.status, 'active'),
        sql`${ads.maxImpressions} IS NOT NULL AND ${ads.impressions} >= ${ads.maxImpressions}`
      ))
      .returning()

    const clickResult = await db.update(ads)
      .set({ status: 'inactive', isActive: 0, updatedAt: now })
      .where(and(
        eq(ads.status, 'active'),
        sql`${ads.maxClicks} IS NOT NULL AND ${ads.clicks} >= ${ads.maxClicks}`
      ))
      .returning()

    // Deduplicate IDs (an ad might match both caps)
    const cappedIds = new Set([
      ...impResult.map(a => a.id),
      ...clickResult.map(a => a.id),
    ])

    return cappedIds.size
  },

  getStatus() {
    return {
      enabled: true,
      schedule: '* * * * *',
      lastTickAt,
      lastTickSuccess,
    }
  },
}
