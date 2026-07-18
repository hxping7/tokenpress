/**
 * 文章模板工具函数：从 Markdown 提取图片、构建视频嵌入。
 */

/** 从 Markdown 文本中提取所有图片 URL（![alt](url)） */
export function extractMarkdownImages(content: string): string[] {
  if (!content) return []
  const re = /!\[[^\]]*\]\(([^)\s]+)\)/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const url = m[1].trim()
    if (url && !out.includes(url)) out.push(url)
  }
  return out
}

export interface VideoEmbed {
  kind: 'iframe' | 'file' | 'unknown'
  src: string
}

/**
 * 根据视频 URL 与来源生成嵌入信息。
 * 支持：B站(bilibili.com/BV)、YouTube(youtu.be/youtube.com/watch)、本地 mp4/webm。
 */
export function buildVideoEmbed(url: string, source?: string): VideoEmbed {
  if (!url) return { kind: 'unknown', src: '' }
  const u = url.trim()

  // 本地视频文件
  if (/\.(mp4|webm|ogg)$/i.test(u) || source === 'file') {
    return { kind: 'file', src: u }
  }

  // B站
  const biliMatch = u.match(/(?:bilibili\.com\/video\/|player\.bilibili\.com\/player\.html\?.*?bvid=)([A-Za-z0-9]+)/)
  if (biliMatch) {
    return { kind: 'iframe', src: `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&autoplay=0` }
  }
  const b23Match = u.match(/b23\.tv\/([A-Za-z0-9]+)/)
  if (b23Match) {
    return { kind: 'iframe', src: `https://player.bilibili.com/player.html?bvid=${b23Match[1]}&autoplay=0` }
  }

  // YouTube
  const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]+)/)
  if (ytMatch) {
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}` }
  }

  // 通用 iframe（其他平台）
  if (/^https?:\/\//.test(u)) {
    return { kind: 'iframe', src: u }
  }

  return { kind: 'unknown', src: u }
}
