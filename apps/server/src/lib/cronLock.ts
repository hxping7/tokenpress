import { db } from '../db/index.js'
import { cronLocks } from '../db/schema.js'
import { eq, lt } from 'drizzle-orm'
import { hostId } from './hostId.js'
import crypto from 'crypto'

const LOCK_TTL_SECONDS = 50

export async function withLock<T>(
  lockName: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000)
  const instanceId = `${hostId}-${crypto.randomBytes(4).toString('hex')}`

  // 原子获取锁：清理过期锁 + 尝试插入，使用事务保证原子性
  const acquired = await db.transaction(async (tx) => {
    // 清理过期锁
    await tx.delete(cronLocks)
      .where(lt(cronLocks.expiresAt, now.toISOString()))

    // 尝试插入
    try {
      await tx.insert(cronLocks)
        .values({
          name: lockName,
          acquiredAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          holderId: instanceId,
        })
        .onConflictDoNothing()
        .run()
    } catch {
      return false
    }

    // 在事务内验证锁是否由当前实例持有
    const lock = await tx.select().from(cronLocks).where(eq(cronLocks.name, lockName)).get()
    return lock?.holderId === instanceId
  })

  if (!acquired) {
    return null
  }

  try {
    return await fn()
  } finally {
    await db.delete(cronLocks)
      .where(eq(cronLocks.name, lockName))
  }
}

export async function cleanupExpiredLocks(): Promise<void> {
  await db.delete(cronLocks)
    .where(lt(cronLocks.expiresAt, new Date().toISOString()))
}