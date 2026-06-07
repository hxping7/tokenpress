import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Running login protection migration...')

  // 创建登录日志表
  const statements = [
    `CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      username TEXT,
      success INTEGER NOT NULL,
      reason TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS login_protect (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL UNIQUE,
      fail_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      captcha_required INTEGER NOT NULL DEFAULT 0,
      last_fail_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_login_logs_ip ON login_logs(ip_address)`,
    `CREATE INDEX IF NOT EXISTS idx_login_protect_ip ON login_protect(ip_address)`,
  ]

  for (const stmt of statements) {
    await client.execute(stmt)
  }

  console.log('✅ Login protection tables created successfully')
}