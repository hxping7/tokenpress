import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({ url: `file:${DB_PATH}` })

  console.log('🔄 Running migration: add template + template_config to sections & categories...')

  try {
    // 1) sections.template / sections.template_config
    const secInfo = await client.execute(`PRAGMA table_info(sections)`)
    const secCols = (secInfo.rows as any[]).map((c: any) => c.name)
    if (!secCols.includes('template')) {
      await client.execute(`ALTER TABLE sections ADD COLUMN template TEXT NOT NULL DEFAULT 'article-list'`)
      console.log('  ✅ Added sections.template column')
    } else {
      console.log('  ⏭️  sections.template already exists, skipping')
    }
    if (!secCols.includes('template_config')) {
      await client.execute(`ALTER TABLE sections ADD COLUMN template_config TEXT`)
      console.log('  ✅ Added sections.template_config column')
    } else {
      console.log('  ⏭️  sections.template_config already exists, skipping')
    }

    // 2) categories.template / categories.template_config
    const catInfo = await client.execute(`PRAGMA table_info(categories)`)
    const catCols = (catInfo.rows as any[]).map((c: any) => c.name)
    if (!catCols.includes('template')) {
      await client.execute(`ALTER TABLE categories ADD COLUMN template TEXT NOT NULL DEFAULT 'article-list'`)
      console.log('  ✅ Added categories.template column')
    } else {
      console.log('  ⏭️  categories.template already exists, skipping')
    }
    if (!catCols.includes('template_config')) {
      await client.execute(`ALTER TABLE categories ADD COLUMN template_config TEXT`)
      console.log('  ✅ Added categories.template_config column')
    } else {
      console.log('  ⏭️  categories.template_config already exists, skipping')
    }

    // 3) 一致性：设计师作品板块默认使用 design-gallery 模板
    await client.execute(
      `UPDATE sections SET template = 'design-gallery' WHERE kind = 'design_works' AND (template IS NULL OR template = '' OR template = 'article-list')`,
    )
    console.log('  ✅ Synced design_works sections to design-gallery template')

    console.log('✅ 0019 migration completed')
  } finally {
    client.close()
  }
}
