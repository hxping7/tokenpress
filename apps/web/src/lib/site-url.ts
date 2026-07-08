/**
 * 解析站点真实域名（运行时）。
 *
 * 设计要点：
 * - `NEXT_PUBLIC_SITE_URL` 会在 `next build` 阶段被内联进产物，运行期修改无效，
 *   且历史上曾被构建环境错误地写入 VPS 的 IP。
 * - 因此服务端路由应优先使用运行时的 `SITE_URL`（由 docker-compose 从 deploy.conf
 *   注入，非 NEXT_PUBLIC，不会被构建期内联），仅在缺失时回退到 NEXT_PUBLIC_SITE_URL。
 * - 末尾斜杠统一去掉，避免生成 `https://x.com//path` 这类双斜杠 URL。
 */
export function getSiteUrl(): string {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (!raw) return 'https://www.token00.com'
  return raw.replace(/\/+$/, '')
}
