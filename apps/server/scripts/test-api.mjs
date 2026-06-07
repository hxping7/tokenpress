/**
 * API 测试脚本
 * 运行: node scripts/test-api.mjs
 */

const BASE_URL = 'http://localhost:4001/api/v1'

let jwtToken = ''
let apiToken = ''
let testUserId = null
let testArticleId = null
let testWorkId = null
let testCategoryId = null
let testMediaId = null

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
}

function log(test, passed, detail = '') {
  const icon = passed ? '✓' : '✗'
  const color = passed ? colors.green : colors.red
  console.log(`${color}${icon}${colors.reset} ${test}${detail ? ` - ${detail}` : ''}`)
}

async function request(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}${path}`
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body) options.body = JSON.stringify(body)
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function testHealth() {
  console.log(`\n${colors.blue}=== Health Check ===${colors.reset}`)
  const { status, data } = await request('GET', '/health')
  log('GET /health', status === 200 && data.success, `status: ${status}`)
}

async function testAuth() {
  console.log(`\n${colors.blue}=== Auth ===${colors.reset}`)

  // Login
  let res = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' })
  log('POST /auth/login', res.status === 200 && res.data.success, res.data.success ? '登录成功' : res.data.error)
  if (res.data.success) {
    jwtToken = res.data.data.token
    console.log(`  JWT Token: ${jwtToken.substring(0, 20)}...`)
  }

  // Get me
  res = await request('GET', '/auth/me', null, { Authorization: `Bearer ${jwtToken}` })
  log('GET /auth/me', res.status === 200 && res.data.success, res.data.data?.username)

  // Refresh token
  res = await request('POST', '/auth/refresh', null, { Authorization: `Bearer ${jwtToken}` })
  log('POST /auth/refresh', res.status === 200 && res.data.success)

  // Invalid login
  res = await request('POST', '/auth/login', { username: 'hxp', password: 'wrong' })
  log('POST /auth/login (wrong password)', res.status === 401, '返回 401')
}

async function testUsers() {
  console.log(`\n${colors.blue}=== Users ===${colors.reset}`)
  const auth = { Authorization: `Bearer ${jwtToken}` }

  // List users
  let res = await request('GET', '/users', null, auth)
  log('GET /users', res.status === 200 && res.data.success, `共 ${res.data.data?.length} 个用户`)

  // Create user
  const timestamp = Date.now()
  res = await request('POST', '/users', {
    username: `test_${timestamp}`,
    password: 'test123456',
    displayName: '测试用户',
    role: 'user',
  }, auth)
  log('POST /users', res.status === 201 && res.data.success, res.data.data?.username)
  if (res.data.success) {
    testUserId = res.data.data.id
  }

  // Update user
  if (testUserId) {
    res = await request('PUT', `/users/${testUserId}`, { displayName: '更新后的名字' }, auth)
    log('PUT /users/:id', res.status === 200 && res.data.success, res.data.data?.display_name)
  }

  // Reset password
  if (testUserId) {
    res = await request('PATCH', `/users/${testUserId}/reset-password`, {}, auth)
    log('PATCH /users/:id/reset-password', res.status === 200 && res.data.success, `新密码: ${res.data.data?.password}`)
  }

  // Toggle user status (disable)
  if (testUserId) {
    res = await request('PUT', `/users/${testUserId}`, { isActive: false }, auth)
    log('PUT /users/:id (disable)', res.status === 200 && res.data.success, `is_active: ${res.data.data?.is_active}`)

    // Re-enable
    res = await request('PUT', `/users/${testUserId}`, { isActive: true }, auth)
    log('PUT /users/:id (enable)', res.status === 200 && res.data.success, `is_active: ${res.data.data?.is_active}`)
  }

  // Delete user
  if (testUserId) {
    res = await request('DELETE', `/users/${testUserId}`, null, auth)
    log('DELETE /users/:id', res.status === 200 && res.data.success)
  }
}

async function testTokens() {
  console.log(`\n${colors.blue}=== API Tokens ===${colors.reset}`)
  const auth = { Authorization: `Bearer ${jwtToken}` }

  // List tokens
  let res = await request('GET', '/tokens', null, auth)
  log('GET /tokens', res.status === 200 && res.data.success, `共 ${res.data.data?.length} 个 token`)

  // Create token
  res = await request('POST', '/tokens', {
    name: `测试Token_${Date.now()}`,
    permissions: ['article:write', 'media:upload'],
  }, auth)
  log('POST /tokens', res.status === 201 && res.data.success, res.data.data?.token?.substring(0, 20) + '...')
  if (res.data.success) {
    apiToken = res.data.data.token
    testTokenId = res.data.data.id
  }

  // Toggle token
  if (testTokenId) {
    res = await request('PATCH', `/tokens/${testTokenId}`, { is_active: false }, auth)
    log('PATCH /tokens/:id (disable)', res.status === 200 && res.data.success, `is_active: ${res.data.data?.is_active}`)

    res = await request('PATCH', `/tokens/${testTokenId}`, { is_active: true }, auth)
    log('PATCH /tokens/:id (enable)', res.status === 200 && res.data.success, `is_active: ${res.data.data?.is_active}`)
  }

  // Delete token
  if (testTokenId) {
    res = await request('DELETE', `/tokens/${testTokenId}`, null, auth)
    log('DELETE /tokens/:id', res.status === 200 && res.data.success)
  }

  // Create another token for AI tests
  res = await request('POST', '/tokens', {
    name: 'AI测试Token',
    permissions: ['article:write', 'media:upload', 'work:write', 'content:delete'],
  }, auth)
  if (res.data.success) {
    apiToken = res.data.data.token
    console.log(`  保留 API Token 用于后续测试: ${apiToken.substring(0, 20)}...`)
  }
}

async function testCategories() {
  console.log(`\n${colors.blue}=== Categories ===${colors.reset}`)
  const auth = { Authorization: `Bearer ${jwtToken}` }

  // List categories (public)
  let res = await request('GET', '/categories')
  log('GET /categories (public)', res.status === 200 && res.data.success, `共 ${res.data.data?.length} 个分类`)

  // Create category
  const timestamp = Date.now()
  res = await request('POST', '/categories', {
    name: `测试分类_${timestamp}`,
    section: 'blog',
    description: '测试用分类',
  }, auth)
  log('POST /categories', res.status === 201 && res.data.success, res.data.data?.name)
  if (res.data.success) {
    testCategoryId = res.data.data.id
  }

  // Get category by ID
  if (testCategoryId) {
    res = await request('GET', `/categories/${testCategoryId}`)
    log('GET /categories/:id', res.status === 200 && res.data.success, res.data.data?.name)
  }

  // Update category
  if (testCategoryId) {
    res = await request('PUT', `/categories/${testCategoryId}`, { name: '更新后的分类名' }, auth)
    log('PUT /categories/:id', res.status === 200 && res.data.success, res.data.data?.name)
  }

  // Delete category
  if (testCategoryId) {
    res = await request('DELETE', `/categories/${testCategoryId}`, null, auth)
    log('DELETE /categories/:id', res.status === 200 && res.data.success)
  }
}

async function testArticles() {
  console.log(`\n${colors.blue}=== Articles ===${colors.reset}`)
  const auth = { Authorization: `Bearer ${jwtToken}` }

  // List public articles
  let res = await request('GET', '/articles')
  log('GET /articles (public)', res.status === 200 && res.data.success, `共 ${res.data.data?.length} 篇文章`)

  // List admin articles
  res = await request('GET', '/admin/articles', null, auth)
  log('GET /admin/articles', res.status === 200 && res.data.success, `共 ${res.data.data?.length} 篇文章`)

  // Create article
  const timestamp = Date.now()
  res = await request('POST', '/admin/articles', {
    title: `测试文章_${timestamp}`,
    content: '# 测试内容\n\n这是一篇测试文章。',
    section: 'blog',
    status: 'draft',
  }, auth)
  log('POST /admin/articles', res.status === 201 && res.data.success, res.data.data?.title)
  if (res.data.success) {
    testArticleId = res.data.data.id
  }

  // Get article by ID
  if (testArticleId) {
    res = await request('GET', `/articles/${testArticleId}`)
    log('GET /articles/:id', res.status === 200 && res.data.success, res.data.data?.title)
  }

  // Update article
  if (testArticleId) {
    res = await request('PUT', `/admin/articles/${testArticleId}`, {
      title: '更新后的文章标题',
      status: 'published',
    }, auth)
    log('PUT /admin/articles/:id', res.status === 200 && res.data.success, res.data.data?.title)
  }

  // Delete article
  if (testArticleId) {
    res = await request('DELETE', `/admin/articles/${testArticleId}`, null, auth)
    log('DELETE /admin/articles/:id', res.status === 200 && res.data.success)
    testArticleId = null
  }
}

async function testWorks() {
  console.log(`\n${colors.blue}=== Works ===${colors.reset}`)
  const auth = { Authorization: `Bearer ${jwtToken}` }

  // List public works
  let res = await request('GET', '/works')
  log('GET /works (public)', res.status === 200 && res.data.success, `共 ${res.data.data?.length} 个作品`)

  // Create work
  const timestamp = Date.now()
  res = await request('POST', '/works', {
    title: `测试作品_${timestamp}`,
    description: '这是一幅测试作品',
    mediaType: 'image',
    mediaUrl: 'https://example.com/test.jpg',
    status: 'draft',
  }, auth)
  log('POST /works', res.status === 201 && res.data.success, res.data.data?.title)
  if (res.data.success) {
    testWorkId = res.data.data.id
  }

  // Get work by ID
  if (testWorkId) {
    res = await request('GET', `/works/${testWorkId}`)
    log('GET /works/:id', res.status === 200 && res.data.success, res.data.data?.title)
  }

  // Update work
  if (testWorkId) {
    res = await request('PUT', `/works/${testWorkId}`, {
      title: '更新后的作品标题',
      status: 'published',
    }, auth)
    log('PUT /works/:id', res.status === 200 && res.data.success, res.data.data?.title)
  }

  // Delete work
  if (testWorkId) {
    res = await request('DELETE', `/works/${testWorkId}`, null, auth)
    log('DELETE /works/:id', res.status === 200 && res.data.success)
    testWorkId = null
  }
}

async function testMedia() {
  console.log(`\n${colors.blue}=== Media ===${colors.reset}`)
  const auth = { Authorization: `Bearer ${jwtToken}` }

  // List media
  let res = await request('GET', '/media', null, auth)
  log('GET /media', res.status === 200 && res.data.success, `共 ${res.data.data?.length} 个媒体`)

  // Upload media (URL-based)
  res = await request('POST', '/media', {
    url: 'https://example.com/test-image.jpg',
    filename: 'test-image.jpg',
    mimeType: 'image/jpeg',
  }, auth)
  log('POST /media (URL)', res.status === 201 && res.data.success, res.data.data?.url)
  if (res.data.success) {
    testMediaId = res.data.data.id
  }

  // Delete media
  if (testMediaId) {
    res = await request('DELETE', `/media/${testMediaId}`, null, auth)
    log('DELETE /media/:id', res.status === 200 && res.data.success)
    testMediaId = null
  }
}

async function testAIPublish() {
  console.log(`\n${colors.blue}=== AI Publish ===${colors.reset}`)
  if (!apiToken) {
    console.log('  跳过: 没有 API Token')
    return
  }
  const auth = { Authorization: `Bearer ${apiToken}` }

  // List articles via AI API
  let res = await request('GET', '/ai/articles', null, auth)
  log('GET /ai/articles', res.status === 200 && res.data.success, `共 ${res.data.data?.length} 篇文章`)

  // Publish article
  const timestamp = Date.now()
  res = await request('POST', '/ai/publish', {
    title: `AI发布的文章_${timestamp}`,
    content: '# AI 发布测试\n\n这是由 AI 智能体发布的内容。',
    section: 'blog',
    tags: ['AI', '测试'],
    status: 'published',
  }, auth)
  log('POST /ai/publish', res.status === 201 && res.data.success, `${res.data.data?.action}: ${res.data.data?.slug}`)
  if (res.data.success) {
    testArticleId = res.data.data.id
    const articleSlug = res.data.data.slug

    // Update article via AI (same slug)
    res = await request('POST', '/ai/publish', {
      title: `AI更新的文章_${timestamp}`,
      content: '# 更新内容\n\n文章已更新。',
      section: 'blog',
      slug: articleSlug,
    }, auth)
    log('POST /ai/publish (update)', res.status === 200 && res.data.success, res.data.data?.action)

    // Delete article via AI
    res = await request('DELETE', `/ai/articles/${articleSlug}`, null, auth)
    log('DELETE /ai/articles/:slug', res.status === 200 && res.data.success)
  }
}

async function testStats() {
  console.log(`\n${colors.blue}=== Stats ===${colors.reset}`)
  const auth = { Authorization: `Bearer ${jwtToken}` }

  const res = await request('GET', '/stats', null, auth)
  log('GET /stats', res.status === 200 && res.data.success, `总调用: ${res.data.data?.overview?.totalCalls || 0}`)
}

async function testUnauthorized() {
  console.log(`\n${colors.blue}=== Unauthorized Access ===${colors.reset}`)

  // Access protected route without token
  let res = await request('GET', '/users')
  log('GET /users (no token)', res.status === 401, '返回 401')

  // Access admin route with non-admin token (if we had one)
  // For now, just test that admin routes require auth
  res = await request('POST', '/categories', { name: 'test', section: 'blog' })
  log('POST /categories (no token)', res.status === 401, '返回 401')

  // Invalid JWT
  res = await request('GET', '/users', null, { Authorization: 'Bearer invalid_token' })
  log('GET /users (invalid token)', res.status === 401, '返回 401')

  // Invalid API Token
  res = await request('POST', '/ai/publish', { title: 'test' }, { Authorization: 'Bearer invalid_api_token' })
  log('POST /ai/publish (invalid API token)', res.status === 401, '返回 401')
}

async function cleanup() {
  console.log(`\n${colors.blue}=== Cleanup ===${colors.reset}`)
  const auth = { Authorization: `Bearer ${jwtToken}` }

  // Delete the API token we created
  if (apiToken) {
    // Get token list to find the one we created
    const res = await request('GET', '/tokens', null, auth)
    if (res.data.success) {
      const token = res.data.data.find(t => t.name === 'AI测试Token')
      if (token) {
        await request('DELETE', `/tokens/${token.id}`, null, auth)
        console.log('  清理: 删除测试用 API Token')
      }
    }
  }
}

let testTokenId = null

async function main() {
  console.log(`${colors.yellow}========================================${colors.reset}`)
  console.log(`${colors.yellow}  Token00 API 测试${colors.reset}`)
  console.log(`${colors.yellow}========================================${colors.reset}`)
  console.log(`API Base URL: ${BASE_URL}`)

  try {
    await testHealth()
    await testAuth()

    if (!jwtToken) {
      console.log(`\n${colors.red}无法获取 JWT Token，跳过后续测试${colors.reset}`)
      return
    }

    await testUsers()
    await testTokens()
    await testCategories()
    await testArticles()
    await testWorks()
    await testMedia()
    await testAIPublish()
    await testStats()
    await testUnauthorized()
    await cleanup()

    console.log(`\n${colors.green}========================================${colors.reset}`)
    console.log(`${colors.green}  测试完成${colors.reset}`)
    console.log(`${colors.green}========================================${colors.reset}`)
  } catch (err) {
    console.error(`\n${colors.red}测试出错:${colors.reset}`, err.message)
  }
}

main()
