// Must set env BEFORE importing app
process.env.NODE_ENV = 'test'
process.env.DATABASE_PATH = 'data-test/test.db'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import request from 'supertest'
import { app } from '../index.js'

const TEST_DATA_DIR = path.resolve(process.cwd(), 'data-test')

// Ensure test directory and run migrations
beforeAll(async () => {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
  }

  const { migrate } = await import('../db/migrations/0000_initial.js')
  await migrate()
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