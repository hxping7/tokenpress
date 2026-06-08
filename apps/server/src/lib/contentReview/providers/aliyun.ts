import crypto from 'node:crypto'
import type { ProviderConfig, ProviderResult } from '../types.js'
import logger from '../../../utils/logger.js'

const ALIYUN_API_VERSION = '2022-03-02'

function getEndpoint(region: string): string {
  return `green-cip.${region}.aliyuncs.com`
}

function sign(accessKeySecret: string, stringToSign: string): string {
  return crypto.createHmac('sha256', accessKeySecret).update(stringToSign).digest('hex')
}

async function callAliyunApi(
  action: string,
  payload: Record<string, any>,
  config: ProviderConfig,
): Promise<any> {
  const accessKeyId = config.aliyun.accessKeyId
  const accessKeySecret = config.aliyun.accessKeySecret
  const region = config.aliyun.region

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('Aliyun credentials not configured')
  }

  const endpoint = getEndpoint(region)
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const nonce = crypto.randomBytes(16).toString('hex')

  const body = JSON.stringify(payload)

  // Aliyun Green API (POP style) — build signed request
  const params: Record<string, string> = {
    Action: action,
    Version: ALIYUN_API_VERSION,
    Format: 'JSON',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA256',
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    Timestamp: timestamp,
    ...Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
    ),
  }

  // Sort parameters by key (Aliyun requirement)
  const sortedKeys = Object.keys(params).sort()
  const canonicalizedQuery = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]!)}`).join('&')

  const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(canonicalizedQuery)}`
  const signature = sign(accessKeySecret + '&', stringToSign)

  params.Signature = signature

  const formData = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    formData.append(k, v)
  }

  const response = await fetch(`https://${endpoint}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host': endpoint,
      'Accept': 'application/json',
    },
    body: formData.toString(),
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`Aliyun API HTTP ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

export async function reviewText(text: string, config: ProviderConfig): Promise<ProviderResult> {
  if (!config.aliyun.accessKeyId || !config.aliyun.accessKeySecret) {
    logger.warn('Aliyun credentials not configured, skipping text review')
    return { verdict: 'pass', label: 'not_configured', score: 0, detail: null }
  }

  // Truncate to 2000 chars (API limit)
  const content = text.length > 2000 ? text.slice(0, 2000) : text

  try {
    const result = await callAliyunApi('TextModerationPlus', {
      Service: 'ugc_moderation_byllm_pro',
      ServiceParameters: JSON.stringify({ content }),
    }, config)

    const code = result?.Code ?? result?.code
    if (code !== 200) {
      logger.error({ code, message: result?.Message ?? result?.message }, 'Aliyun text review failed')
      return { verdict: 'error', label: 'error', score: 0, detail: { error: result?.Message ?? result?.message ?? `Code ${code}` } }
    }

    const data = result?.Data ?? result?.data
    const riskLevel = data?.RiskLevel?.toLowerCase() ?? 'none'
    const results = data?.Result ?? []
    const topResult = results[0]

    let maxConfidence = 0
    let topLabel = 'normal'
    if (Array.isArray(results)) {
      for (const r of results) {
        if ((r.Confidence ?? r.confidence ?? 0) > maxConfidence) {
          maxConfidence = r.Confidence ?? r.confidence
          topLabel = r.Label ?? r.label ?? 'normal'
        }
      }
    }

    return mapResult(riskLevel, topLabel, maxConfidence, data)
  } catch (err: any) {
    logger.error({ err }, 'Aliyun text review error')
    return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
  }
}

export async function reviewImage(image: Buffer | string, config: ProviderConfig): Promise<ProviderResult> {
  if (!config.aliyun.accessKeyId || !config.aliyun.accessKeySecret) {
    logger.warn('Aliyun credentials not configured, skipping image review')
    return { verdict: 'pass', label: 'not_configured', score: 0, detail: null }
  }

  try {
    let serviceParams: any = {}

    if (typeof image === 'string') {
      serviceParams.imageUrl = image
    } else {
      // Base64 encode local buffer
      serviceParams.imageUrl = `data:image/jpeg;base64,${image.toString('base64')}`
    }

    serviceParams.dataId = `img_${Date.now()}`
    serviceParams.infoType = 'customImage,textInImage'

    const result = await callAliyunApi('ImageModeration', {
      Service: 'baselineCheck',
      ServiceParameters: JSON.stringify(serviceParams),
    }, config)

    const code = result?.Code ?? result?.code
    if (code !== 200) {
      logger.error({ code, message: result?.Message ?? result?.message }, 'Aliyun image review failed')
      return { verdict: 'error', label: 'error', score: 0, detail: { error: result?.Message ?? result?.message ?? `Code ${code}` } }
    }

    const data = result?.Data ?? result?.data
    const riskLevel = data?.RiskLevel?.toLowerCase() ?? 'none'
    const results = data?.Result ?? []

    let maxConfidence = 0
    let topLabel = 'normal'
    if (Array.isArray(results)) {
      for (const r of results) {
        if ((r.Confidence ?? r.confidence ?? 0) > maxConfidence) {
          maxConfidence = r.Confidence ?? r.confidence
          topLabel = r.Label ?? r.label ?? 'normal'
        }
      }
    }

    return mapResult(riskLevel, topLabel, maxConfidence, data)
  } catch (err: any) {
    logger.error({ err }, 'Aliyun image review error')
    return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
  }
}

export async function healthCheck(config: ProviderConfig): Promise<boolean> {
  try {
    const result = await reviewText('health check test', config)
    return result.verdict !== 'error' && result.label !== 'not_configured'
  } catch {
    return false
  }
}

function mapResult(riskLevel: string, label: string, confidence: number, detail: any): ProviderResult {
  const normalizedScore = Math.min(100, Math.max(0, confidence))
  let verdict: ProviderResult['verdict']

  switch (riskLevel) {
    case 'high':
      verdict = 'reject'
      break
    case 'medium':
      verdict = 'pending'
      break
    case 'low':
    case 'none':
    default:
      verdict = 'pass'
      break
  }

  return { verdict, label, score: normalizedScore, detail: detail || null }
}
