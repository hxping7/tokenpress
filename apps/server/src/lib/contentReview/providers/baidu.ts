import type { ProviderConfig, ProviderResult } from '../types.js'
import logger from '../../../utils/logger.js'

const BAIDU_AUTH_URL = 'https://aip.baidubce.com/oauth/2.0/token'
const BAIDU_TEXT_URL = 'https://aip.baidubce.com/rest/2.0/solution/v1/text_censor/v2/user_defined'
const BAIDU_IMAGE_URL = 'https://aip.baidubce.com/rest/2.0/solution/v1/img_censor/v2/user_defined'

let cachedToken: { accessToken: string; expireAt: number } | null = null

async function getAccessToken(config: ProviderConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expireAt) {
    return cachedToken.accessToken
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.baidu.apiKey,
    client_secret: config.baidu.secretKey,
  })

  const res = await fetch(`${BAIDU_AUTH_URL}?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`Baidu auth failed: HTTP ${res.status}`)
  }

  const data = await res.json() as any
  if (data.error_code) {
    throw new Error(`Baidu auth error ${data.error_code}: ${data.error_msg}`)
  }

  const expiresIn = data.expires_in || 2592000 // default 30 days
  cachedToken = {
    accessToken: data.access_token,
    expireAt: Date.now() + (expiresIn - 300) * 1000, // refresh 5min early
  }
  return cachedToken.accessToken
}

export async function reviewText(text: string, config: ProviderConfig): Promise<ProviderResult> {
  if (!config.baidu.apiKey || !config.baidu.secretKey) {
    logger.warn('Baidu credentials not configured, skipping text review')
    return { verdict: 'pass', label: 'not_configured', score: 0, detail: null }
  }

  try {
    const token = await getAccessToken(config)
    const params = new URLSearchParams({ text })
    const url = `${BAIDU_TEXT_URL}?access_token=${token}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    })

    const result = await res.json() as any

    if (result.error_code) {
      logger.error({ code: result.error_code, msg: result.error_msg }, 'Baidu text review API error')
      return { verdict: 'error', label: 'error', score: 0, detail: { error: `${result.error_msg} (${result.error_code})` } }
    }

    return mapConclusion(result.conclusion, result.conclusionType, result.data ?? null)
  } catch (err: any) {
    logger.error({ err }, 'Baidu text review error')
    return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
  }
}

export async function reviewImage(image: Buffer | string, config: ProviderConfig): Promise<ProviderResult> {
  if (!config.baidu.apiKey || !config.baidu.secretKey) {
    logger.warn('Baidu credentials not configured, skipping image review')
    return { verdict: 'pass', label: 'not_configured', score: 0, detail: null }
  }

  try {
    const token = await getAccessToken(config)
    const url = `${BAIDU_IMAGE_URL}?access_token=${token}`

    let params: URLSearchParams
    if (typeof image === 'string') {
      params = new URLSearchParams({ imgUrl: image })
    } else {
      params = new URLSearchParams({ image: image.toString('base64') })
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    })

    const result = await res.json() as any

    if (result.error_code) {
      logger.error({ code: result.error_code, msg: result.error_msg }, 'Baidu image review API error')
      return { verdict: 'error', label: 'error', score: 0, detail: { error: `${result.error_msg} (${result.error_code})` } }
    }

    return mapConclusion(result.conclusion, result.conclusionType, result.data ?? null)
  } catch (err: any) {
    logger.error({ err }, 'Baidu image review error')
    return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
  }
}

export async function healthCheck(config: ProviderConfig): Promise<boolean> {
  try {
    const result = await reviewText('health check test', config)
    return result.verdict !== 'error' && result.verdict !== 'pass' || result.label === 'not_configured'
  } catch {
    return false
  }
}

function mapConclusion(conclusion: string, conclusionType: number, detail: any): ProviderResult {
  switch (conclusionType) {
    case 1: // 合规
      return { verdict: 'pass', label: 'normal', score: 0, detail }
    case 2: // 不合规
      return { verdict: 'reject', label: extractTopLabel(detail), score: extractMaxScore(detail), detail }
    case 3: // 疑似
      return { verdict: 'pending', label: extractTopLabel(detail), score: extractMaxScore(detail), detail }
    case 4: // 审核失败
      return { verdict: 'error', label: 'error', score: 0, detail: { error: 'review_failed' } }
    default:
      // fallback by conclusion string
      if (conclusion === '合规') return { verdict: 'pass', label: 'normal', score: 0, detail }
      if (conclusion === '疑似') return { verdict: 'pending', label: 'suspicious', score: 50, detail }
      return { verdict: 'reject', label: 'violation', score: 80, detail }
  }
}

function extractTopLabel(data: any): string {
  if (!Array.isArray(data)) return 'violation'
  for (const item of data) {
    if (item.conclusionType === 2 || item.conclusionType === 3) {
      return item.msg || `type_${item.type}`
    }
  }
  return 'violation'
}

function extractMaxScore(data: any): number {
  if (!Array.isArray(data)) return 80
  let maxScore = 0
  for (const item of data) {
    if ((item.probability ?? 0) > maxScore) {
      maxScore = Math.round((item.probability ?? 0) * 100)
    }
  }
  return maxScore || 80
}
