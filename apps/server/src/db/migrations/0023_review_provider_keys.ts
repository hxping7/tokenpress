import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking review provider API keys settings...')

  const keys = [
    { key: 'review_tencent_secret_id', value: '' },
    { key: 'review_tencent_secret_key', value: '' },
    { key: 'review_tencent_region', value: 'ap-guangzhou' },
    { key: 'review_aliyun_access_key_id', value: '' },
    { key: 'review_aliyun_access_key_secret', value: '' },
    { key: 'review_aliyun_region', value: 'cn-shanghai' },
    { key: 'review_baidu_app_id', value: '' },
    { key: 'review_baidu_api_key', value: '' },
    { key: 'review_baidu_secret_key', value: '' },
    { key: 'review_builtin_ai_api_url', value: '' },
    { key: 'review_builtin_ai_api_key', value: '' },
  ]

  try {
    for (const item of keys) {
      const result = await client.execute({
        sql: `SELECT value FROM site_settings WHERE key = ?`,
        args: [item.key]
      })

      if (result.rows.length === 0) {
        await client.execute({
          sql: `INSERT INTO site_settings (key, value) VALUES (?, ?)`,
          args: [item.key, item.value]
        })
        console.log(`✅ Added ${item.key} setting`)
      } else {
        console.log(`✅ ${item.key} setting already exists`)
      }
    }
  } catch (err) {
    console.log('❌ Migration failed:', err)
  }
}
