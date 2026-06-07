/**
 * 计算文章阅读时间
 * 中文 ~400字/分钟，英文 ~200词/分钟
 */
export function calculateReadingTime(content: string): number {
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (content.match(/[a-zA-Z]+/g) || []).length
  const minutes = chineseChars / 400 + englishWords / 200
  return Math.max(1, Math.ceil(minutes))
}

/**
 * 格式化阅读时间
 */
export function formatReadingTime(minutes: number, locale: string = 'zh'): string {
  if (locale === 'en') {
    return minutes === 1 ? '1 min read' : `${minutes} min read`
  }
  return `${minutes} 分钟阅读`
}
