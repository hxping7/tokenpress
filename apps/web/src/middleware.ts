import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 首次安装守卫：全新数据库（users 为空）时，把前台/后台的所有页面重定向到
 * 安装向导 /setup。安装完成后该检查自动放行。
 *
 * 判定来自后端 GET /api/v1/setup/status（users 表为空 = 未安装，COUNT 查询很轻，
 * 走 Docker 内网）。后端不可达时放行（fail-open），避免把站点整个锁死。
 */

const BACKEND = process.env.BACKEND_URL || 'http://localhost:4001'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 自身与资源类路径不参与守卫
  if (
    pathname.startsWith('/setup') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/styles') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/setup/status`, {
      headers: { 'User-Agent': 'TokenPress-Middleware' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return NextResponse.next()
    const j = await res.json()
    if (j?.data?.installed === false) {
      const url = req.nextUrl.clone()
      url.pathname = '/setup'
      return NextResponse.redirect(url)
    }
  } catch {
    // 后端不可达：放行（页面本身也会因取不到数据而显示异常，但不制造重定向循环）
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api|styles|uploads|favicon.ico|setup).*)'],
}
