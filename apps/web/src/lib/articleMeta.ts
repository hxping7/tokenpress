// 文章扩展字段（meta JSON）解析工具。
// 作品集类内容（meta.kind === 'design_work'）将作品专属字段存于 meta 中，
// 普通文章 meta 为空或含其它扩展信息。

export interface ArticleMeta {
  kind?: string
  summary?: string | null
  authorName?: string | null
  authorAvatar?: string | null
  category?: string | null
  tags?: string[]
  externalUrl?: string | null
  galleryImages?: string[]
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return []
    try {
      const parsed = JSON.parse(s)
      return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [s]
    } catch {
      return [s]
    }
  }
  return []
}

export function parseArticleMeta(meta: unknown): ArticleMeta {
  if (!meta) return {}
  let m: any = meta
  if (typeof meta === 'string') {
    const s = meta.trim()
    if (!s) return {}
    try {
      m = JSON.parse(s)
    } catch {
      return {}
    }
  }
  if (!m || typeof m !== 'object') return {}

  return {
    kind: m.kind,
    summary: m.summary ?? null,
    authorName: m.authorName ?? null,
    authorAvatar: m.authorAvatar ?? null,
    category: m.category ?? null,
    tags: asStringArray(m.tags),
    externalUrl: m.externalUrl ?? null,
    galleryImages: asStringArray(m.galleryImages),
  }
}

export function isDesignWork(meta: unknown): boolean {
  return parseArticleMeta(meta).kind === 'design_work'
}
