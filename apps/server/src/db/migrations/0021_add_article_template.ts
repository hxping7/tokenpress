import { createClient, type Client } from '@libsql/client'
import { getDbPath } from '../config.js'

/**
 * 0021: 给 articles 表新增文章级模板字段。
 *
 * 板块/分类模板控制"列表页"渲染形态；文章级模板控制"单篇详情页"渲染形态，
 * 与列表页模板正交。优先级：article.template > category.template > section.template（仅详情页生效）。
 *   - article_template TEXT NOT NULL DEFAULT 'standard'  —— 7 种文章模板 key
 *   - template_config  TEXT                              —— 模板专属配置 JSON（如 videoUrl / gallery / events）
 */
export async function migrate() {
  const DB_PATH = getDbPath()
  const client: Client = createClient({ url: `file:${DB_PATH}` })

  console.log('🔄 Running migration 0021: add article template columns...')

  try {
    const info = await client.execute(`PRAGMA table_info(articles)`)
    const cols = (info.rows as any[]).map((c: any) => c.name)

    if (!cols.includes('article_template')) {
      await client.execute(
        `ALTER TABLE articles ADD COLUMN article_template TEXT NOT NULL DEFAULT 'standard'`
      )
      console.log('  ✅ Added articles.article_template column')
    } else {
      console.log('  ⏭️  articles.article_template already exists, skipping')
    }

    if (!cols.includes('template_config')) {
      await client.execute(`ALTER TABLE articles ADD COLUMN template_config TEXT`)
      console.log('  ✅ Added articles.template_config column')
    } else {
      console.log('  ⏭️  articles.template_config already exists, skipping')
    }

    console.log('✅ 0021 migration completed')
  } finally {
    client.close()
  }
}
