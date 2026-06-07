import type { TargetType } from './types.js'

export function extractImages(targetType: TargetType, data: Record<string, any>): string[] {
  const urls: string[] = []

  switch (targetType) {
    case 'article': {
      if (data.coverImage) urls.push(data.coverImage)
      const contentImages = extractImgUrlsFromHtml(data.content || '')
      urls.push(...contentImages)
      break
    }
    case 'ad': {
      const adImages = extractImgUrlsFromHtml(data.code || '')
      urls.push(...adImages)
      break
    }
    case 'media': {
      if (data.url) urls.push(data.url)
      if (data.thumbnailUrl) urls.push(data.thumbnailUrl)
      break
    }
    case 'friend_link':
    case 'site_setting':
      break
  }

  return [...new Set(urls)].filter(isValidImageUrl)
}

function extractImgUrlsFromHtml(html: string): string[] {
  const urls: string[] = []
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1])
  }
  return urls
}

function isValidImageUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('data:')) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
