import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema.js'
import { getDbPath } from './config.js'

const DB_PATH = getDbPath()

export const client = createClient({
  url: `file:${DB_PATH}`,
})

export const db = drizzle(client, { schema })

export default db
