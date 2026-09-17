import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  articleTags,
  articles,
  categories,
  friendLinks,
  media,
  sections,
  siteSettings,
  tags,
} from '../db/schema.js'
import { STYLES_DIR, UPLOAD_DIR } from '../utils/paths.js'

/**
 * 风格包「演示示例内容」的读取与安装。
 *
 * 风格包可选携带 `demo.json` + `demo-media/`：示例板块 / 分类 / 文章 / 标签 / 友链 /
 * 站点设置，以及它们引用的媒体文件（demo.json 里以 `demo-media/<相对路径>` 引用）。
 *
 * 安装**幂等**：板块与分类按 slug、标签按 name、文章按 slug、友链按 url、站点设置按
 * key 判定，已存在的一律跳过 —— 绝不覆盖目标站已有数据，因此可重复执行。
 *
 * 只在**首次安装向导**里调用；后台「激活风格包」不会触发内容初始化（避免误动用户数据）。
 */

const DEMO_JSON = 'demo.json'
const DEMO_MEDIA_DIR = 'demo-media'
const DEMO_MEDIA_REF = 'demo-media/'
const MEDIA_URL_PREFIX = '/api/v1/media/files/uploads/'
const UPLOAD_URL_PREFIX = '/api/v1/media/files/uploads/'

export interface DemoSummary {
  available: boolean
  generatedAt?: string
  sections: number
  categories: number
  articles: number
  tags: number
  friendLinks: number
  siteSettings: number
  media: number
}

export interface InstallStats {
  sections: number
  categories: number
  tags: number
  articles: number
  friendLinks: number
  siteSettings: number
  mediaFiles: number
  skipped: number
}

function demoDir(packId: string): string {
  return path.join(STYLES_DIR, packId)
}

export function readDemo(packId: string): any | null {
  const p = path.join(demoDir(packId), DEMO_JSON)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

/** 演示内容摘要（供安装向导展示「将安装什么」） */
export function getDemoSummary(packId: string): DemoSummary {
  const demo = readDemo(packId)
  if (!demo) {
    return { available: false, sections: 0, categories: 0, articles: 0, tags: 0, friendLinks: 0, siteSettings: 0, media: 0 }
  }
  const mediaDir = path.join(demoDir(packId), DEMO_MEDIA_DIR)
  let mediaCount = 0
  if (fs.existsSync(mediaDir)) {
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(dir, e.name))
        else mediaCount++
      }
    }
    walk(mediaDir)
  }
  return {
    available: true,
    generatedAt: demo.generatedAt,
    sections: (demo.sections || []).length,
    categories: (demo.categories || []).length,
    articles: (demo.articles || []).length,
    tags: (demo.tags || []).length,
    friendLinks: (demo.friendLinks || []).length,
    siteSettings: Object.keys(demo.siteSettings || {}).length,
    media: mediaCount,
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/**
 * 把内容里的 `demo-media/<相对路径>` 落地为真实媒体：
 * 从包目录复制到 uploads，返回目标站可访问的 URL。文件已存在则不重复复制。
 */
function materializeMedia(
  value: string | null | undefined,
  packId: string,
  copied: Map<string, { size: number; mimeType: string }>,
): string | null {
  if (!value) return value ?? null
  if (!value.includes(DEMO_MEDIA_REF)) return value
  const re = new RegExp(DEMO_MEDIA_REF + '([^"\')\\\\\\s]+)', 'g')
  return value.replace(re, (_m, rel: string) => {
    const src = path.join(demoDir(packId), DEMO_MEDIA_DIR, rel)
    if (!fs.existsSync(src)) return _m
    const dst = path.join(UPLOAD_DIR, rel)
    if (!fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.copyFileSync(src, dst)
    }
    if (!copied.has(rel)) {
      copied.set(rel, {
        size: fs.statSync(dst).size,
        mimeType: MIME_BY_EXT[path.extname(rel).toLowerCase()] || 'application/octet-stream',
      })
    }
    return MEDIA_URL_PREFIX + rel
  })
}

/**
 * 安装演示示例内容。
 * @param authorId 新内容归属的用户（安装向导里刚创建的管理员）
 */
export async function installDemo(packId: string, authorId: number): Promise<InstallStats> {
  const demo = readDemo(packId)
  if (!demo) throw new Error('该风格包未提供演示示例内容')

  const stats: InstallStats = {
    sections: 0,
    categories: 0,
    tags: 0,
    articles: 0,
    friendLinks: 0,
    siteSettings: 0,
    mediaFiles: 0,
    skipped: 0,
  }
  const copied = new Map<string, { size: number; mimeType: string }>()

  await db.transaction(async (tx) => {
    // ---- 板块（按 slug 跳过）----
    const existSections = await tx.select({ id: sections.id, slug: sections.slug }).from(sections)
    const sectionIdBySlug = new Map(existSections.map((s) => [s.slug, s.id]))
    for (const s of demo.sections || []) {
      if (sectionIdBySlug.has(s.slug)) {
        stats.skipped++
        continue
      }
      const [row] = await tx
        .insert(sections)
        .values({
          name: s.name,
          slug: s.slug,
          path: s.path,
          description: s.description ?? null,
          kind: s.kind || 'articles',
          template: s.template || 'article-list',
          templateConfig: s.templateConfig ? JSON.stringify(s.templateConfig) : null,
          layouts: s.layouts ? JSON.stringify(s.layouts) : null,
          sortOrder: s.sortOrder ?? 0,
          isActive: s.isActive === false ? 0 : 1,
        })
        .returning({ id: sections.id })
      sectionIdBySlug.set(s.slug, row.id)
      stats.sections++
    }

    // ---- 分类（按 slug 跳过）----
    const existCats = await tx.select({ id: categories.id, slug: categories.slug }).from(categories)
    const catIdBySlug = new Map(existCats.map((c) => [c.slug, c.id]))
    for (const c of demo.categories || []) {
      if (catIdBySlug.has(c.slug)) {
        stats.skipped++
        continue
      }
      const sectionId = c.sectionSlug ? sectionIdBySlug.get(c.sectionSlug) : undefined
      if (!sectionId) continue // 所属板块缺失则跳过该分类
      const [row] = await tx
        .insert(categories)
        .values({
          name: c.name,
          slug: c.slug,
          sectionId,
          description: c.description ?? null,
          template: c.template || 'article-list',
          templateConfig: c.templateConfig ? JSON.stringify(c.templateConfig) : null,
          layouts: c.layouts ? JSON.stringify(c.layouts) : null,
          sortOrder: c.sortOrder ?? 0,
        })
        .returning({ id: categories.id })
      catIdBySlug.set(c.slug, row.id)
      stats.categories++
    }

    // ---- 标签（按 name 跳过，先备好全部 tag id）----
    const existTags = await tx.select({ id: tags.id, name: tags.name }).from(tags)
    const tagIdByName = new Map(existTags.map((t) => [t.name, t.id]))
    for (const name of demo.tags || []) {
      if (tagIdByName.has(name)) continue
      const [row] = await tx.insert(tags).values({ name }).returning({ id: tags.id })
      tagIdByName.set(name, row.id)
      stats.tags++
    }

    // ---- 文章（按 slug 跳过；媒体在此落地）----
    const existArticles = await tx.select({ id: articles.id, slug: articles.slug }).from(articles)
    const articleIdBySlug = new Map(existArticles.map((a) => [a.slug, a.id]))
    for (const a of demo.articles || []) {
      if (articleIdBySlug.has(a.slug)) {
        stats.skipped++
        continue
      }
      const sectionId = a.sectionSlug ? sectionIdBySlug.get(a.sectionSlug) : undefined
      if (!sectionId) continue // 所属板块缺失则跳过该文章
      const [row] = await tx
        .insert(articles)
        .values({
          title: a.title,
          slug: a.slug,
          content: materializeMedia(a.content, packId, copied) || '',
          excerpt: a.excerpt ?? null,
          coverImage: materializeMedia(a.coverImage, packId, copied),
          sectionId,
          categoryId: a.categorySlug ? catIdBySlug.get(a.categorySlug) ?? null : null,
          status: a.status || 'published',
          authorId,
          meta: a.meta ? JSON.stringify(a.meta) : null,
          articleTemplate: a.articleTemplate || 'standard',
          templateConfig: a.templateConfig ? JSON.stringify(a.templateConfig) : null,
          sortOrder: a.sortOrder ?? 0,
          publishedAt: a.publishedAt ?? null,
          pinnedAt: a.pinnedAt ?? null,
          pinnedScope: a.pinnedScope ?? null,
        })
        .returning({ id: articles.id })
      articleIdBySlug.set(a.slug, row.id)
      stats.articles++

      for (const tagName of a.tags || []) {
        const tagId = tagIdByName.get(tagName)
        if (tagId) await tx.insert(articleTags).values({ articleId: row.id, tagId }).onConflictDoNothing()
      }
    }

    // ---- 友链（按 url 跳过）----
    const existLinks = await tx.select({ url: friendLinks.url }).from(friendLinks)
    const linkUrls = new Set(existLinks.map((l) => l.url))
    for (const l of demo.friendLinks || []) {
      if (!l?.url || linkUrls.has(l.url)) {
        stats.skipped++
        continue
      }
      await tx.insert(friendLinks).values({
        name: l.name,
        url: l.url,
        description: l.description ?? null,
        sortOrder: l.sortOrder ?? 0,
        isActive: l.isActive === false ? 0 : 1,
      })
      linkUrls.add(l.url)
      stats.friendLinks++
    }

    // ---- 站点设置（按 key 跳过：目标站已配过的一律不动）----
    const existSettings = await tx.select({ key: siteSettings.key }).from(siteSettings)
    const settingKeys = new Set(existSettings.map((s) => s.key))
    for (const [key, raw] of Object.entries(demo.siteSettings || {})) {
      if (settingKeys.has(key)) {
        stats.skipped++
        continue
      }
      const value = materializeMedia(typeof raw === 'string' ? raw : JSON.stringify(raw), packId, copied)
      await tx.insert(siteSettings).values({ key, value: value ?? '' })
      settingKeys.add(key)
      stats.siteSettings++
    }

    // ---- 媒体登记（媒体库可见）----
    for (const [rel, info] of copied) {
      const url = UPLOAD_URL_PREFIX + rel
      const existing = await tx.select({ id: media.id }).from(media).where(eq(media.url, url))
      if (existing.length > 0) continue
      await tx.insert(media).values({
        filename: path.basename(rel),
        originalName: path.basename(rel),
        mimeType: info.mimeType,
        size: info.size,
        url,
        uploadedBy: authorId,
        isReviewed: 1,
      })
    }
  })

  stats.mediaFiles = copied.size
  return stats
}
