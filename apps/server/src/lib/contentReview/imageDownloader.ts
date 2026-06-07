import logger from '../../utils/logger.js'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const DOWNLOAD_TIMEOUT = 10_000

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
]

const ALLOWED_PROTOCOLS = ['https:', 'http:']

export interface DownloadResult {
  success: boolean
  buffer?: Buffer
  mimeType?: string
  error?: string
}

export async function downloadImageForReview(imageUrl: string): Promise<DownloadResult> {
  let url: URL
  try {
    url = new URL(imageUrl)
  } catch {
    return { success: false, error: 'Invalid URL' }
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return { success: false, error: `Disallowed protocol: ${url.protocol}` }
  }

  const hostname = url.hostname
  try {
    const dns = await import('node:dns/promises')
    const result = await dns.lookup(hostname)
    const ip = result.address
    if (PRIVATE_IP_RANGES.some(regex => regex.test(ip))) {
      logger.warn({ imageUrl, ip }, 'SSRF attempt blocked: private IP')
      return { success: false, error: 'URL resolves to private IP address' }
    }
  } catch {
    return { success: false, error: 'DNS resolution failed' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT)

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Token00-ContentReview/1.0' },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return { success: false, error: `Not an image: ${contentType}` }
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0')
    if (contentLength > MAX_IMAGE_SIZE) {
      return { success: false, error: `Image too large: ${contentLength} bytes` }
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { success: false, error: `Image too large after download: ${buffer.length} bytes` }
    }

    return { success: true, buffer, mimeType: contentType }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Download timeout' }
    }
    return { success: false, error: err.message }
  }
}
