import path from 'node:path'
import fs from 'node:fs'

export function getDbPath(): string {
  const isTest = process.env.NODE_ENV === 'test'
  const DATA_DIR = path.resolve(process.cwd(), isTest ? 'data-test' : 'data')

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  if (isTest && process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH
  }

  return path.join(DATA_DIR, 'token00.db')
}