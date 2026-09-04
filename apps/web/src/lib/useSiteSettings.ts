'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface SiteSettingsMap {
  [key: string]: string
}

export type SiteSettingsResponse = { success: boolean; data: SiteSettingsMap }

// 全站设置统一获取 hook。
//
// 关键：所有需要读取 site-settings 的组件（Header / Footer / Logo / LayoutWidth /
// AnalyticsLoader / ArticleDetailClient 等）共用同一个 queryKey（['site-settings']）。
// react-query 会据此自动去重——无论多少组件同时挂载，浏览器只会发出 **1 个**
// GET /api/v1/site-settings 请求，并由 react-query 在 5 分钟内复用缓存。
//
// 此前每个组件各自 GET /site-settings/keys/X（queryKey 互不相同），单页就会并发
// 8~9 个请求，全部走同一客户端 IP，极易打满全局限流（100/min）触发 429，
// 进而导致 content_max_width 等设置加载失败、布局回退到默认窄宽度而出现两侧白边。
export function useSiteSettings(enabled = true) {
  return useQuery<SiteSettingsResponse>({
    queryKey: ['site-settings'],
    queryFn: () => api.get<SiteSettingsResponse>('/site-settings'),
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}
