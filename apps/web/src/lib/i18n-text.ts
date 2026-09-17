/**
 * 文案多语言解析：风格包与站点设置里的装修文案既可以是单语字符串，
 * 也可以是双语对象 `{ zh, en }`（按当前语言取值）。
 *
 * 内容层（板块名、文章标题与正文）不经过此工具 —— 内容多语言是独立话题。
 */
export type LocalizedText = string | { zh?: string; en?: string } | null | undefined

export function resolveText(value: LocalizedText, locale: string): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return locale === 'en' ? value.en ?? value.zh ?? '' : value.zh ?? value.en ?? ''
  }
  return ''
}
