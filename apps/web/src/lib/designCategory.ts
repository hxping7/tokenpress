// 设计师作品分类标签本地化。
// 分类名是数据驱动的（来自文章 meta.category），无法穷举，故以 meta.category 原值作为 i18n key，
// 在 locales 中维护 designWorks.categories 映射；找不到翻译时回退到原分类名，避免显示成 key 路径。
import { t } from './i18n'

export function designCategoryLabel(cat: string | null | undefined, locale: string): string {
  if (!cat) return ''
  const key = `designWorks.categories.${cat}`
  const v = t(key, locale)
  return v === key ? cat : v
}
