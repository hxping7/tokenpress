import type { TargetType } from './types.js'

export function extractText(targetType: TargetType, data: Record<string, any>): string {
  switch (targetType) {
    case 'article': {
      const title = data.title || ''
      const content = stripMarkdown(data.content || '')
      return `${title} ${content}`.trim()
    }
    case 'ad': {
      const title = data.title || ''
      const code = stripHtml(data.code || '')
      return `${title} ${code}`.trim()
    }
    case 'friend_link': {
      const name = data.name || ''
      const description = data.description || ''
      return `${name} ${description}`.trim()
    }
    case 'site_setting': {
      const value = data.value || ''
      return value
    }
    case 'media':
      return ''
    default:
      return ''
  }
}

function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}
