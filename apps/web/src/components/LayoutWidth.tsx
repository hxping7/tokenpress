'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { parseContentMaxWidth } from '@/lib/layout-config'

// 全局宽度控制器：读取后台「全局宽屏设置」，写入 <html> 的 --content-max-width 变量。
// 站点级容器（Header/Footer/首页/板块/文章页）均挂此变量，从而由后台一处控制全站最大宽度。
export function LayoutWidth() {
  const { data } = useQuery({
    queryKey: ['site-settings-key-content_max_width'],
    queryFn: () => api.get('/site-settings/keys/content_max_width'),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const raw = data?.data?.content_max_width
    const value = parseContentMaxWidth(raw)
    document.documentElement.style.setProperty('--content-max-width', value)
  }, [data])

  return null
}
