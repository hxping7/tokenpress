// 5 套配色皮肤的令牌定义（与 globals.css 中的 [data-theme=...] 完全一致）。
// 用于 Style Pack 的 activeTheme 叠加层：当用户选择某个配色主题时，
// 由 StyleProvider 在模板包出厂配色之后注入，确定性覆盖调色板变量。

export type ThemeName = 'night' | 'cyber' | 'lava' | 'light' | 'space'

export const THEME_PALETTES: Record<ThemeName, string> = {
  night: `:root{
  --bg-primary:#020810; --bg-secondary:#0a1628; --bg-tertiary:#111d32;
  --text-primary:#e0e8ff; --text-secondary:#7a8ba8; --text-muted:#4a5a78;
  --accent-blue:#00d4ff; --accent-purple:#7c3aed; --accent-blue-dim:#0090cc;
  --border-color:rgba(0,180,255,0.08); --hover-bg:rgba(0,180,255,0.05);
  --gradient-from:#00d4ff; --gradient-via:#ffffff; --gradient-to:#7c3aed;
  --grid-pattern:rgba(0,212,255,0.02); --selection-bg:rgba(0,212,255,0.2);
  --scrollbar-thumb:rgba(0,212,255,0.2); --scrollbar-thumb-hover:rgba(0,212,255,0.4);
  --focus-ring:rgba(0,212,255,0.5); --card-border-hover:rgba(0,212,255,0.2);
  --section-divider:rgba(0,212,255,0.2); --btn-glow-from:rgba(0,212,255,0.15); --btn-glow-to:rgba(124,58,237,0.15);
}`,
  cyber: `:root{
  --bg-primary:#001010; --bg-secondary:#002520; --bg-tertiary:#003a30;
  --text-primary:#e0ffe8; --text-secondary:#70a888; --text-muted:#407060;
  --accent-blue:#00ff88; --accent-purple:#00ccff; --accent-blue-dim:#00bb66;
  --border-color:rgba(0,255,136,0.1); --hover-bg:rgba(0,255,136,0.06);
  --gradient-from:#00ff88; --gradient-via:#80ffc0; --gradient-to:#00ccff;
  --grid-pattern:rgba(0,255,136,0.03); --selection-bg:rgba(0,255,136,0.25);
  --scrollbar-thumb:rgba(0,255,136,0.2); --scrollbar-thumb-hover:rgba(0,255,136,0.4);
  --focus-ring:rgba(0,255,136,0.5); --card-border-hover:rgba(0,255,136,0.2);
  --section-divider:rgba(0,255,136,0.2); --btn-glow-from:rgba(0,255,136,0.15); --btn-glow-to:rgba(0,204,255,0.15);
}`,
  lava: `:root{
  --bg-primary:#0a0500; --bg-secondary:#1a0e00; --bg-tertiary:#2a1808;
  --text-primary:#ffe8e0; --text-secondary:#b08870; --text-muted:#705040;
  --accent-blue:#ff6b35; --accent-purple:#ff3366; --accent-blue-dim:#cc5522;
  --border-color:rgba(255,107,53,0.1); --hover-bg:rgba(255,107,53,0.06);
  --gradient-from:#ff6b35; --gradient-via:#ffaa66; --gradient-to:#ff3366;
  --grid-pattern:rgba(255,107,53,0.03); --selection-bg:rgba(255,107,53,0.25);
  --scrollbar-thumb:rgba(255,107,53,0.2); --scrollbar-thumb-hover:rgba(255,107,53,0.4);
  --focus-ring:rgba(255,107,53,0.5); --card-border-hover:rgba(255,107,53,0.2);
  --section-divider:rgba(255,107,53,0.2); --btn-glow-from:rgba(255,107,53,0.15); --btn-glow-to:rgba(255,51,102,0.15);
}`,
  light: `:root{
  --bg-primary:#ffffff; --bg-secondary:#f5f5f7; --bg-tertiary:#e8e8ed;
  --text-primary:#1d1d1f; --text-secondary:#3a3a3f; --text-muted:#8a8a8f;
  --accent-blue:#007aff; --accent-purple:#5856d6; --accent-blue-dim:#0055cc;
  --border-color:rgba(0,0,0,0.12); --hover-bg:rgba(0,0,0,0.04);
  --gradient-from:#007aff; --gradient-via:#5a9eff; --gradient-to:#5856d6;
  --grid-pattern:rgba(0,0,0,0.03); --selection-bg:rgba(0,122,255,0.2);
  --scrollbar-thumb:rgba(0,0,0,0.2); --scrollbar-thumb-hover:rgba(0,0,0,0.4);
  --focus-ring:rgba(0,122,255,0.5); --card-border-hover:rgba(0,122,255,0.3);
  --section-divider:rgba(0,0,0,0.12); --btn-glow-from:rgba(0,122,255,0.12); --btn-glow-to:rgba(88,86,214,0.12);
}`,
  space: `:root{
  --bg-primary:#050b1a; --bg-secondary:#0a1838; --bg-tertiary:#122550;
  --text-primary:#d0e0ff; --text-secondary:#6080b8; --text-muted:#305080;
  --accent-blue:#4488ff; --accent-purple:#00ccff; --accent-blue-dim:#2266dd;
  --border-color:rgba(68,136,255,0.08); --hover-bg:rgba(68,136,255,0.05);
  --gradient-from:#4488ff; --gradient-via:#88bbff; --gradient-to:#00ccff;
  --grid-pattern:rgba(68,136,255,0.02); --selection-bg:rgba(68,136,255,0.2);
  --scrollbar-thumb:rgba(68,136,255,0.2); --scrollbar-thumb-hover:rgba(68,136,255,0.4);
  --focus-ring:rgba(68,136,255,0.5); --card-border-hover:rgba(68,136,255,0.2);
  --section-divider:rgba(68,136,255,0.2); --btn-glow-from:rgba(68,136,255,0.15); --btn-glow-to:rgba(0,204,255,0.15);
}`,
}

export function getThemePalette(theme: string): string | null {
  return (THEME_PALETTES as Record<string, string>)[theme] || null
}

// 内置 5 套配色的切换项（作为风格包未声明 themeOptions 时的回退）
export const BUILTIN_THEME_OPTIONS: { key: string; labelZh: string; labelEn: string; color: string }[] = [
  { key: 'night', labelZh: '暗夜蓝紫', labelEn: 'Night Blue', color: '#00d4ff' },
  { key: 'cyber', labelZh: '赛博青绿', labelEn: 'Cyber Green', color: '#00ff88' },
  { key: 'lava', labelZh: '熔岩橙红', labelEn: 'Lava Orange', color: '#ff6b35' },
  { key: 'light', labelZh: '极简亮白', labelEn: 'Minimal Light', color: '#f5c542' },
  { key: 'space', labelZh: '太空深蓝', labelEn: 'Space Blue', color: '#4488ff' },
]

// 解析某配色主题的 CSS：优先内置 5 套，其次风格包自定义 themeVariants
export function resolveThemePalette(
  theme: string | null,
  themeVariants?: Record<string, string> | null,
): string | null {
  if (!theme) return null
  const builtin = getThemePalette(theme)
  if (builtin) return builtin
  if (themeVariants && typeof themeVariants === 'object') {
    const v = themeVariants[theme]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}
