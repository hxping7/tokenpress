/**
 * 布局覆盖解析工具
 *
 * 解析链：板块级 override → 风格包全局默认 → 内置兜底
 *
 * 板块级 override 存储在 sections.layouts (JSON)，键为 {section, article, list}。
 * 全局默认来自风格包的 layouts.json（含 homepage / section / article / list / templates）。
 *
 * 覆盖语义：字段级合并（field-level deep merge），而非整键替换。
 * 即板块只改了 hero 的某个子字段，风格包 section 下的 sidebar/list 默认仍保留。
 */

/** 板块/分类级布局覆盖的合法键 */
export type SectionLayoutOverride = {
  section?: Record<string, unknown>
  category?: Record<string, unknown>
  article?: Record<string, unknown>
  list?: Record<string, unknown>
} | null

/** 全局风格包布局 */
export type PackLayouts = {
  homepage?: Record<string, unknown>
  section?: Record<string, unknown>
  /** 分类页默认骨架（风格包级）；分类页基线优先取此，无则回退 section */
  category?: Record<string, unknown>
  article?: Record<string, unknown>
  list?: Record<string, unknown>
  /** 各类内容模板（article-list/article-grid/...）的出厂默认样式 */
  templates?: Record<string, Record<string, unknown>>
} | null

/**
 * 字段级合并：base 为底，override 覆盖。
 * - 普通对象：递归合并（字段级，不替换整棵子树）
 * - 数组 / 基本类型：override 整体替换 base（不拼接）
 */
export function mergeLayoutConfigs(
  base: Record<string, unknown> | null | undefined,
  override: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const a = base && typeof base === 'object' && !Array.isArray(base) ? base : {}
  const b = override && typeof override === 'object' && !Array.isArray(override) ? override : {}
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const av = out[k]
    if (
      v && typeof v === 'object' && !Array.isArray(v) &&
      av && typeof av === 'object' && !Array.isArray(av)
    ) {
      out[k] = mergeLayoutConfigs(av as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * 从 override / 风格包 提取 key 对应的布局，支持「分类级」覆盖链。
 *
 * 解析链（字段级合并，低 → 高）：
 *   风格包默认  <  板块级 override  <  分类级 override
 *
 * - 板块页：key='section'，基线取 pack.section，叠加 sections.layouts.section
 * - 分类页：key='category'，基线取 pack.category（无则回退 pack.section），
 *           叠加 sections.layouts.category（通常空）与 categories.layouts.category
 * - 文章页：key='article'，基线取 pack.article
 */
export function resolveSectionLayout(
  sectionOverride: SectionLayoutOverride,
  globalLayouts: PackLayouts,
  key: 'section' | 'category' | 'article' | 'list',
  categoryOverride?: SectionLayoutOverride,
): Record<string, unknown> {
  // 分类页基线优先 pack['category']，否则回退 pack['section']
  const globalKey = key === 'category'
    ? (globalLayouts?.category ? 'category' : 'section')
    : key
  const global = (globalLayouts?.[globalKey as 'section' | 'category' | 'article' | 'list'] as Record<string, unknown>) || {}
  const sectionOvr = (sectionOverride?.[key] as Record<string, unknown>) || null
  const catOvr = (categoryOverride?.[key] as Record<string, unknown>) || null
  let merged = mergeLayoutConfigs(global, sectionOvr)
  if (catOvr) merged = mergeLayoutConfigs(merged, catOvr)
  return merged
}

/**
 * 解析某个内容模板（templateKey）的生效配置：
 * 风格包 templates[templateKey] 为出厂默认，用户配置（分类 > 板块）逐字段覆盖。
 *
 * 优先级（低 → 高）：
 *   风格包默认 → 用户配置
 */
export function resolveTemplateConfig(
  stylePackTemplates: Record<string, Record<string, unknown>> | null | undefined,
  templateKey: string,
  userConfig?: Record<string, unknown> | null,
): Record<string, unknown> {
  const packDefault = stylePackTemplates?.[templateKey] || {}
  return mergeLayoutConfigs(packDefault, userConfig || {})
}

/**
 * 从板块对象中提取 layouts（兼容 raw DB 行和已序列化过的对象）。
 */
export function extractSectionLayouts(section: Record<string, unknown> | null | undefined): SectionLayoutOverride {
  if (!section) return null
  const raw = section.layouts
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'object') return raw as SectionLayoutOverride
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return null
}
