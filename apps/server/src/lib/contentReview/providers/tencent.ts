import crypto from 'node:crypto'
import type { ProviderConfig, ProviderResult } from '../types.js'
import logger from '../../../utils/logger.js'

const TENCENT_TEXT_API = 'tms.tencentcloudapi.com'
const TENCENT_IMAGE_API = 'ims.tencentcloudapi.com'
const SERVICE = 'tms'

export async function reviewText(text: string, config: ProviderConfig): Promise<ProviderResult> {
  if (!config.tencent.secretId || !config.tencent.secretKey) {
    logger.warn('Tencent credentials not configured, skipping text review')
    return { verdict: 'pass', label: 'not_configured', score: 0, detail: null }
  }

  const payload = {
    Content: Buffer.from(text).toString('base64'),
  }

  try {
    const result = await callTencentApi('TextModeration', payload, config, TENCENT_TEXT_API)
    const suggestion = result?.Response?.Suggestion || 'Pass'
    const label = result?.Response?.Label || 'Normal'
    const score = result?.Response?.Score || 0

    return mapResult(suggestion, label, score, result?.Response)
  } catch (err: any) {
    logger.error({ err }, 'Tencent text review error')
    return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
  }
}

export async function reviewImage(image: Buffer | string, config: ProviderConfig): Promise<ProviderResult> {
  if (!config.tencent.secretId || !config.tencent.secretKey) {
    logger.warn('Tencent credentials not configured, skipping image review')
    return { verdict: 'pass', label: 'not_configured', score: 0, detail: null }
  }

  let fileUrl: string | undefined
  let fileContent: string | undefined

  if (typeof image === 'string') {
    fileUrl = image
  } else {
    fileContent = image.toString('base64')
  }

  const payload = fileUrl ? { FileUrl: fileUrl } : { FileContent: fileContent }

  try {
    const result = await callTencentApi('ImageModeration', payload, config, TENCENT_IMAGE_API)
    const suggestion = result?.Response?.Suggestion || 'Pass'
    const label = result?.Response?.Label || 'Normal'
    const score = result?.Response?.Score || 0

    return mapResult(suggestion, label, score, result?.Response)
  } catch (err: any) {
    logger.error({ err }, 'Tencent image review error')
    return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
  }
}

export async function healthCheck(config: ProviderConfig): Promise<boolean> {
  try {
    const result = await reviewText('health check test', config)
    return result.verdict !== 'error'
  } catch {
    return false
  }
}

function mapResult(suggestion: string, label: string, score: number, detail: any): ProviderResult {
  const normalizedScore = Math.min(100, Math.max(0, score))
  let verdict: ProviderResult['verdict']

  switch (suggestion.toLowerCase()) {
    case 'block':
      verdict = 'reject'
      break
    case 'review':
      verdict = 'pending'
      break
    case 'pass':
    default:
      verdict = 'pass'
      break
  }

  return { verdict, label, score: normalizedScore, detail: detail || null }
}

async function callTencentApi(
  action: string,
  payload: Record<string, any>,
  config: ProviderConfig,
  host: string,
): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const date = new Date().toISOString().split('T')[0]
  const nonce = Math.floor(Math.random() * 100000).toString()

  const body = JSON.stringify(payload)

  const signedHeaders = 'content-type;host'
  const hashedPayload = crypto.createHash('sha256').update(body).digest('hex')

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8`,
    `host:${host}`,
    '',
    signedHeaders,
    hashedPayload,
  ].join('\n')

  const credentialScope = `${date}/${SERVICE}/tc3_request`
  const hashedCanonical = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  const stringToSign = [`TC3-HMAC-SHA256`, timestamp, credentialScope, hashedCanonical].join('\n')

  const secretDate = hmacSha256(`TC3${config.tencent.secretKey}`, date)
  const secretService = hmacSha256(secretDate, SERVICE)
  const secretSigning = hmacSha256(secretService, 'tc3_request')
  const signature = hmacSha256Hex(secretSigning, stringToSign)

  const authorization = `TC3-HMAC-SHA256 Credential=${config.tencent.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Version': '2020-12-29',
      'X-TC-Timestamp': timestamp,
      'X-TC-Nonce': nonce,
      'X-TC-Region': config.tencent.region,
      'Authorization': authorization,
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`Tencent API HTTP ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function hmacSha256Hex(key: Buffer, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex')
}
