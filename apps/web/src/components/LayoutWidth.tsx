'use client'

import { useEffect } from 'react'
import { parseContentMaxWidth } from '@/lib/layout-config'
import { useStyleConfig } from '@/components/StyleProvider'
import { useSiteSettings } from '@/lib/useSiteSettings'

// 全局内容容器最大宽度（--content-max-width）：
// 权威源 = 风格包 layouts.container.maxWidth（整站外观统一由风格包管理）；
// 若风格包未声明，则回退历史 site-settings.content_max_width（兼容旧部署），
// 再否则使用 globals.css 中的默认 80rem。
// 注意：content_max_width 与全站其余设置共用同一个去重后的 /site-settings 请求，
// 不再各自独立拉取，避免因并发过多触发 429 限流而回退到窄默认值。
export function LayoutWidth() {
  const packLayouts = useStyleConfig().layouts
  const packWidth: string | undefined = packLayouts?.container?.maxWidth

  const { data: legacy } = useSiteSettings(!packWidth) // 风格包已定义则无需再拉旧值

  useEffect(() => {
    const raw = packWidth ?? legacy?.data?.content_max_width
    const value = parseContentMaxWidth(raw)
    document.documentElement.style.setProperty('--content-max-width', value)
  }, [packWidth, legacy])

  return null
}
