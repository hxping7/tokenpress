/**
 * 后端 → 前端 的**容器内**地址。
 *
 * 必须用 docker 网络里的服务名与前端内部端口（`http://frontend:4000`）：
 * `FRONTEND_URL` 是**给浏览器看的对外地址**（CORS / referer 白名单用它），
 * 在 backend 容器里访问 `localhost:3001` 只会连到自己 → 每次刷新都 fetch failed。
 * 未配置 `FRONTEND_INTERNAL_URL` 时回退 `FRONTEND_URL`（非容器化部署仍可用）。
 */
const FRONTEND_INTERNAL_URL =
  process.env.FRONTEND_INTERNAL_URL || process.env.FRONTEND_URL || 'http://localhost:4000'
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || 'token00-revalidate'

/** 规范化前端路径：补前导斜杠、去重（避免 `//xxx` 这类永不匹配的路径） */
function normalizePath(p: string): string {
  if (!p) return '/'
  const withSlash = p.startsWith('/') ? p : `/${p}`
  return withSlash.replace(/\/{2,}/g, '/')
}

export async function revalidateTag(tag: string): Promise<void> {
  try {
    const res = await fetch(`${FRONTEND_INTERNAL_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: REVALIDATE_SECRET, tag }),
    })
    if (!res.ok) {
      console.warn(`Revalidate tag "${tag}" failed: ${res.status}`)
    }
  } catch (err) {
    console.warn(`Revalidate tag "${tag}" error:`, err)
  }
}

export async function revalidatePath(path: string): Promise<void> {
  const normalized = normalizePath(path)
  try {
    const res = await fetch(`${FRONTEND_INTERNAL_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: REVALIDATE_SECRET, path: normalized }),
    })
    if (!res.ok) {
      console.warn(`Revalidate path "${normalized}" failed: ${res.status}`)
    }
  } catch (err) {
    console.warn(`Revalidate path "${normalized}" error:`, err)
  }
}
