import { db } from '../../db/index.js'
import { sensitiveKeywords } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import type { ScanResult, TargetType } from './types.js'

export async function scanSensitiveWords(text: string, scope?: TargetType): Promise<ScanResult> {
  if (!text) return { matched: false, keywords: [], severity: null, action: null }

  const conditions = [eq(sensitiveKeywords.enabled, 1)]
  const rows = await db.select()
    .from(sensitiveKeywords)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))

  if (rows.length === 0) {
    return { matched: false, keywords: [], severity: null, action: null }
  }

  const textLower = text.toLowerCase()
  const matched: string[] = []
  let maxSeverity: 'low' | 'medium' | 'high' = 'low'
  let blockFound = false
  let reviewFound = false

  for (const kw of rows) {
    if (kw.scope !== 'all' && scope && kw.scope !== scope) continue
    if (textLower.includes(kw.keyword.toLowerCase())) {
      matched.push(kw.keyword)
      maxSeverity = rankHigher(maxSeverity, kw.severity as 'low' | 'medium' | 'high')
      if (kw.action === 'block') blockFound = true
      if (kw.action === 'review') reviewFound = true
    }
  }

  return {
    matched: matched.length > 0,
    keywords: matched,
    severity: matched.length > 0 ? maxSeverity : null,
    action: blockFound ? 'block' : (reviewFound ? 'review' : null),
  }
}

function rankHigher(current: 'low' | 'medium' | 'high', candidate: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
  const rank = { low: 1, medium: 2, high: 3 }
  return rank[candidate] > rank[current] ? candidate : current
}
