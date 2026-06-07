import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking audit logs migration...')

  const auditExists = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'`
  )
  const eventsExists = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='system_events'`
  )

  if (auditExists.rows.length > 0 && eventsExists.rows.length > 0) {
    console.log('✅ Audit logs tables already exist')
    return
  }

  if (auditExists.rows.length === 0) {
    console.log('🔄 Creating audit_logs table...')

    await client.execute(`
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operator_id INTEGER NOT NULL,
        operator_name TEXT NOT NULL,
        operator_role TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id INTEGER,
        detail TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await client.execute(`CREATE INDEX idx_audit_logs_operator ON audit_logs (operator_id)`)
    await client.execute(`CREATE INDEX idx_audit_logs_action ON audit_logs (action)`)
    await client.execute(`CREATE INDEX idx_audit_logs_target ON audit_logs (target_type, target_id)`)
    await client.execute(`CREATE INDEX idx_audit_logs_created ON audit_logs (created_at)`)

    console.log('✅ audit_logs table created')
  }

  if (eventsExists.rows.length === 0) {
    console.log('🔄 Creating system_events table...')

    await client.execute(`
      CREATE TABLE system_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await client.execute(`CREATE INDEX idx_system_events_type ON system_events (event_type)`)
    await client.execute(`CREATE INDEX idx_system_events_created ON system_events (created_at)`)

    console.log('✅ system_events table created')
  }

  console.log('✅ Audit logs migration complete')
}
