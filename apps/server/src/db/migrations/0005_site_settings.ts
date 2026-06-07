import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking site_settings migration...')

  // Check if site_settings table exists
  const tablesResult = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='site_settings'`
  )

  if (tablesResult.rows.length === 0) {
    console.log('🔄 Creating site_settings table...')

    await client.execute(`
      CREATE TABLE site_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Insert default settings
    const defaultSettings = [
      { key: 'site_name', value: 'Token∞' },
      { key: 'site_description', value: 'Token 力量无限放大 | AI 赋能综合内容平台' },
      { key: 'header_logo', value: '' },
      { key: 'footer_logo', value: '' },
      { key: 'footer_nav', value: JSON.stringify([
        { name: 'Token 计划', url: '/token-plan' },
        { name: 'AI 编程', url: '/ai-coding' },
        { name: 'AI 作品', url: '/ai-works' },
        { name: '博客', url: '/blog' },
      ]) },
      { key: 'friend_links_columns', value: '2' },
      { key: 'copyright_text', value: '© 2026 Token00. All rights reserved.' },
      { key: 'icp_number', value: '' },
    ]

    for (const setting of defaultSettings) {
      await client.execute({
        sql: `INSERT INTO site_settings (key, value) VALUES (?, ?)`,
        args: [setting.key, setting.value]
      })
    }

    console.log('✅ site_settings table created with default data')
  } else {
    console.log('✅ site_settings table already exists')
  }

  // Add description column to friend_links if not exists
  const columnsResult = await client.execute(`PRAGMA table_info(friend_links)`)
  const hasDescription = columnsResult.rows.some((row: any) => row.name === 'description')

  if (!hasDescription) {
    console.log('🔄 Adding description column to friend_links table...')
    await client.execute(`ALTER TABLE friend_links ADD COLUMN description TEXT`)
    console.log('✅ description column added')
  }
}