// IMPORTANT: ESM hoists static imports, so the `app` import MUST run AFTER the
// env vars below are set — db/index.ts reads NODE_ENV / DATABASE_PATH at import
// time to decide the DB path. A static `import { app }` would be hoisted ABOVE
// these assignments and resolve the PRODUCTION db (no tables → "no such table").
// Fix: defer the app import via dynamic import inside beforeAll.
process.env.NODE_ENV = 'test'
process.env.DATABASE_PATH = path.resolve(process.cwd(), 'data-test/test.db')

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import request from 'supertest'
import type { Express } from 'express'

let app: Express

const TEST_DATA_DIR = path.resolve(process.cwd(), 'data-test')

// Ensure test directory and run migrations
beforeAll(async () => {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
  }

  // Deferred dynamic import: env is already set above, so db/index.ts now
  // resolves the SAME test db that the migrations below write to.
  const mod = await import('../index.js')
  app = mod.app

  // Run the full migration chain to mirror the production schema (0000 → 0016).
  // 0000 creates the base tables; 0015 adds pinned_at/pinned_scope that the
  // article list query selects; 0016 is a no-op on a fresh DB (no legacy
  // `section` column) so it is safe to always run.
  const { migrate: migrate0000 } = await import('../db/migrations/0000_initial.js')
  await migrate0000()
  const { migrate: migrate0013 } = await import('../db/migrations/0013_media_article_id.js')
  await migrate0013()
  const { migrate: migrate0014 } = await import('../db/migrations/0014_add_hero_carousel_settings.js')
  await migrate0014()
  const { migrate: migrate0015 } = await import('../db/migrations/0015_add_article_pin.js')
  await migrate0015()
  const { migrate: migrate0016 } = await import('../db/migrations/0016_rebuild_articles.js')
  await migrate0016()
}, 30000)

afterAll(async () => {
  // Wait for any pending operations
  await new Promise(resolve => setTimeout(resolve, 500))
  // Try to clean up, but don't fail if locked
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    }
  } catch {
    // Ignore cleanup errors on Windows
  }
})

describe('Articles API', () => {
  it('GET /api/v1/articles should return paginated articles', async () => {
    const res = await request(app)
      .get('/api/v1/articles?page=1&limit=10')
      .expect('Content-Type', /json/)
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.pagination).toBeDefined()
    expect(res.body.pagination).toHaveProperty('page')
    expect(res.body.pagination).toHaveProperty('limit')
    expect(res.body.pagination).toHaveProperty('total')
    expect(res.body.pagination).toHaveProperty('totalPages')
  })

  it('GET /api/v1/articles should respect page and limit params', async () => {
    const res = await request(app)
      .get('/api/v1/articles?page=2&limit=5')
      .expect(200)

    expect(res.body.pagination.page).toBe(2)
    expect(res.body.pagination.limit).toBe(5)
  })

  it('GET /api/v1/articles should filter by section', async () => {
    const res = await request(app)
      .get('/api/v1/articles?section=blog')
      .expect(200)

    expect(res.body.success).toBe(true)
  })
})

describe('Sections API', () => {
  it('GET /api/v1/sections should return sections list', async () => {
    const res = await request(app)
      .get('/api/v1/sections')
      .expect('Content-Type', /json/)
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Categories API', () => {
  it('GET /api/v1/categories should return categories list', async () => {
    const res = await request(app)
      .get('/api/v1/categories')
      .expect('Content-Type', /json/)
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Site Settings API', () => {
  it('GET /api/v1/site-settings should return settings', async () => {
    const res = await request(app)
      .get('/api/v1/site-settings')
      .expect('Content-Type', /json/)
      .expect(200)

    expect(res.body.success).toBe(true)
  })
})

describe('Auth API', () => {
  it('POST /api/v1/auth/login should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'invalid', password: 'invalid' })
      .expect('Content-Type', /json/)

    expect(res.body.success).toBe(false)
  })

  it('POST /api/v1/auth/login should require username and password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({})
      .expect(400)
  })
})