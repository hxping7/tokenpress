import { revalidateTag, revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * SEC-09：不再回退到公开的默认口令 `token00-revalidate`。
 * 未显式注入时拒绝所有刷新请求（失败关闭），避免任何人都能触发缓存重建。
 */
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET

/** 恒定时间比较：先 sha256 归一化长度，再做 timingSafeEqual */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function POST(req: NextRequest) {
  let body: { secret?: unknown; tag?: string; path?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { secret, tag, path } = body

  if (!REVALIDATE_SECRET) {
    console.error('[SEC-09] REVALIDATE_SECRET 未配置，已拒绝全部 revalidate 请求。请在部署环境注入 32 位以上随机值。')
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  if (typeof secret !== 'string' || !safeEqual(secret, REVALIDATE_SECRET)) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  try {
    if (tag) {
      revalidateTag(tag)
    }
    if (path) {
      revalidatePath(path)
    }
    return NextResponse.json({ revalidated: true, tag, path, now: Date.now() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
