import { revalidateTag, revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || 'token00-revalidate'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { secret, tag, path } = body

  if (secret !== REVALIDATE_SECRET) {
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
