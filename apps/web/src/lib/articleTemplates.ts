/**
 * 文章级模板注册表（前端）
 *
 * 与后端 VALID_ARTICLE_TEMPLATES 保持一致。
 * article_template 决定单篇详情页的渲染形态，与板块/分类（列表页）模板正交。
 * 解析优先级（仅详情页）：article.template > category.template > section.template
 */

export type ArticleTemplateKey =
  | 'standard'
  | 'photo-essay'
  | 'video-post'
  | 'code-showcase'
  | 'timeline'
  | 'split-media'
  | 'story'

export interface ArticleTemplateMeta {
  key: ArticleTemplateKey
  label: string
  description: string
  /** 内联 SVG 预览图（用于后台下拉预览） */
  previewSvg: string
}

const frame = (inner: string) =>
  `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto"><rect width="160" height="100" rx="8" fill="#0f172a"/><rect x="6" y="6" width="148" height="14" rx="3" fill="#1e293b"/>${inner}</svg>`

export const ARTICLE_TEMPLATES: ArticleTemplateMeta[] = [
  {
    key: 'standard',
    label: '标准文章',
    description: '经典阅读版：封面 + 正文 + 目录 + 相关侧栏（默认）',
    previewSvg: frame(
      `<rect x="10" y="28" width="100" height="32" rx="3" fill="#334155"/><rect x="116" y="28" width="34" height="44" rx="2" fill="#475569"/><rect x="10" y="66" width="100" height="4" rx="2" fill="#334155"/><rect x="10" y="74" width="100" height="4" rx="2" fill="#334155"/><rect x="10" y="82" width="70" height="4" rx="2" fill="#334155"/>`,
    ),
  },
  {
    key: 'photo-essay',
    label: '图文故事',
    description: '大图 hero + 照片网格，正文作为图注，适合摄影/作品记录',
    previewSvg: frame(
      `<rect x="10" y="28" width="140" height="28" rx="3" fill="#D4537E"/><rect x="10" y="60" width="44" height="32" rx="3" fill="#ED93B1"/><rect x="58" y="60" width="44" height="32" rx="3" fill="#D4537E"/><rect x="106" y="60" width="44" height="32" rx="3" fill="#ED93B1"/>`,
    ),
  },
  {
    key: 'video-post',
    label: '视频文章',
    description: '视频播放器置顶（B站/YouTube/本地），正文在视频下方',
    previewSvg: frame(
      `<rect x="10" y="28" width="140" height="38" rx="3" fill="#111827"/><polygon points="78,40 78,54 90,47" fill="#fff" opacity="0.85"/><rect x="10" y="72" width="100" height="4" rx="2" fill="#334155"/><rect x="10" y="80" width="120" height="4" rx="2" fill="#334155"/>`,
    ),
  },
  {
    key: 'code-showcase',
    label: '代码展示',
    description: '暗色宽代码块 + 文件树侧栏，适合技术教程/源码解析',
    previewSvg: frame(
      `<rect x="10" y="28" width="96" height="56" rx="3" fill="#0f172a"/><rect x="14" y="34" width="50" height="2" rx="1" fill="#639922"/><rect x="14" y="40" width="70" height="2" rx="1" fill="#378ADD"/><rect x="18" y="46" width="40" height="2" rx="1" fill="#EF9F27"/><rect x="112" y="28" width="38" height="56" rx="2" fill="#475569"/><rect x="116" y="34" width="30" height="2" rx="1" fill="#cbd5e1"/><rect x="116" y="40" width="24" height="2" rx="1" fill="#cbd5e1"/>`,
    ),
  },
  {
    key: 'timeline',
    label: '时间线',
    description: '竖向时间线 + 交替左右内容块，适合发展史/更新日志',
    previewSvg: frame(
      `<line x1="80" y1="28" x2="80" y2="92" stroke="#534AB7" stroke-width="2"/><circle cx="80" cy="40" r="4" fill="#534AB7"/><circle cx="80" cy="62" r="4" fill="#534AB7"/><circle cx="80" cy="84" r="4" fill="#534AB7"/><rect x="20" y="36" width="50" height="8" rx="2" fill="#AFA9EC"/><rect x="90" y="58" width="50" height="8" rx="2" fill="#AFA9EC"/>`,
    ),
  },
  {
    key: 'split-media',
    label: '图文并排',
    description: '左正文 + 右侧 sticky 媒体列，图文交替阅读',
    previewSvg: frame(
      `<rect x="10" y="28" width="84" height="64" rx="3" fill="#1e293b"/><rect x="14" y="34" width="60" height="3" rx="1" fill="#475569"/><rect x="14" y="42" width="76" height="3" rx="1" fill="#475569"/><rect x="14" y="54" width="50" height="3" rx="1" fill="#475569"/><rect x="100" y="28" width="50" height="64" rx="3" fill="#1D9E75" opacity="0.25"/>`,
    ),
  },
  {
    key: 'story',
    label: '沉浸长文',
    description: '全宽大图 hero + 大字排版 + 滚动渐显，适合深度长文',
    previewSvg: frame(
      `<rect x="10" y="28" width="140" height="22" rx="3" fill="#378ADD" opacity="0.25"/><rect x="46" y="58" width="68" height="6" rx="2" fill="#e2e8f0"/><rect x="40" y="70" width="80" height="3" rx="1" fill="#475569"/><rect x="40" y="78" width="60" height="3" rx="1" fill="#475569"/>`,
    ),
  },
]

const VALID_SET = new Set(ARTICLE_TEMPLATES.map((t) => t.key))

export function getArticleTemplate(key: string | null | undefined): ArticleTemplateMeta {
  return ARTICLE_TEMPLATES.find((t) => t.key === key) || ARTICLE_TEMPLATES[0]
}

export function isArticleTemplateKey(key: string | null | undefined): key is ArticleTemplateKey {
  return key != null && VALID_SET.has(key as ArticleTemplateKey)
}
