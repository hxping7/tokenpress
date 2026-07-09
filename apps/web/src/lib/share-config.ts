// 文章分享 / 点赞 / 收藏 的后台可配置项（存于 site_settings.share_config，JSON 字符串）
// 1) enabled: 是否显示分享（总开关）
// 2) platforms: 显示哪些分享链接
// 3) positions: 分享按钮显示位置（可多选）
// 4) likeEnabled: 是否显示点赞 + 收藏（总开关）
// 5) likePositions: 点赞 + 收藏显示位置（可多选，与点赞放一块）

export type SharePlatform =
  | 'wechat'
  | 'moments'
  | 'weibo'
  | 'qq'
  | 'qzone'
  | 'twitter'
  | 'telegram'
  | 'facebook'
  | 'copy'

export type SharePosition = 'article_top' | 'article_bottom' | 'float_right'

export interface ShareConfig {
  enabled: boolean
  platforms: SharePlatform[]
  positions: SharePosition[]
  likeEnabled: boolean
  likePositions: SharePosition[]
}

export const SHARE_PLATFORMS: { key: SharePlatform; name: string }[] = [
  { key: 'wechat', name: '微信' },
  { key: 'moments', name: '朋友圈' },
  { key: 'weibo', name: '微博' },
  { key: 'qq', name: 'QQ' },
  { key: 'qzone', name: 'QQ空间' },
  { key: 'twitter', name: 'X' },
  { key: 'telegram', name: 'Telegram' },
  { key: 'facebook', name: 'Facebook' },
  { key: 'copy', name: '复制链接' },
]

export const SHARE_POSITIONS: { key: SharePosition; name: string; hint: string }[] = [
  { key: 'article_top', name: '文章正文上方', hint: '标题 / 点赞按钮下方' },
  { key: 'article_bottom', name: '文章正文结尾', hint: '正文阅读结束后' },
  { key: 'float_right', name: '文章右侧栏', hint: '桌面端显示在右侧边栏中' },
]

export const DEFAULT_SHARE_CONFIG: ShareConfig = {
  enabled: true,
  platforms: SHARE_PLATFORMS.map((p) => p.key),
  positions: ['article_top'],
  likeEnabled: true,
  likePositions: ['article_top'],
}

function cloneDefault(): ShareConfig {
  return {
    enabled: DEFAULT_SHARE_CONFIG.enabled,
    platforms: [...DEFAULT_SHARE_CONFIG.platforms],
    positions: [...DEFAULT_SHARE_CONFIG.positions],
    likeEnabled: DEFAULT_SHARE_CONFIG.likeEnabled,
    likePositions: [...DEFAULT_SHARE_CONFIG.likePositions],
  }
}

export function parseShareConfig(raw?: string | null): ShareConfig {
  if (!raw) return cloneDefault()
  try {
    const parsed = JSON.parse(raw)
    const platforms = Array.isArray(parsed.platforms)
      ? parsed.platforms.filter((p: string) => SHARE_PLATFORMS.some((sp) => sp.key === p))
      : DEFAULT_SHARE_CONFIG.platforms
    const positions = Array.isArray(parsed.positions)
      ? parsed.positions.filter((p: string) => SHARE_POSITIONS.some((sp) => sp.key === p))
      : DEFAULT_SHARE_CONFIG.positions
    const likePositions = Array.isArray(parsed.likePositions)
      ? parsed.likePositions.filter((p: string) => SHARE_POSITIONS.some((sp) => sp.key === p))
      : DEFAULT_SHARE_CONFIG.likePositions
    const enabled =
      typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SHARE_CONFIG.enabled
    const likeEnabled =
      typeof parsed.likeEnabled === 'boolean' ? parsed.likeEnabled : DEFAULT_SHARE_CONFIG.likeEnabled
    return {
      enabled,
      platforms: platforms.length ? platforms : [...DEFAULT_SHARE_CONFIG.platforms],
      positions: positions.length ? positions : [...DEFAULT_SHARE_CONFIG.positions],
      likeEnabled,
      likePositions: likePositions.length ? likePositions : [...DEFAULT_SHARE_CONFIG.likePositions],
    }
  } catch {
    return cloneDefault()
  }
}
