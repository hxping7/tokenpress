'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            // 429 是限流响应：重试只会继续消耗同一窗口的配额、让限流更严重，
            // 因此对 429 永不重试；其它错误（网络抖动 / 5xx）允许重试 1 次。
            retry: (failureCount, error: any) =>
              error?.status !== 429 && failureCount < 1,
            // 内容站无需在窗口重新获得焦点时全量重拉，
            // 避免用户在后台改设置后切回首页标签页造成的请求风暴。
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
