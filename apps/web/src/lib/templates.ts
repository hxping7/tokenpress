/**
 * 板块 / 分类 模板注册表（前端）
 *
 * 与后端 apps/server/src/lib/sectionTemplates.ts 的 VALID_TEMPLATES 保持一致。
 *
 * ⚠️ 概念区分（避免与「页面骨架 layouts」混淆）：
 * - 本文件 template = 「内容排版」：决定文章怎么排（列表 / 网格 / 瀑布流 / 杂志头条…）。
 *   每种模板的**具体默认样式**（列数 / 间距 / 卡片样式 / 封面比例）由当前风格包
 *   layouts.json 的 `templates[templateKey]` 提供，用户配置（分类 > 板块）逐字段覆盖。
 * - layouts = 「页面骨架」：决定页面结构（有无侧栏 / hero / 内容区宽度），由风格包
 *   layouts.json 的 section/article/list 提供。两者正交、互不影响。
 */

export type TemplateKey =
  | 'article-list'
  | 'article-grid'
  | 'article-masonry'
  | 'magazine'
  | 'single-page'
  | 'link-wall'
  | 'design-gallery'

export interface TemplateMeta {
  key: TemplateKey
  label: string
  description: string
  family: 'article' | 'special'
  /** 是否支持配置（如列数） */
  hasConfig: boolean
  /** 内联 SVG 预览图（用于后台下拉预览） */
  previewSvg: string
}

const frame = (inner: string) =>
  `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto"><rect width="160" height="100" rx="8" fill="#0f172a"/><rect x="6" y="6" width="148" height="14" rx="3" fill="#1e293b"/>${inner}</svg>`

export const TEMPLATES: TemplateMeta[] = [
  {
    key: 'article-list',
    label: '文章列表（内容排版）',
    description: '经典文章流；列数/间距/卡片样式由风格包默认，可逐字段覆盖',
    family: 'article',
    hasConfig: false,
    previewSvg: frame(
      `<rect x="10" y="28" width="140" height="12" rx="2" fill="#334155"/><rect x="10" y="46" width="140" height="12" rx="2" fill="#334155"/><rect x="10" y="64" width="140" height="12" rx="2" fill="#334155"/><rect x="10" y="82" width="140" height="12" rx="2" fill="#334155"/>`,
    ),
  },
  {
    key: 'article-grid',
    label: '卡片网格（内容排版）',
    description: '统一卡片网格；列数/间距/封面比例由风格包默认，可覆盖',
    family: 'article',
    hasConfig: true,
    previewSvg: frame(
      `<rect x="10" y="28" width="42" height="30" rx="3" fill="#334155"/><rect x="59" y="28" width="42" height="30" rx="3" fill="#334155"/><rect x="108" y="28" width="42" height="30" rx="3" fill="#334155"/><rect x="10" y="64" width="42" height="30" rx="3" fill="#334155"/><rect x="59" y="64" width="42" height="30" rx="3" fill="#334155"/><rect x="108" y="64" width="42" height="30" rx="3" fill="#334155"/>`,
    ),
  },
  {
    key: 'article-masonry',
    label: '瀑布流（内容排版）',
    description: '错落瀑布流；列数/间距由风格包默认，可覆盖',
    family: 'article',
    hasConfig: true,
    previewSvg: frame(
      `<rect x="10" y="28" width="42" height="40" rx="3" fill="#334155"/><rect x="59" y="28" width="42" height="24" rx="3" fill="#334155"/><rect x="108" y="28" width="42" height="34" rx="3" fill="#334155"/><rect x="10" y="72" width="42" height="20" rx="3" fill="#334155"/><rect x="59" y="56" width="42" height="36" rx="3" fill="#334155"/><rect x="108" y="66" width="42" height="26" rx="3" fill="#334155"/>`,
    ),
  },
  {
    key: 'magazine',
    label: '杂志头条（内容排版）',
    description: '大图头条 + 网格；列数/间距由风格包默认，可覆盖',
    family: 'article',
    hasConfig: true,
    previewSvg: frame(
      `<rect x="10" y="28" width="86" height="64" rx="3" fill="#334155"/><rect x="104" y="28" width="46" height="18" rx="2" fill="#475569"/><rect x="104" y="50" width="46" height="18" rx="2" fill="#475569"/><rect x="104" y="72" width="46" height="18" rx="2" fill="#475569"/>`,
    ),
  },
  {
    key: 'single-page',
    label: '单页（内容排版）',
    description: '渲染板块简介为单页，无文章列表',
    family: 'special',
    hasConfig: false,
    previewSvg: frame(
      `<rect x="34" y="30" width="92" height="8" rx="2" fill="#475569"/><rect x="20" y="46" width="120" height="6" rx="2" fill="#334155"/><rect x="20" y="58" width="120" height="6" rx="2" fill="#334155"/><rect x="20" y="70" width="80" height="6" rx="2" fill="#334155"/>`,
    ),
  },
  {
    key: 'link-wall',
    label: '链接墙（内容排版）',
    description: '以卡片墙展示友链 / 外部链接',
    family: 'special',
    hasConfig: false,
    previewSvg: frame(
      `<rect x="10" y="28" width="40" height="20" rx="10" fill="#334155"/><rect x="56" y="28" width="40" height="20" rx="10" fill="#334155"/><rect x="102" y="28" width="40" height="20" rx="10" fill="#334155"/><rect x="10" y="54" width="40" height="20" rx="10" fill="#334155"/><rect x="56" y="54" width="40" height="20" rx="10" fill="#334155"/><rect x="102" y="54" width="40" height="20" rx="10" fill="#334155"/>`,
    ),
  },
  {
    key: 'design-gallery',
    label: '作品集画廊（内容排版）',
    description: '设计师作品集卡片流（需板块类型为作品集）',
    family: 'special',
    hasConfig: false,
    previewSvg: frame(
      `<rect x="10" y="28" width="42" height="40" rx="3" fill="#6366f1"/><rect x="59" y="28" width="42" height="40" rx="3" fill="#8b5cf6"/><rect x="108" y="28" width="42" height="40" rx="3" fill="#ec4899"/><rect x="10" y="72" width="42" height="20" rx="3" fill="#334155"/><rect x="59" y="72" width="42" height="20" rx="3" fill="#334155"/><rect x="108" y="72" width="42" height="20" rx="3" fill="#334155"/>`,
    ),
  },
]

export const ARTICLE_TEMPLATES: TemplateKey[] = ['article-list', 'article-grid', 'article-masonry', 'magazine']

export function getTemplate(key: string | null | undefined): TemplateMeta {
  return TEMPLATES.find((t) => t.key === key) || TEMPLATES[0]
}

export function isArticleTemplate(key: string | null | undefined): boolean {
  return ARTICLE_TEMPLATES.includes((key || 'article-list') as TemplateKey)
}
