// 安全属性单元测试：风格包 id 校验、文件名清洗、MIME 白名单、SSRF 防护。
// 纯逻辑层，不依赖 HTTP 与数据库，跑得快、失败定位准。
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { validateId } from './stylePack.js'
import { sanitizeFilename, isAllowedMimeType } from '@tokenpress/shared'
import { downloadImageForReview } from './contentReview/imageDownloader.js'
import { UPLOAD_LIMITS } from '@tokenpress/shared'

describe('validateId：风格包 id 白名单', () => {
  it('接受小写字母、数字、连字符', () => {
    expect(validateId('blog').ok).toBe(true)
    expect(validateId('design-v2').ok).toBe(true)
    expect(validateId('pack-01').ok).toBe(true)
  })

  it('拒绝路径穿越与大写', () => {
    for (const bad of ['../blog', '..', '.', 'BLOG', 'bl og', 'a/b', '', 'bl\0g', 'blog.json']) {
      expect(validateId(bad).ok).toBe(false)
    }
  })
})

describe('sanitizeFilename：上传文件名清洗', () => {
  // 真正的安全属性是「join 之后仍落在上传目录内」，而不是「字符串里没有斜杠」。
  // 已知瑕疵 SEC-04：扩展名部分未清洗，可产生 'name./sub/dir' 这类文件名（会在
  // uploads 下建出怪异子目录、子目录不存在时写入失败），但 '..' 已被替换为 '_'，
  // 无法向上穿越。
  it('清洗后与上传目录 join 不得逃出基目录', () => {
    const base = path.resolve(process.cwd(), 'data-test/uploads')
    const payloads = [
      '../../../../etc/passwd',
      'a....//....//....//evil',
      'evil.' + '../'.repeat(6) + 'tmp-pwned',
      'x.../../../../../../Windows/System32/pwn',
      'a.b.c../../../../evil',
      '..\\..\\..\\evil.png',
    ]
    for (const p of payloads) {
      const resolved = path.resolve(path.join(base, sanitizeFilename(p)))
      expect(resolved.startsWith(base), `${p} -> ${resolved}`).toBe(true)
    }
  })

  it('剥离 Windows 反斜杠与引号', () => {
    const out = sanitizeFilename('..\\..\\evil";rm -rf /.png')
    expect(out).not.toContain('\\')
    expect(out).not.toContain('"')
    expect(out).not.toContain(';')
  })

  it('保留扩展名并追加随机后缀（避免同名覆盖）', () => {
    const a = sanitizeFilename('photo.png')
    const b = sanitizeFilename('photo.png')
    expect(a.endsWith('.png')).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('isAllowedMimeType：MIME 白名单', () => {
  it('接受白名单内的类型', () => {
    expect(isAllowedMimeType('image/png', UPLOAD_LIMITS.allowedImageTypes)).toBe(true)
  })

  it('拒绝危险类型与大小写变体绕过', () => {
    const allowed = UPLOAD_LIMITS.allowedImageTypes
    for (const bad of ['text/html', 'application/x-msdownload', 'image/svg', 'IMAGE/PNG', 'image/png;x=1']) {
      expect(isAllowedMimeType(bad, allowed)).toBe(false)
    }
  })
})

describe('downloadImageForReview：SSRF 防护', () => {
  it('拒绝非 http(s) 协议', async () => {
    for (const u of ['file:///etc/passwd', 'gopher://127.0.0.1:6379/_INFO', 'data:image/png;base64,AAAA']) {
      const r = await downloadImageForReview(u)
      expect(r.success).toBe(false)
    }
  })

  it('拒绝解析到私有网段的地址（云元数据 / 内网）', async () => {
    const r = await downloadImageForReview('http://169.254.169.254/latest/meta-data/')
    expect(r.success).toBe(false)
    expect(r.error).toContain('private IP')
  })

  it('拒绝 127.0.0.1 环回地址', async () => {
    const r = await downloadImageForReview('http://127.0.0.1:4001/api/v1/health')
    expect(r.success).toBe(false)
    expect(r.error).toContain('private IP')
  })

  it('[SEC-02] 拒绝 IPv6 环回地址 ::1', async () => {
    const r = await downloadImageForReview('http://[::1]:4001/x.png')
    expect(r.success).toBe(false)
    expect(r.error).toContain('private IP')
  })

  it('[SEC-02] 拒绝 IPv6 唯一本地与链路本地地址', async () => {
    for (const u of ['http://[fd00::1]/x.png', 'http://[fc00::1]/x.png', 'http://[fe80::1]/x.png']) {
      const r = await downloadImageForReview(u)
      expect(r.success, `${u} 未被拦截`).toBe(false)
      expect(r.error, `${u} 未被拦截`).toContain('private IP')
    }
  })

  it('拒绝 IPv4-mapped IPv6 内网地址', async () => {
    const r = await downloadImageForReview('http://[::ffff:127.0.0.1]:4001/x.png')
    expect(r.success).toBe(false)
    expect(r.error).toContain('private IP')
  })
})
