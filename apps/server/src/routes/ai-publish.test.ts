// Integration test for the AI publish endpoint's category handling,
// covering the previously-broken update path (category silently dropped).
//
// IMPORTANT: ESM hoists static imports, so the `app` import MUST run AFTER the
// env vars below are set — db/index.ts reads NODE_ENV / DATABASE_PATH at import
// time. Use a deferred dynamic import inside beforeAll (see articles.test.ts).
process.env.NODE_ENV = 'test'
process.env.DATABASE_PATH = path.resolve(process.cwd(), 'data-test/publish-test.db')

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import request from 'supertest'
import type { Express } from 'express'

let app: Express

const TEST_DATA_DIR = path.resolve(process.cwd(), 'data-test')

// Valid API token used by the tests (must start with t00_sk_)
const TEST_TOKEN = 't00_sk_test_publish_category'
const TEST_USERNAME = 'publish_test_user'

beforeAll(async () => {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
  }

  const mod = await import('../index.js')
  app = mod.app

  // Mirror the FULL production migration chain (0000 → 0022) on the test db.
  // The schema includes columns added after 0016 (sections.layouts, categories.layouts,
  // article_template, etc.) that the running schema expects.
  const migrations = [
    '../db/migrations/0000_initial.js',
    '../db/migrations/0013_media_article_id.js',
    '../db/migrations/0014_add_hero_carousel_settings.js',
    '../db/migrations/0015_add_article_pin.js',
    '../db/migrations/0016_rebuild_articles.js',
    '../db/migrations/0017_add_sections_layouts.js',
    '../db/migrations/0018_add_design_works.js',
    '../db/migrations/0019_add_template.js',
    '../db/migrations/0020_merge_design_works_into_articles.js',
    '../db/migrations/0021_add_article_template.js',
    '../db/migrations/0022_add_category_layouts.js',
  ]
  for (const m of migrations) {
    const { migrate } = await import(m)
    await migrate()
  }

  // Seed: section, two categories, a superadmin user, and an API token.
  const { db } = await import('../db/index.js')
  const { sections, categories, users, apiTokens } = await import('../db/schema.js')
  const { eq } = await import('drizzle-orm')

  let sectionId: number
  const section = await db.select().from(sections).where(eq(sections.slug, 'blog')).get()
  if (section) {
    sectionId = section.id
  } else {
    const r = await db.insert(sections).values({
      name: 'Blog',
      slug: 'blog',
      path: '/blog',
      isActive: 1,
    }).run()
    sectionId = Number(r.lastInsertRowid)
  }

  const getOrCreateCategory = async (name: string, slug: string) => {
    const existing = await db.select().from(categories).where(eq(categories.slug, slug)).get()
    if (existing) return existing.id
    const r = await db.insert(categories).values({ name, slug, sectionId }).run()
    return Number(r.lastInsertRowid)
  }
  const catAId = await getOrCreateCategory('AI 教程', 'ai-tutorial')
  const catBId = await getOrCreateCategory('DeepSeek 实战', 'deepseek-harness')

  let userId: number
  const existingUser = await db.select().from(users).where(eq(users.username, TEST_USERNAME)).get()
  if (existingUser) {
    userId = existingUser.id
  } else {
    const user = await db.insert(users).values({
      username: TEST_USERNAME,
      passwordHash: 'x',
      role: 'superadmin',
      isActive: 1,
      displayName: 'Test',
    }).run()
    userId = Number(user.lastInsertRowid)
  }

  const existingToken = await db.select().from(apiTokens).where(eq(apiTokens.token, TEST_TOKEN)).get()
  if (!existingToken) {
    await db.insert(apiTokens).values({
      userId,
      token: TEST_TOKEN,
      name: 'test',
      permissions: JSON.stringify(['article:write']),
      isActive: 1,
    }).run()
  }

  // Stash ids for the tests without polluting globals.
  ;(globalThis as any).__catIds = { catAId, catBId, sectionId }
}, 30000)

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 300))
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    }
  } catch {
    // Ignore cleanup errors on Windows
  }
})

const auth = { Authorization: `Bearer ${TEST_TOKEN}` }

describe('AI publish — category on update (regression)', () => {
  const slug = `cat-update-test-${Date.now()}`

  it('create assigns category from category slug', async () => {
    const res = await request(app)
      .post('/api/v1/ai/publish')
      .set(auth)
      .send({
        title: 'Cat Update Test',
        content: '# body',
        section: 'blog',
        category: 'ai-tutorial',
        status: 'published',
        slug,
      })
      .expect(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.action).toBe('created')

    // Verify persisted category directly from DB (admin list is JWT-gated).
    const { db } = await import('../db/index.js')
    const { articles } = await import('../db/schema.js')
    const { eq } = await import('drizzle-orm')
    const row = await db.select().from(articles).where(eq(articles.slug, slug)).get()
    expect(row?.categoryId).toBe((globalThis as any).__catIds.catAId)
  })

  it('re-publish with categoryId moves article to new category', async () => {
    const res = await request(app)
      .post('/api/v1/ai/publish')
      .set(auth)
      .send({
        title: 'Cat Update Test',
        content: '# body updated',
        section: 'blog',
        categoryId: (globalThis as any).__catIds.catBId,
        status: 'published',
        slug,
      })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.action).toBe('updated')

    const { db } = await import('../db/index.js')
    const { articles } = await import('../db/schema.js')
    const { eq } = await import('drizzle-orm')
    const row = await db.select().from(articles).where(eq(articles.slug, slug)).get()
    expect(row?.categoryId).toBe((globalThis as any).__catIds.catBId)
  })

  it('re-publish with category=slug also moves category', async () => {
    const res = await request(app)
      .post('/api/v1/ai/publish')
      .set(auth)
      .send({
        title: 'Cat Update Test',
        content: '# body again',
        section: 'blog',
        category: 'ai-tutorial',
        status: 'published',
        slug,
      })
      .expect(200)
    const { db } = await import('../db/index.js')
    const { articles } = await import('../db/schema.js')
    const { eq } = await import('drizzle-orm')
    const row = await db.select().from(articles).where(eq(articles.slug, slug)).get()
    expect(row?.categoryId).toBe((globalThis as any).__catIds.catAId)
  })

  it('re-publish with category=null clears category (does not drop silently)', async () => {
    const res = await request(app)
      .post('/api/v1/ai/publish')
      .set(auth)
      .send({
        title: 'Cat Update Test',
        content: '# body cleared',
        section: 'blog',
        category: null,
        status: 'published',
        slug,
      })
      .expect(200)
    const { db } = await import('../db/index.js')
    const { articles } = await import('../db/schema.js')
    const { eq } = await import('drizzle-orm')
    const row = await db.select().from(articles).where(eq(articles.slug, slug)).get()
    expect(row?.categoryId).toBeNull()
  })

  it('re-publish with unknown category returns 400 (no silent drop)', async () => {
    await request(app)
      .post('/api/v1/ai/publish')
      .set(auth)
      .send({
        title: 'Cat Update Test',
        content: '# body bad cat',
        section: 'blog',
        category: 'does-not-exist',
        status: 'published',
        slug,
      })
      .expect(400)
  })
})

describe('AI categories — create & modify (remote category management)', () => {
  const getSectionId = () => (globalThis as any).__catIds.sectionId as number

  it('create category under a section (by section slug)', async () => {
    const uniqueSlug = `ai-created-${Date.now()}`
    const res = await request(app)
      .post('/api/v1/ai/categories')
      .set(auth)
      .send({
        name: '远程创建分类',
        slug: uniqueSlug,
        section: 'blog',
        description: 'created by AI API',
        sortOrder: 5,
      })
      .expect(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('远程创建分类')
    expect(res.body.data.slug).toBe(uniqueSlug)
    expect(res.body.data.sectionId).toBe(getSectionId())
  })

  it('create without section returns 400', async () => {
    await request(app)
      .post('/api/v1/ai/categories')
      .set(auth)
      .send({ name: '无板块分类' })
      .expect(400)
  })

  it('create with duplicate slug returns 409', async () => {
    const res = await request(app)
      .post('/api/v1/ai/categories')
      .set(auth)
      .send({ name: '重复 slug', slug: 'ai-tutorial', section: 'blog' })
      .expect(409)
    expect(res.body.success).toBe(false)
  })

  it('modify existing category renames it', async () => {
    const create = await request(app)
      .post('/api/v1/ai/categories')
      .set(auth)
      .send({ name: '待改分类', slug: `ai-mod-${Date.now()}`, section: 'blog' })
      .expect(201)
    const id = create.body.data.id

    const res = await request(app)
      .put(`/api/v1/ai/categories/${id}`)
      .set(auth)
      .send({ name: '已改分类', description: 'updated by AI API' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('已改分类')
    expect(res.body.data.description).toBe('updated by AI API')
  })

  it('modify missing category returns 404', async () => {
    await request(app)
      .put('/api/v1/ai/categories/999999')
      .set(auth)
      .send({ name: '不存在' })
      .expect(404)
  })
})
