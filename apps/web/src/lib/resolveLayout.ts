/**
 * 布局覆盖解析工具
 *
 * 解析链：板块级 override → 风格包全局默认 → 内置兜底
 *
 * 板块级 override 存储在 sections.layouts (JSON)，键为 {section, article, list}。
 * 全局默认来自风格包的 layouts.json。
 */

/** 板块级布局覆盖的合法键 */
export type SectionLayoutOverride = {
  section?: Record<string, unknown>
  article?: Record<string, unknown>
  list?: Record<string, unknown>
} | null

/** 全局风格包布局 */
export type PackLayouts = {
  homepage?: Record<string, unknown>
  section?: Record<string, unknown>
  article?: Record<string, unknown>
  list?: Record<string, unknown>
} | null

/**
 * 从 secLayouts（板块级 override）提取 target 键对应的布局。
 * - 如果 override 中该键存在且为非空对象 → 仅返回 override 的值（不合并）
 * - 否则 → 回退到 global 的对应键
 *
 * 注意：不是全量 deep-merge，而是"键级别覆盖"——
 * 板块设置了 `section` 就用板块的 section，不混入全局 section。
 * 这样板块可以完全重定义某类页面的布局，保持简单可预测。
 */
export function resolveSectionLayout(
  sectionOverride: SectionLayoutOverride,
  globalLayouts: PackLayouts,
  key: 'section' | 'article' | 'list',
): Record<string, unknown> {
  const override = sectionOverride?.[key]
  if (override && typeof override === 'object' && Object.keys(override as object).length > 0) {
    return { ...override }
  }
  const global = globalLayouts?.[key]
  if (global && typeof global === 'object') {
    return { ...global }
  }
  return {}
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
