import zh from '@/locales/zh.json'
import en from '@/locales/en.json'

type DeepRecord = { [key: string]: string | DeepRecord }

const translations: Record<string, DeepRecord> = { zh, en }

function getNestedValue(obj: DeepRecord, path: string): string {
  const keys = path.split('.')
  let current: string | DeepRecord = obj
  for (const key of keys) {
    if (typeof current === 'object' && current !== null && key in current) {
      current = current[key] as string | DeepRecord
    } else {
      return path
    }
  }
  return typeof current === 'string' ? current : path
}

export function t(key: string, locale: string = 'zh', ...args: string[]): string {
  const dict = translations[locale] || translations['zh']
  let text = getNestedValue(dict, key)
  if (args.length > 0) {
    args.forEach((arg, i) => {
      text = text.replace(`%s`, arg).replace(`%${i + 1}`, arg)
    })
  }
  return text
}

export { zh, en }
