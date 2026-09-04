// 风格包编辑器共享 schema：不可变路径读写、模板键、默认配置、字段元数据

export const TEMPLATE_KEYS = [
  'article-list',
  'article-grid',
  'article-masonry',
  'magazine',
  'single-page',
  'link-wall',
  'design-gallery',
] as const

export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export const TEMPLATE_LABELS: Record<string, string> = {
  'article-list': '文章列表（内容排版）',
  'article-grid': '卡片网格（内容排版）',
  'article-masonry': '瀑布流（内容排版）',
  'magazine': '杂志头条（内容排版）',
  'single-page': '单页（内容排版）',
  'link-wall': '链接墙（内容排版）',
  'design-gallery': '作品集画廊（内容排版）',
}

// ===== 不可变嵌套读写（仅对象路径，数组请用专门方法）=====
export function getIn(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setIn(obj: any, path: string, value: any): any {
  const keys = path.split('.')
  const clone: any = obj == null ? {} : Array.isArray(obj) ? [...obj] : { ...obj }
  let cur = clone
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    const next = cur[k]
    cur[k] = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : {}
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = value
  return clone
}

// 删除某路径（置回默认/移除）
export function deleteIn(obj: any, path: string): any {
  const keys = path.split('.')
  const clone: any = obj == null ? {} : { ...obj }
  let cur = clone
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (cur[k] == null) return clone
    cur[k] = { ...cur[k] }
    cur = cur[k]
  }
  delete cur[keys[keys.length - 1]]
  return clone
}

// ===== 默认配置片段 =====
export function defaultTemplateConfig(key: string): Record<string, unknown> {
  switch (key) {
    case 'article-grid':
      return { columns: 3, gap: 1.5, aspectRatio: '4/3', showThumbnail: true, showExcerpt: true, cardStyle: 'bordered', hover: 'lift' }
    case 'article-masonry':
      return { columns: 2, gap: 1.25, aspectRatio: 'auto', showThumbnail: true, showExcerpt: true, cardStyle: 'bordered', hover: 'lift' }
    case 'article-list':
      return { layout: 'grid', columns: 3, gap: 1.5, showThumbnail: true, showExcerpt: true, cardStyle: 'bordered', hover: 'lift' }
    case 'magazine':
      return { columns: 3, gap: 1.5, showThumbnail: true, showExcerpt: true, cardStyle: 'bordered', hover: 'lift' }
    case 'single-page':
      return {}
    case 'link-wall':
      return { columns: 4, gap: 0.75, pill: true }
    case 'design-gallery':
      return { columns: 3, gap: 1.5, aspectRatio: '4/3', cardStyle: 'clean', hover: 'zoom' }
    default:
      return {}
  }
}

export const CARD_STYLE_OPTIONS = [
  { value: 'bordered', label: '描边卡片', hint: '带细边框的常规卡片' },
  { value: 'shadow', label: '阴影卡片', hint: '柔和投影，浮起感' },
  { value: 'clean', label: '极简无框', hint: '无边框，靠间距区分' },
  { value: 'zoom', label: '悬停放大', hint: '鼠标移过时图片放大' },
]

export const HOVER_OPTIONS = [
  { value: 'lift', label: '上浮', hint: '鼠标移过时整卡上移' },
  { value: 'zoom', label: '图片放大', hint: '仅图片放大' },
  { value: 'glow', label: '发光', hint: '强调色外发光' },
  { value: 'none', label: '无', hint: '不响应悬停' },
]

export const NAV_POSITION_OPTIONS = [
  { value: 'top', label: '顶部横向', hint: '导航位于页面顶部（默认）' },
  { value: 'left', label: '浏览器左侧', hint: '竖向侧栏，主内容整体右移' },
]

export const NAV_STYLE_OPTIONS = [
  { value: 'underline', label: '下划线', hint: '悬停/激活显示背景块' },
  { value: 'pill', label: '胶囊', hint: '圆角胶囊按钮' },
  { value: 'plain', label: '纯文字', hint: '仅文字，无背景' },
]

export const NAV_ALIGN_OPTIONS = [
  { value: 'left', label: '左' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右' },
]

export const HEADER_VARIANT_OPTIONS = [
  { value: 'sticky-solid', label: '固定不透明', hint: '吸顶，实色背景' },
  { value: 'sticky-transparent', label: '固定透明', hint: '吸顶，透明背景（适合配大图 Hero）' },
  { value: 'static', label: '随页面滚动', hint: '不吸顶' },
]

export const LOGO_POSITION_OPTIONS = [
  { value: 'left', label: '左' },
  { value: 'center', label: '居中（上排 Logo 下排导航）' },
  { value: 'right', label: '右' },
]

// 导航颜色字段元数据（统一渲染）
export interface ColorFieldMeta {
  path: string
  label: string
  desc: string
}
export const NAV_COLOR_FIELDS: ColorFieldMeta[] = [
  { path: 'nav.colors.text', label: '菜单文字色', desc: '导航项默认文字颜色' },
  { path: 'nav.colors.hoverBg', label: '鼠标移过背景', desc: '鼠标悬停时菜单项的背景色' },
  { path: 'nav.colors.hoverText', label: '鼠标移过文字', desc: '鼠标悬停时菜单项文字颜色' },
  { path: 'nav.colors.activeBg', label: '当前项背景', desc: '所在页面菜单项的背景色' },
  { path: 'nav.colors.activeText', label: '当前项文字', desc: '所在页面菜单项文字颜色' },
  { path: 'nav.colors.barBg', label: '导航栏背景', desc: '整条/整列导航的背景色（留空=跟随主题）' },
  { path: 'nav.colors.barText', label: '品牌文字色', desc: 'Logo/站名文字颜色' },
]

export const ASPECT_OPTIONS = [
  { value: 'auto', label: '自适应（瀑布流）' },
  { value: '1/1', label: '1:1 方形' },
  { value: '4/3', label: '4:3' },
  { value: '16/10', label: '16:10' },
  { value: '16/9', label: '16:9' },
  { value: '3/4', label: '3:4 竖图' },
]
