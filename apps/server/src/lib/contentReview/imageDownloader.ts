import net from 'node:net'
import tls from 'node:tls'
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

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(regex => regex.test(ip))
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
  const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80)
  const isHttps = url.protocol === 'https:'

  // Resolve DNS and verify IP is not private
  let resolvedIp: string
  try {
    const dns = await import('node:dns/promises')
    const result = await dns.lookup(hostname)
    resolvedIp = result.address
    if (isPrivateIp(resolvedIp)) {
      logger.warn({ imageUrl, ip: resolvedIp }, 'SSRF attempt blocked: private IP')
      return { success: false, error: 'URL resolves to private IP address' }
    }
  } catch {
    return { success: false, error: 'DNS resolution failed' }
  }

  // Connect directly to the resolved IP to prevent DNS rebinding (TOCTOU)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT)

    const socket = net.connect({ host: resolvedIp, port })

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('error', reject)
    })

    // Verify the connected peer IP again (for edge cases with multi-homed hosts)
    const remoteAddress = socket.remoteAddress
    if (remoteAddress) {
      const remoteIp = remoteAddress.replace(/^::ffff:/, '')
      if (isPrivateIp(remoteIp)) {
        socket.destroy()
        clearTimeout(timeout)
        logger.warn({ imageUrl, remoteIp }, 'SSRF attempt blocked: connected to private IP')
        return { success: false, error: 'Connected to private IP address' }
      }
    }

    let tlsSocket: tls.TLSSocket | null = null
    if (isHttps) {
      tlsSocket = tls.connect({
        socket,
        servername: hostname,
        rejectUnauthorized: true,
      })
      await new Promise<void>((resolve, reject) => {
        tlsSocket!.once('secureConnect', resolve)
        tlsSocket!.once('error', reject)
      })
    }

    const activeSocket = tlsSocket || socket

    // Send HTTP request
    const requestPath = url.pathname + url.search
    const requestLine = `GET ${requestPath} HTTP/1.1\r\n`
    const headers = [
      `Host: ${hostname}`,
      'User-Agent: Token00-ContentReview/1.0',
      'Connection: close',
      'Accept: image/*',
    ].join('\r\n')
    const request = `${requestLine}${headers}\r\n\r\n`

    activeSocket.write(request)

    // Read response
    const chunks: Buffer[] = []
    let totalSize = 0
    let headersParsed = false
    let statusCode = 0
    let contentType = ''
    let bodyStart = 0

    await new Promise<void>((resolve, reject) => {
      const onData = (data: Buffer) => {
        if (controller.signal.aborted) return

        if (!headersParsed) {
          chunks.push(data)
          const combined = Buffer.concat(chunks)
          const headerEnd = combined.indexOf('\r\n\r\n')

          if (headerEnd !== -1) {
            headersParsed = true
            const headerStr = combined.slice(0, headerEnd).toString('utf8')
            const statusMatch = headerStr.match(/^HTTP\/\d\.\d\s+(\d+)/)
            statusCode = statusMatch ? parseInt(statusMatch[1]) : 0

            const ctMatch = headerStr.match(/content-type:\s*([^\r\n]+)/i)
            contentType = ctMatch ? ctMatch[1].trim() : ''

            bodyStart = headerEnd + 4
            const bodyData = combined.slice(bodyStart)
            totalSize += bodyData.length

            if (statusCode !== 200) {
              activeSocket.destroy()
              clearTimeout(timeout)
              resolve()
              return
            }

            if (!contentType.startsWith('image/')) {
              activeSocket.destroy()
              clearTimeout(timeout)
              resolve()
              return
            }

            if (bodyData.length > MAX_IMAGE_SIZE) {
              activeSocket.destroy()
              clearTimeout(timeout)
              resolve()
              return
            }

            // Replace chunks with just body data
            chunks.length = 0
            chunks.push(bodyData)
          }
        } else {
          totalSize += data.length
          if (totalSize > MAX_IMAGE_SIZE) {
            activeSocket.destroy()
            clearTimeout(timeout)
            resolve()
            return
          }
          chunks.push(data)
        }
      }

      activeSocket.on('data', onData)
      activeSocket.once('end', () => {
        clearTimeout(timeout)
        resolve()
      })
      activeSocket.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    clearTimeout(timeout)

    if (!headersParsed) {
      return { success: false, error: 'No HTTP response received' }
    }

    if (statusCode !== 200) {
      return { success: false, error: `HTTP ${statusCode}` }
    }

    if (!contentType.startsWith('image/')) {
      return { success: false, error: `Not an image: ${contentType}` }
    }

    const buffer = Buffer.concat(chunks)
    if (buffer.length > MAX_IMAGE_SIZE) {
      return { success: false, error: `Image too large: ${buffer.length} bytes` }
    }

    return { success: true, buffer, mimeType: contentType }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Download timeout' }
    }
    return { success: false, error: err.message }
  }
}
