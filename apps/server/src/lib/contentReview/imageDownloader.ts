import net from 'node:net'
import tls from 'node:tls'
import logger from '../../utils/logger.js'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const DOWNLOAD_TIMEOUT = 10_000

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
]

// SEC-02：IPv6 侧的等价内网范围，旧实现只覆盖 IPv4，`http://[::1]:4001/` 可以直连本机
const PRIVATE_IPV6_RANGES = [
  /^::1$/, // 环回
  /^::$/, // 未指定地址
  /^f[cd][0-9a-f]{2}:/, // fc00::/7 唯一本地地址
  /^fe[89ab][0-9a-f]:/, // fe80::/10 链路本地
]

const ALLOWED_PROTOCOLS = ['https:', 'http:']

export interface DownloadResult {
  success: boolean
  buffer?: Buffer
  mimeType?: string
  error?: string
}

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_RANGES.some(regex => regex.test(ip))
}

// 内嵌 IPv4 的 IPv6 写法有两种：点分（::ffff:127.0.0.1）与 16 进制双组
// （URL 规范化后 ::ffff:127.0.0.1 会变成 ::ffff:7f00:1）。两种都要换算回 v4 判定，
// 否则 `http://[::ffff:127.0.0.1]/` 会被当成普通 IPv6 放行。
function embeddedIpv4(v6: string): string | null {
  const dotted = v6.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return dotted[1]

  const hex = v6.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!hex) return null
  const hi = parseInt(hex[1], 16)
  const lo = parseInt(hex[2], 16)
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.')
}

export function isPrivateIp(ip: string): boolean {
  if (!ip) return false

  // URL.hostname 对 IPv6 字面量保留方括号（'[::1]'），先剥离再判定
  const raw = ip.trim().replace(/^\[|\]$/g, '')

  if (net.isIPv4(raw)) return isPrivateIpv4(raw)

  const v6 = raw.toLowerCase()
  if (v6 === '::1' || v6 === '::') return true
  if (PRIVATE_IPV6_RANGES.some(regex => regex.test(v6))) return true

  // IPv4-mapped（::ffff:127.0.0.1）与 IPv4 兼容（::127.0.0.1）都按其内嵌 v4 判定
  const embedded = embeddedIpv4(v6)
  if (embedded) return isPrivateIpv4(embedded)

  // ::ffff:0:0/96 之外的内嵌 v4 写法（如 64:ff9b::10.0.0.1 这类过渡地址）一律拒绝
  return /:\d+\.\d+\.\d+\.\d+$/.test(v6)
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
  // IPv6 字面量的 hostname 带方括号（'[::1]'），直接丢给 dns.lookup 会解析失败，
  // 把「内网地址」降级成「DNS 解析失败」——拦截仍然成立，但语义错误且掩盖了真实原因。
  if (net.isIP(hostname.replace(/^\[|\]$/g, ''))) {
    resolvedIp = hostname.replace(/^\[|\]$/g, '')
    if (isPrivateIp(resolvedIp)) {
      logger.warn({ imageUrl, ip: resolvedIp }, 'SSRF attempt blocked: private IP')
      return { success: false, error: 'URL resolves to private IP address' }
    }
  } else {
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
