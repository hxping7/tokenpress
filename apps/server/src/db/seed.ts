import bcrypt from 'bcryptjs'
import { db } from './index.js'
import { users, categories, tags, sections } from './schema.js'
import { eq } from 'drizzle-orm'

async function seed() {
  console.log('🌱 Seeding database...')

  // Create default admin: admin / admin123 (CHANGE THIS PASSWORD ON FIRST LOGIN!)
  const passwordHash = await bcrypt.hash('admin123', 10)

  try {
    const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin')).get()
    if (!existingAdmin) {
      await db.insert(users).values({
        username: 'admin',
        passwordHash,
        displayName: 'Admin',
        role: 'superadmin',
      })
      console.log('✅ Default admin created (admin / admin123) - CHANGE YOUR PASSWORD ON FIRST LOGIN!')
    } else {
      console.log('ℹ️  Admin user already exists')
    }

    // Default sections
    const defaultSections = [
      { name: 'Token 计划', slug: 'token_plan', path: '/token-plan', description: 'Token 计划相关内容', sortOrder: 0 },
      { name: 'AI 编程', slug: 'ai_coding', path: '/ai-coding', description: 'AI 编程教程与项目', sortOrder: 1 },
      { name: 'AI 作品', slug: 'ai_works', path: '/ai-works', description: 'AI 生成作品展示', sortOrder: 2 },
      { name: '博客', slug: 'blog', path: '/blog', description: '博客文章', sortOrder: 3 },
    ]

    const sectionIds: Record<string, number> = {}

    for (const section of defaultSections) {
      const exists = await db.select().from(sections).where(eq(sections.slug, section.slug)).get()
      if (!exists) {
        const result = await db.insert(sections).values(section)
        sectionIds[section.slug] = Number(result.lastInsertRowid)
        console.log(`  ✅ Section: ${section.name}`)
      } else {
        sectionIds[section.slug] = exists.id
      }
    }

    // Default categories - now using sectionId
    const cats = [
      { name: '未分类', slug: 'uncategorized', sectionId: sectionIds['blog'], sortOrder: 0 },
      { name: 'AI 教程', slug: 'ai-tutorials', sectionId: sectionIds['ai_coding'], sortOrder: 1 },
      { name: '项目展示', slug: 'project-showcase', sectionId: sectionIds['ai_coding'], sortOrder: 2 },
      { name: '技术解析', slug: 'tech-analysis', sectionId: sectionIds['ai_coding'], sortOrder: 3 },
      { name: 'AI 绘画', slug: 'ai-painting', sectionId: sectionIds['ai_works'], sortOrder: 1 },
      { name: 'AI 视频', slug: 'ai-video', sectionId: sectionIds['ai_works'], sortOrder: 2 },
      { name: '计划公告', slug: 'announcements', sectionId: sectionIds['token_plan'], sortOrder: 1 },
      { name: '进度更新', slug: 'progress-updates', sectionId: sectionIds['token_plan'], sortOrder: 2 },
    ]

    for (const cat of cats) {
      if (!cat.sectionId) continue // Skip if section doesn't exist
      const exists = await db.select().from(categories).where(eq(categories.slug, cat.slug)).get()
      if (!exists) {
        await db.insert(categories).values(cat)
        console.log(`  ✅ Category: ${cat.name}`)
      }
    }

    // Default tags
    for (const tagName of ['AI', '编程', 'Next.js', 'TypeScript', '教程', '作品', 'Token', '全栈']) {
      const exists = await db.select().from(tags).where(eq(tags.name, tagName)).get()
      if (!exists) {
        await db.insert(tags).values({ name: tagName })
      }
    }

    console.log('✅ Seed completed!')
  } catch (err) {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  }

  process.exit(0)
}

seed()
