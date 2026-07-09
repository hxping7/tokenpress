// 全局宽屏（内容容器最大宽度）配置
// 复用 siteSettings 的 key-value 存储，key 为 content_max_width，值为 CSS max-width 字符串。

export const DEFAULT_CONTENT_MAX_WIDTH = '80rem' // 1280px，与历史 max-w-7xl 行为一致

export interface WidthPreset {
  key: string
  label: string
  value: string
}

// 预设档位：覆盖常见笔记本/台式机场景
// - 标准：1280px（默认，兼容旧版 max-w-7xl）
// - 宽屏：1536px（2xl，适合 1440p / 大屏笔记本）
// - 超宽：1920px（适合 1080p 横屏全高清）
// - 全宽：100%（占满屏幕宽度，16" 笔记本核心诉求）
export const WIDTH_PRESETS: WidthPreset[] = [
  { key: 'standard', label: '标准 (1280px)', value: '80rem' },
  { key: 'wide', label: '宽屏 (1536px)', value: '96rem' },
  { key: 'ultrawide', label: '超宽 (1920px)', value: '120rem' },
  { key: 'full', label: '全宽 (100%)', value: '100%' },
]

// 防御性解析：无论存储值是否合法，都回退到默认值，避免页面布局崩坏。
export function parseContentMaxWidth(raw?: string | null): string {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return DEFAULT_CONTENT_MAX_WIDTH
  }
  const v = raw.trim()
  // 合法 CSS max-width：带单位（rem/px/em/%/vw/vh）或纯数字（视为 px）
  if (/^\d+(\.\d+)?(rem|px|em|%|vw|vh)$/.test(v)) return v
  if (/^\d+$/.test(v)) return `${v}px`
  // 已知预设值
  if (WIDTH_PRESETS.some((p) => p.value === v)) return v
  return DEFAULT_CONTENT_MAX_WIDTH
}
