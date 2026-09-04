// 板块「作品集画廊」判定的唯一入口。
//
// 历史上由 section.kind === 'design_works' 表示（最早的 design_works 表语义）；
// 引入统一内容排版模板后，改由 section.template === 'design-gallery' 表示。
// 迁移 0019 已把 kind='design_works' 的板块同步成 template='design-gallery'，
// 二者现已等价。所有渲染/编辑/后台判定都应调用本函数，避免到处散落
// `template === 'design-gallery' || kind === 'design_works'` 的重复逻辑。
//
// 优先级：以 template 为准（统一排版系统的唯一信号），kind 仅作历史兼容兜底。
export function isDesignGallerySection(section?: {
  template?: string | null
  kind?: string | null
} | null): boolean {
  if (!section) return false
  return section.template === 'design-gallery' || section.kind === 'design_works'
}
