import { createClient } from '@libsql/client'
import { getDbPath } from '../config.js'

const client = createClient({
  url: `file:${getDbPath()}`,
})

export async function migrate() {
  console.log('🔄 Checking three-level roles migration...')

  const superadminExists = await client.execute(
    `SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`
  )
  if (superadminExists.rows.length > 0) {
    console.log('✅ Three-level roles already applied')
    return
  }

  console.log('🔄 Applying three-level roles migration...')

  // Convert editor → admin
  const editorCount = await client.execute(
    `SELECT COUNT(*) as cnt FROM users WHERE role = 'editor'`
  )
  if (Number(editorCount.rows[0]?.cnt ?? 0) > 0) {
    console.log('🔄 Converting editor users to admin...')
    await client.execute(`UPDATE users SET role = 'admin' WHERE role = 'editor'`)
    console.log('✅ Converted editors to admin')
  }

  // Try direct update first (works if no CHECK constraint)
  let directUpdateOk = false
  try {
    await client.execute(`UPDATE users SET role = 'superadmin' WHERE id = 1`)
    // Verify it actually saved
    const verify = await client.execute(`SELECT role FROM users WHERE id = 1`)
    if (verify.rows[0]?.role === 'superadmin') {
      directUpdateOk = true
      console.log('✅ id=1 user set to superadmin (direct update)')
    }
  } catch (err) {
    console.log('ℹ️  Direct update failed (likely CHECK constraint):', (err as Error).message)
  }

  // If direct update failed (CHECK constraint), rebuild table without CHECK
  if (!directUpdateOk) {
    console.log('🔄 Rebuilding users table to remove CHECK constraint...')

    // Disable foreign keys for table rebuild
    await client.execute(`PRAGMA foreign_keys = OFF`)

    try {
      await client.execute(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          avatar_url TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      await client.execute(`
        INSERT INTO users_new (id, username, password_hash, display_name, role, avatar_url, is_active, created_at, updated_at)
        SELECT id, username, password_hash, display_name, role, avatar_url, is_active, created_at, updated_at
        FROM users
      `)

      // Set superadmin before dropping old table
      await client.execute(`UPDATE users_new SET role = 'superadmin' WHERE id = 1`)

      await client.execute(`DROP TABLE users`)
      await client.execute(`ALTER TABLE users_new RENAME TO users`)

      // Recreate indexes
      await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)`)

      console.log('✅ Users table rebuilt without CHECK constraint')
    } catch (err) {
      console.error('❌ Table rebuild failed:', (err as Error).message)
      throw err
    } finally {
      // Re-enable foreign keys
      await client.execute(`PRAGMA foreign_keys = ON`)
    }
  }

  // Verify
  const verifySuperadmin = await client.execute(
    `SELECT id, username, role FROM users WHERE id = 1`
  )
  if (verifySuperadmin.rows.length > 0) {
    console.log(`✅ Verified: id=1 user role = ${verifySuperadmin.rows[0].role}`)
  }

  console.log('✅ Three-level roles migration complete')
}
