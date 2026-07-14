/**
 * 板块 / 分类 渲染模板白名单
 *
 * template 字段决定板块/分类的内容渲染形态：
 * - 文章流类（数据源为文章）：article-list / article-grid / article-masonry / magazine
 * - 特殊类（数据源非文章）：single-page / link-wall / design-gallery
 *
 * 前端 TemplateRegistry（apps/web/src/lib/templates.ts）与本列表需保持一致。
 */

export const VALID_TEMPLATES = [
  'article-list',
  'article-grid',
  'article-masonry',
  'magazine',
  'single-page',
  'link-wall',
  'design-gallery',
] as const

export type SectionTemplate = (typeof VALID_TEMPLATES)[number]

export function isTemplateValid(v: unknown): v is SectionTemplate {
  return typeof v === 'string' && (VALID_TEMPLATES as readonly string[]).includes(v)
}
